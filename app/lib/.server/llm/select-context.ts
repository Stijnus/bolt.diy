import { generateText, type CoreTool, type GenerateTextResult, type Message } from 'ai';
import ignore from 'ignore';
import type { IProviderSetting } from '~/types/model';
import { IGNORE_PATTERNS, type FileMap } from './constants';
import { DEFAULT_MODEL, DEFAULT_PROVIDER, PROVIDER_LIST } from '~/utils/constants';
import { createFilesContext, extractCurrentContext, extractPropertiesFromMessage, simplifyBoltActions } from './utils';
import { createScopedLogger } from '~/utils/logger';
import { LLMManager } from '~/lib/modules/llm/manager';
import { getCache, CACHE_KEYS, simpleHash, hashFileMap } from './cache';
import { selectFilesSemantically } from './file-index';

// Common patterns to ignore, similar to .gitignore

const ig = ignore().add(IGNORE_PATTERNS);
const logger = createScopedLogger('select-context');

export async function selectContext(props: {
  messages: Message[];
  env?: Env;
  apiKeys?: Record<string, string>;
  files: FileMap;
  providerSettings?: Record<string, IProviderSetting>;
  promptId?: string;
  contextOptimization?: boolean;
  summary?: string; // Made optional to support parallel execution
  onFinish?: (resp: GenerateTextResult<Record<string, CoreTool<any, any>>, never>) => void;
}) {
  const { messages, env: serverEnv, apiKeys, files, providerSettings, summary, onFinish } = props;
  const cache = getCache();

  /*
   * OPTIMIZATION: Check cache before selecting context
   * Create cache key from last user message + file map hash
   */
  const lastUserMessage = messages.filter((x) => x.role === 'user').pop();

  if (!lastUserMessage) {
    throw new Error('No user message found');
  }

  const messageText =
    typeof lastUserMessage.content === 'string' ? lastUserMessage.content : JSON.stringify(lastUserMessage.content);
  const messageHash = simpleHash(messageText);
  const fileListHash = hashFileMap(files);
  const cacheKey = CACHE_KEYS.contextSelection(messageHash, fileListHash);

  // Check cache
  const cachedContext = cache.get<FileMap>(cacheKey);

  if (cachedContext) {
    logger.info(
      `Using CACHED context selection (${Object.keys(cachedContext).length} files) for message hash ${messageHash}`,
    );
    return cachedContext;
  }

  logger.info(`Generating NEW context selection for message hash ${messageHash}, file list hash ${fileListHash}`);

  let currentModel = DEFAULT_MODEL;
  let currentProvider = DEFAULT_PROVIDER.name;
  const processedMessages: Message[] = messages.map((message) => {
    if (message.role === 'user') {
      const { model, provider, content } = extractPropertiesFromMessage(message);
      currentModel = model;
      currentProvider = provider;

      return { ...message, content };
    } else if (message.role == 'assistant') {
      let content = Array.isArray(message.content)
        ? (message.content.find((item) => item.type === 'text')?.text as string) || ''
        : (message.content as string);

      content = simplifyBoltActions(content);

      content = content.replace(/<div class=\\"__boltThought__\\">.*?<\/div>/s, '');
      content = content.replace(/<think>.*?<\/think>/s, '');

      return { ...message, content };
    }

    return message;
  }) as unknown as Message[];

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

  const { codeContext } = extractCurrentContext(processedMessages);

  let filePaths = getFilePaths(files || {});
  filePaths = filePaths.filter((x) => {
    const relPath = x.replace('/home/project/', '');
    return !ig.ignores(relPath);
  });

  /*
   * OPTIMIZATION: Semantic file pre-filtering (Phase 3)
   * Uses semantic index with keyword extraction + import/export analysis
   * Reduces from 500+ files to top 15-20 most relevant candidates
   */
  const MAX_FILES_TO_SEND_LLM = 20; // Final candidates sent to LLM

  // Extract recently changed files from previous messages
  const recentlyChanged: string[] = [];

  for (let i = processedMessages.length - 1; i >= Math.max(0, processedMessages.length - 5); i--) {
    const msg = processedMessages[i];

    if (msg.annotations && Array.isArray(msg.annotations)) {
      for (const annotation of msg.annotations) {
        if (annotation && typeof annotation === 'object' && (annotation as any).type === 'fileChanges') {
          const fileChanges = annotation as any;

          if (fileChanges.changes && Array.isArray(fileChanges.changes)) {
            for (const change of fileChanges.changes) {
              if (change.operation !== 'delete') {
                const fullPath = change.path.startsWith('/home/project/')
                  ? change.path
                  : `/home/project/${change.path}`;
                recentlyChanged.push(fullPath);
              }
            }
          }
        }
      }
    }
  }

  if (recentlyChanged.length > 0) {
    logger.info(`Found ${recentlyChanged.length} recently changed files`);
  }

  // If we have many files, use semantic index for intelligent pre-filtering
  if (filePaths.length > MAX_FILES_TO_SEND_LLM) {
    logger.info(
      `Using SEMANTIC INDEX to pre-filter from ${filePaths.length} to top ${MAX_FILES_TO_SEND_LLM} candidates`,
    );

    try {
      // Use semantic index to get top candidates
      const semanticCandidates = selectFilesSemantically(
        messageText,
        files,
        fileListHash,
        MAX_FILES_TO_SEND_LLM,
        recentlyChanged,
      );

      if (semanticCandidates.length > 0) {
        filePaths = semanticCandidates;
        logger.info(
          `Semantic index selected ${filePaths.length} files (removed ${filePaths.length - semanticCandidates.length} low-relevance files)`,
        );
      } else {
        // Fallback to basic heuristic filtering if semantic index returns nothing
        logger.warn('Semantic index returned no results, falling back to basic filtering');
        filePaths = basicFileFiltering(filePaths, 50);
      }
    } catch (error) {
      logger.error('Semantic index failed, falling back to basic filtering:', error);
      filePaths = basicFileFiltering(filePaths, 50);
    }
  } else {
    logger.info(`File count (${filePaths.length}) below threshold, skipping semantic pre-filtering`);
  }

  let context = '';
  const currrentFiles: string[] = [];
  const contextFiles: FileMap = {};

  if (codeContext?.type === 'codeContext') {
    const codeContextFiles: string[] = codeContext.files;
    Object.keys(files || {}).forEach((path) => {
      let relativePath = path;

      if (path.startsWith('/home/project/')) {
        relativePath = path.replace('/home/project/', '');
      }

      if (codeContextFiles.includes(relativePath)) {
        contextFiles[relativePath] = files[path];
        currrentFiles.push(relativePath);
      }
    });
    context = createFilesContext(contextFiles);
  }

  const summaryText = summary ? `Here is the summary of the chat till now: ${summary}` : '';

  const extractTextContent = (message: Message) =>
    Array.isArray(message.content)
      ? (message.content.find((item) => item.type === 'text')?.text as string) || ''
      : message.content;

  const lastProcessedUserMessage = processedMessages.filter((x) => x.role == 'user').pop();

  if (!lastProcessedUserMessage) {
    throw new Error('No user message found');
  }

  // select files from the list of code file from the project that might be useful for the current request from the user
  const resp = await generateText({
    system: `
        You are a software engineer. You are working on a project. You have access to the following files:

        AVAILABLE FILES PATHS
        ---
        ${filePaths.map((path) => `- ${path}`).join('\n')}
        ---

        You have following code loaded in the context buffer that you can refer to:

        CURRENT CONTEXT BUFFER
        ---
        ${context}
        ---

        Now, you are given a task. You need to select the files that are relevant to the task from the list of files above.

        RESPONSE FORMAT:
        your response should be in following format:
---
<updateContextBuffer>
    <includeFile path="path/to/file"/>
    <excludeFile path="path/to/file"/>
</updateContextBuffer>
---
        * Your should start with <updateContextBuffer> and end with </updateContextBuffer>.
        * You can include multiple <includeFile> and <excludeFile> tags in the response.
        * You should not include any other text in the response.
        * You should not include any file that is not in the list of files above.
        * You should not include any file that is already in the context buffer.
        * If no changes are needed, you can leave the response empty updateContextBuffer tag.
        `,
    prompt: `
        ${summaryText}

        Users Question: ${extractTextContent(lastProcessedUserMessage)}

        update the context buffer with the files that are relevant to the task from the list of files above.

        CRITICAL RULES:
        * Only include relevant files in the context buffer.
        * context buffer should not include any file that is not in the list of files above.
        * context buffer is extremlly expensive, so only include files that are absolutely necessary.
        * If no changes are needed, you can leave the response empty updateContextBuffer tag.
        * Only 5 files can be placed in the context buffer at a time.
        * if the buffer is full, you need to exclude files that is not needed and include files that is relevent.

        `,
    model: provider.getModelInstance({
      model: currentModel,
      serverEnv,
      apiKeys,
      providerSettings,
    }),
  });

  const response = resp.text;
  const updateContextBuffer = response.match(/<updateContextBuffer>([\s\S]*?)<\/updateContextBuffer>/);

  if (!updateContextBuffer) {
    throw new Error('Invalid response. Please follow the response format');
  }

  const includeFiles =
    updateContextBuffer[1]
      .match(/<includeFile path="(.*?)"/gm)
      ?.map((x) => x.replace('<includeFile path="', '').replace('"', '')) || [];
  const excludeFiles =
    updateContextBuffer[1]
      .match(/<excludeFile path="(.*?)"/gm)
      ?.map((x) => x.replace('<excludeFile path="', '').replace('"', '')) || [];

  const filteredFiles: FileMap = {};
  excludeFiles.forEach((path) => {
    delete contextFiles[path];
  });
  includeFiles.forEach((path) => {
    let fullPath = path;

    if (!path.startsWith('/home/project/')) {
      fullPath = `/home/project/${path}`;
    }

    if (!filePaths.includes(fullPath)) {
      logger.error(`File ${path} is not in the list of files above.`);
      return;

      // throw new Error(`File ${path} is not in the list of files above.`);
    }

    if (currrentFiles.includes(path)) {
      return;
    }

    filteredFiles[path] = files[fullPath];
  });

  if (onFinish) {
    onFinish(resp);
  }

  const totalFiles = Object.keys(filteredFiles).length;
  logger.info(`Total files selected: ${totalFiles}`);

  if (totalFiles == 0) {
    throw new Error(`Bolt failed to select files`);
  }

  /*
   * OPTIMIZATION: Cache the selected context
   * Use 3 minute TTL - shorter than summary since context changes more frequently
   */
  const ttl = 3 * 60 * 1000; // 3 minutes
  cache.set(cacheKey, filteredFiles, ttl);
  logger.info(`Cached context selection (${totalFiles} files) with TTL ${ttl}ms`);

  return filteredFiles;

  // generateText({
}

