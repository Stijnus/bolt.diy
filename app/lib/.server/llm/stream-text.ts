import { streamText as _streamText, type Message } from 'ai';
import { MAX_TOKENS, type FileMap } from './constants';
import { getSystemPrompt } from '~/lib/common/prompts/prompts';
import { DEFAULT_MODEL, DEFAULT_PROVIDER, MODIFICATIONS_TAG_NAME, PROVIDER_LIST, WORK_DIR } from '~/utils/constants';
import type { IProviderSetting } from '~/types/model';
import { PromptLibrary } from '~/lib/common/prompt-library';
import { allowedHTMLElements } from '~/utils/markdown';
import { LLMManager } from '~/lib/modules/llm/manager';
import { createScopedLogger } from '~/utils/logger';
import { createFilesContext, extractPropertiesFromMessage, type FilesContextOptions } from './utils';
import { parseCodeUpdateOperations, applyCodeUpdateOperations } from './partial-code-service';
import { adaptMessages } from './message-adapter';

export type Messages = Message[];

export interface StreamingOptions extends Omit<Parameters<typeof _streamText>[0], 'model'> {
  supabaseConnection?: {
    isConnected: boolean;
    hasSelectedProject: boolean;
    credentials?: {
      anonKey?: string;
      supabaseUrl?: string;
    };
  };
}

const logger = createScopedLogger('stream-text');

/**
 * Process partial code updates in the AI response
 */
function processPartialCodeUpdates(response: string, files: FileMap): FileMap {
  try {
    // Parse code update operations from the response
    const operations = parseCodeUpdateOperations(response);

    if (operations.length === 0) {
      // No partial code updates found
      return files;
    }

    logger.info(`Found ${operations.length} partial code update operations`);

    // Apply the operations to the files
    const updatedFiles = applyCodeUpdateOperations(operations, files);

    return updatedFiles;
  } catch (error) {
    logger.error('Error processing partial code updates:', error);
    return files;
  }
}