export function getFilePaths(files: FileMap) {
  let filePaths = Object.keys(files);
  filePaths = filePaths.filter((x) => {
    const relPath = x.replace('/home/project/', '');
    return !ig.ignores(relPath);
  });

  return filePaths;
}

/**
 * Basic heuristic file filtering (fallback when semantic index fails)
 */
function basicFileFiltering(filePaths: string[], maxFiles: number): string[] {
  const priorityExtensions = ['.ts', '.tsx', '.js', '.jsx', '.vue', '.svelte'];

  const scoredFiles = filePaths.map((path) => {
    let score = 0;
    const relativePath = path.replace('/home/project/', '').toLowerCase();

    // Boost source code files
    for (const ext of priorityExtensions) {
      if (relativePath.endsWith(ext)) {
        score += 10;
        break;
      }
    }

    // Boost files in key directories
    if (relativePath.includes('/src/') || relativePath.startsWith('src/')) {
      score += 5;
    }

    if (relativePath.includes('/app/') || relativePath.startsWith('app/')) {
      score += 5;
    }

    // Penalize test files
    if (relativePath.includes('test') || relativePath.includes('spec')) {
      score -= 5;
    }

    return { path, score };
  });

  scoredFiles.sort((a, b) => b.score - a.score);

  return scoredFiles.slice(0, maxFiles).map((f) => f.path);
}