export async function streamText(props: {
  messages: Omit<Message, 'id'>[];
  env?: Env;
  options?: StreamingOptions;
  apiKeys?: Record<string, string>;
  files?: FileMap;
  providerSettings?: Record<string, IProviderSetting>;
  promptId?: string;
  contextOptimization?: boolean;
  contextFiles?: FileMap;
  summary?: string;
  messageSliceId?: number;
}) {
  const {
    messages,
    env: serverEnv,
    options,
    apiKeys,
    providerSettings,
    promptId,
    contextOptimization,
    contextFiles,
    summary,
  } = props;
  let currentModel = DEFAULT_MODEL;
  let currentProvider = DEFAULT_PROVIDER.name;

  // Ensure messages is an array before processing
  if (!Array.isArray(messages)) {
    logger.error('Invalid messages format: messages must be an array');
    throw new Error('Invalid messages format: messages must be an array');
  }

  // Validate each message has the required properties
  for (const message of messages) {
    if (!message.role || !['user', 'assistant', 'system', 'function', 'tool', 'data'].includes(message.role)) {
      logger.error(`Invalid message role: ${message.role}`);
      throw new Error(
        `Invalid message role: ${message.role}. Must be one of: user, assistant, system, function, tool, data`,
      );
    }

    if (message.content === undefined) {
      logger.error('Message missing content property');
      throw new Error('Message missing content property');
    }
  }

  let processedMessages = messages.map((message) => {
    if (message.role === 'user') {
      const { model, provider, content } = extractPropertiesFromMessage(message);
      currentModel = model;
      currentProvider = provider;

      return { ...message, content };
    } else if (message.role == 'assistant') {
      let content = message.content;
      content = content.replace(/<div class=\\"__boltThought__\\">.*?<\/div>/s, '');
      content = content.replace(/<think>.*?<\/think>/s, '');

      // Remove package-lock.json content specifically keeping token usage MUCH lower
      content = content.replace(
        /<boltAction type="file" filePath="package-lock\.json">[\s\S]*?<\/boltAction>/g,
        '[package-lock.json content removed]',
      );

      // Trim whitespace potentially left after removals
      content = content.trim();

      return { ...message, content };
    }

    return message;
  });

  const provider = PROVIDER_LIST.find((p) => p.name === currentProvider) || DEFAULT_PROVIDER;
  const staticModels = LLMManager.getInstance().getStaticModelListFromProvider(provider);
  let modelDetails = staticModels.find((m) => m.name === currentModel);

  if (!modelDetails) {
    const modelsList = [
      ...(provider.staticModels || []),
      ...(await LLMManager.getInstance().getModelListFromProvider(provider, {
        apiKeys,
        providerSettings,
        serverEnv: serverEnv as any,
      })),
    ];

    if (!modelsList.length) {
      throw new Error(`No models found for provider ${provider.name}`);
    }

    modelDetails = modelsList.find((m) => m.name === currentModel);

    if (!modelDetails) {
      // Fallback to first model
      logger.warn(
        `MODEL [${currentModel}] not found in provider [${provider.name}]. Falling back to first model. ${modelsList[0].name}`,
      );
      modelDetails = modelsList[0];
    }
  }

  const dynamicMaxTokens = modelDetails && modelDetails.maxTokenAllowed ? modelDetails.maxTokenAllowed : MAX_TOKENS;

  let systemPrompt =
    PromptLibrary.getPropmtFromLibrary(promptId || 'default', {
      cwd: WORK_DIR,
      allowedHtmlElements: allowedHTMLElements,
      modificationTagName: MODIFICATIONS_TAG_NAME,
      supabase: {
        isConnected: options?.supabaseConnection?.isConnected || false,
        hasSelectedProject: options?.supabaseConnection?.hasSelectedProject || false,
        credentials: options?.supabaseConnection?.credentials || undefined,
      },
    }) ?? getSystemPrompt();

  if (contextFiles && contextOptimization) {
    // Extract the user's query to help with content optimization
    const lastUserMessage = processedMessages.filter((x) => x.role == 'user').pop();
    const userQuery = lastUserMessage
      ? Array.isArray(lastUserMessage.content)
        ? lastUserMessage.content.find((item) => item.type === 'text')?.text || ''
        : lastUserMessage.content
      : '';

    // Create optimized context with the user's query for better relevance
    const contextOptions: FilesContextOptions = {
      useRelativePath: true,
      optimizeContent: true,
      tokenBudget: 6000, // Default token budget
      query: userQuery,
    };

    logger.info(`Creating optimized context with token budget ${contextOptions.tokenBudget}`);

    const codeContext = createFilesContext(contextFiles, contextOptions);

    systemPrompt = `${systemPrompt}

Below is the artifact containing the context loaded into context buffer for you to have knowledge of and might need changes to fullfill current user request.
CONTEXT BUFFER:
---
${codeContext}
---
`;

    if (summary) {
      systemPrompt = `${systemPrompt}
      below is the chat history till now
CHAT SUMMARY:
---
${props.summary}
---
`;

      if (props.messageSliceId) {
        processedMessages = processedMessages.slice(props.messageSliceId);
      } else {
        const lastMessage = processedMessages.pop();

        if (lastMessage) {
          processedMessages = [lastMessage];
        }
      }
    }
  }

  logger.info(`Sending llm call to ${provider.name} with model ${modelDetails.name}`);

  // console.log(systemPrompt, processedMessages);

  // Create a wrapper for the onFinish callback to process partial code updates
  const originalOnFinish = options?.onFinish;
  const { files } = props;
  const wrappedOptions = {
    ...options,
    onFinish:
      originalOnFinish && files
        ? (result: any) => {
            // Process partial code updates in the response
            if (result.text) {
              const updatedFiles = processPartialCodeUpdates(result.text, files);

              // If files were updated, log the changes
              if (updatedFiles !== files) {
                logger.info('Applied partial code updates to files');

                // Update the files reference
                Object.keys(files).forEach((key) => {
                  delete files[key];
                });

                Object.keys(updatedFiles).forEach((key) => {
                  files[key] = updatedFiles[key];
                });
              }
            }

            // Call the original onFinish callback
            return originalOnFinish(result);
          }
        : originalOnFinish,
  };

  return _streamText({
    model: provider.getModelInstance({
      model: modelDetails.name,
      serverEnv,
      apiKeys,
      providerSettings,
    }),
    system: systemPrompt,
    maxTokens: dynamicMaxTokens,
    messages: Array.isArray(processedMessages) ? (adaptMessages(processedMessages as any) as any) : [],
    ...wrappedOptions,
  });
}
