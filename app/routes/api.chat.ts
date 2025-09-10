import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { createUIMessageStream, createUIMessageStreamResponse, createIdGenerator } from 'ai';
import { MAX_RESPONSE_SEGMENTS, MAX_TOKENS, type FileMap } from '~/lib/.server/llm/constants';
import { createSummary } from '~/lib/.server/llm/create-summary';
import { getFilePaths, selectContext } from '~/lib/.server/llm/select-context';
import { StreamRecoveryManager } from '~/lib/.server/llm/stream-recovery';
import { streamText, type UIMessages, type StreamingOptions } from '~/lib/.server/llm/stream-text';
import { extractPropertiesFromMessage } from '~/lib/.server/llm/utils';
import { CONTINUE_PROMPT } from '~/lib/common/prompts/prompts';
import { MCPService } from '~/lib/services/mcpService';

// Unused imports removed for cleanup
import type { DesignScheme } from '~/types/design-scheme';
import type { IProviderSetting } from '~/types/model';
import { WORK_DIR } from '~/utils/constants';
import { createScopedLogger } from '~/utils/logger';

export async function action(args: ActionFunctionArgs) {
  return chatAction(args);
}

const logger = createScopedLogger('api.chat');

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};

  const items = cookieHeader.split(';').map((cookie) => cookie.trim());

  items.forEach((item) => {
    const [name, ...rest] = item.split('=');

    if (name && rest) {
      const decodedName = decodeURIComponent(name.trim());
      const decodedValue = decodeURIComponent(rest.join('=').trim());
      cookies[decodedName] = decodedValue;
    }
  });

  return cookies;
}

async function chatAction({ context, request }: ActionFunctionArgs) {
  const streamRecovery = new StreamRecoveryManager({
    timeout: 45000,
    maxRetries: 2,
    onTimeout: () => {
      logger.warn('Stream timeout - attempting recovery');
    },
  });

  const { messages, files, promptId, contextOptimization, supabase, chatMode, designScheme } = await request.json<{
    messages: UIMessages;
    files: any;
    promptId?: string;
    contextOptimization: boolean;
    chatMode: 'discuss' | 'build';
    designScheme?: DesignScheme;
    supabase?: {
      isConnected: boolean;
      hasSelectedProject: boolean;
      credentials?: {
        anonKey?: string;
        supabaseUrl?: string;
      };
    };
  }>();

  const cookieHeader = request.headers.get('Cookie');
  const apiKeys = JSON.parse(parseCookies(cookieHeader || '').apiKeys || '{}');

  const providerSettings: Record<string, IProviderSetting> = JSON.parse(
    parseCookies(cookieHeader || '').providers || '{}',
  );

  const cumulativeUsage = {
    outputTokens: 0,
    inputTokens: 0,
    totalTokens: 0,
  };

  const encoder: TextEncoder = new TextEncoder();

  let progressCounter: number = 1;

  try {
    const mcpService = MCPService.getInstance();
    const generateId = createIdGenerator({ size: 16 });

    const totalMessageContent = messages.reduce((acc, message) => {
      const textContent =
        message.parts
          ?.filter((part) => part.type === 'text')
          .map((part) => part.text)
          .join('') || '';
      return acc + textContent;
    }, '');
    logger.debug(`Total message length: ${totalMessageContent.split(' ').length}, words`);

    // Removed unused lastChunk variable

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        streamRecovery.startMonitoring();

        const filePaths = getFilePaths(files || {});

        let filteredFiles: FileMap | undefined = undefined;
        let summary: string | undefined = undefined;
        let messageSliceId = 0;

        const processedMessages = await mcpService.processToolInvocations(messages, writer);

        if (processedMessages.length > 3) {
          messageSliceId = processedMessages.length - 3;
        }

        if (filePaths.length > 0 && contextOptimization) {
          logger.debug('Generating Chat Summary');
          writer.write({
            type: 'data-progress',
            data: {
              label: 'summary',
              status: 'in-progress',
              order: progressCounter++,
              message: 'Analysing Request',
            },
          });

          // Create a summary of the chat
          console.log(`Messages count: ${processedMessages.length}`);

          summary = await createSummary({
            messages: [...processedMessages],
            env: context.cloudflare?.env,
            apiKeys,
            providerSettings,
            promptId,
            contextOptimization,
            onFinish(resp) {
              if (resp.usage) {
                logger.debug('createSummary token usage', JSON.stringify(resp.usage));
                cumulativeUsage.outputTokens += resp.usage.outputTokens || 0;
                cumulativeUsage.inputTokens += resp.usage.inputTokens || 0;
                cumulativeUsage.totalTokens += resp.usage.totalTokens || 0;
              }
            },
          });
          writer.write({
            type: 'data-progress',
            data: {
              label: 'summary',
              status: 'complete',
              order: progressCounter++,
              message: 'Analysis Complete',
            },
          });

          writer.write({
            type: 'data-chatSummary',
            data: {
              summary,
              chatId: processedMessages.slice(-1)?.[0]?.id,
            },
          });

          // Update context buffer
          logger.debug('Updating Context Buffer');
          writer.write({
            type: 'data-progress',
            data: {
              label: 'context',
              status: 'in-progress',
              order: progressCounter++,
              message: 'Determining Files to Read',
            },
          });

          // Select context files
          console.log(`Messages count: ${processedMessages.length}`);
          filteredFiles = await selectContext({
            messages: [...processedMessages],
            env: context.cloudflare?.env,
            apiKeys,
            files,
            providerSettings,
            promptId,
            contextOptimization,
            summary,
            onFinish(resp) {
              if (resp.usage) {
                logger.debug('selectContext token usage', JSON.stringify(resp.usage));
                cumulativeUsage.outputTokens += resp.usage.outputTokens || 0;
                cumulativeUsage.inputTokens += resp.usage.inputTokens || 0;
                cumulativeUsage.totalTokens += resp.usage.totalTokens || 0;
              }
            },
          });

          if (filteredFiles) {
            logger.debug(`files in context : ${JSON.stringify(Object.keys(filteredFiles))}`);
          }

          writer.write({
            type: 'data-codeContext',
            data: {
              files: Object.keys(filteredFiles).map((key) => {
                let path = key;

                if (path.startsWith(WORK_DIR)) {
                  path = path.replace(WORK_DIR, '');
                }

                return path;
              }),
            },
          });

          writer.write({
            type: 'data-progress',
            data: {
              label: 'context',
              status: 'complete',
              order: progressCounter++,
              message: 'Code Files Selected',
            },
          });

          // logger.debug('Code Files Selected');
        }

        const options: StreamingOptions = {
          supabaseConnection: supabase,
          toolChoice: 'auto',
          tools: mcpService.toolsWithoutExecute,
          onStepFinish: ({ toolCalls }) => {
            // add tool call annotations for frontend processing
            toolCalls.forEach((toolCall) => {
              mcpService.processToolCall(toolCall, writer);
            });
          },
          onFinish: async ({ text: content, finishReason, usage }) => {
            logger.debug('usage', JSON.stringify(usage));

            if (usage) {
              cumulativeUsage.outputTokens += usage.outputTokens || 0;
              cumulativeUsage.inputTokens += usage.inputTokens || 0;
              cumulativeUsage.totalTokens += usage.totalTokens || 0;
            }

            if (finishReason !== 'length') {
              writer.write({
                type: 'data-usage',
                data: {
                  outputTokens: cumulativeUsage.outputTokens,
                  inputTokens: cumulativeUsage.inputTokens,
                  totalTokens: cumulativeUsage.totalTokens,
                },
              });
              writer.write({
                type: 'data-progress',
                data: {
                  label: 'response',
                  status: 'complete',
                  order: progressCounter++,
                  message: 'Response Generated',
                },
              });
              await new Promise((resolve) => setTimeout(resolve, 0));

              // stream.close();
              return;
            }

            if (stream.switches >= MAX_RESPONSE_SEGMENTS) {
              throw Error('Cannot continue message: Maximum segments reached');
            }

            const switchesLeft = MAX_RESPONSE_SEGMENTS - stream.switches;

            logger.info(`Reached max token limit (${MAX_TOKENS}): Continuing message (${switchesLeft} switches left)`);

            const lastUserMessage = processedMessages.filter((x) => x.role == 'user').slice(-1)[0];
            const { model, provider } = extractPropertiesFromMessage(lastUserMessage);
            processedMessages.push({ id: generateId(), role: 'assistant', content });
            processedMessages.push({
              id: generateId(),
              role: 'user',
              content: `[Model: ${model}]\n\n[Provider: ${provider}]\n\n${CONTINUE_PROMPT}`,
            });

            const result = await streamText({
              messages: [...processedMessages],
              env: context.cloudflare?.env,
              options,
              apiKeys,
              files,
              providerSettings,
              promptId,
              contextOptimization,
              contextFiles: filteredFiles,
              chatMode,
              designScheme,
              summary,
              messageSliceId,
            });

            writer.merge(result.toUIMessageStream());

            /*
             * COMMENTED OUT: This async fullStream processing may be interfering with the main stream
             * (async () => {
             *   for await (const part of result.fullStream) {
             *     if (part.type === 'error') {
             *       const error: any = part.error;
             *       logger.error(`${error}`);
             *       return;
             *     }
             *   }
             * })();
             */

            return;
          },
        };

        writer.write({
          type: 'data-progress',
          data: {
            label: 'response',
            status: 'in-progress',
            order: progressCounter++,
            message: 'Generating Response',
          },
        });

        const result = await streamText({
          messages: [...processedMessages],
          env: context.cloudflare?.env,
          options,
          apiKeys,
          files,
          providerSettings,
          promptId,
          contextOptimization,
          contextFiles: filteredFiles,
          chatMode,
          designScheme,
          summary,
          messageSliceId,
        });

        /*
         * COMMENTED OUT: This async fullStream processing may be interfering with the main stream
         * The toUIMessageStream() should handle this internally
         * (async () => {
         *   let partCount = 0;
         *   for await (const part of result.fullStream) {
         *     partCount++;
         *     streamRecovery.updateActivity();
         *
         *     logger.info(`DEBUG STREAM: Processing fullStream part ${partCount}, type: ${part.type}`);
         */

        /*
         *     if (part.type === 'error') {
         *       const error: any = part.error;
         *       logger.error('Streaming error:', error);
         *       streamRecovery.stop();
         */

        /*
         *       // Enhanced error handling for common streaming issues
         *       if (error.message?.includes('Invalid JSON response')) {
         *         logger.error('Invalid JSON response detected - likely malformed API response');
         *       } else if (error.message?.includes('token')) {
         *         logger.error('Token-related error detected - possible token limit exceeded');
         *       }
         */

        /*
         *       return;
         *     }
         *
         *     if (part.type === 'text-delta' && part.textDelta) {
         *       logger.info(`DEBUG STREAM: fullStream text-delta length: ${part.textDelta.length}, content: "${part.textDelta.substring(0, 100)}${part.textDelta.length > 100 ? '...' : ''}"`);
         *     }
         *   }
         *   logger.info(`DEBUG STREAM: fullStream processing completed, total parts: ${partCount}`);
         *   streamRecovery.stop();
         * })();
         */

        streamRecovery.stop(); // Stop monitoring since we're not manually processing fullStream
        writer.merge(result.toUIMessageStream());
      },
      onError: (error: any) => {
        // Provide more specific error messages for common issues
        const errorMessage = error.message || 'Unknown error';

        if (errorMessage.includes('model') && errorMessage.includes('not found')) {
          return 'Custom error: Invalid model selected. Please check that the model name is correct and available.';
        }

        if (errorMessage.includes('Invalid JSON response')) {
          return 'Custom error: The AI service returned an invalid response. This may be due to an invalid model name, API rate limiting, or server issues. Try selecting a different model or check your API key.';
        }

        if (
          errorMessage.includes('API key') ||
          errorMessage.includes('unauthorized') ||
          errorMessage.includes('authentication')
        ) {
          return 'Custom error: Invalid or missing API key. Please check your API key configuration.';
        }

        if (errorMessage.includes('token') && errorMessage.includes('limit')) {
          return 'Custom error: Token limit exceeded. The conversation is too long for the selected model. Try using a model with larger context window or start a new conversation.';
        }

        if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
          return 'Custom error: API rate limit exceeded. Please wait a moment before trying again.';
        }

        if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
          return 'Custom error: Network error. Please check your internet connection and try again.';
        }

        return `Custom error: ${errorMessage}`;
      },
    }).pipeThrough(
      new TransformStream({
        transform: (chunk, controller) => {
          /*
           * SIMPLIFIED: Pass through chunks without complex transformations
           * This prevents content corruption that was happening with the previous
           * complex chunking logic that assumed specific AI SDK v4 format
           */
          const str = typeof chunk === 'string' ? chunk : JSON.stringify(chunk);
          controller.enqueue(encoder.encode(str));

          /*
           * COMMENTED OUT: Complex chunk transformation that may be corrupting content
           * if (!lastChunk) {
           *   lastChunk = ' ';
           * }
           * if (typeof chunk === 'string') {
           *   if (chunk.startsWith('g') && !lastChunk.startsWith('g')) {
           *     logger.info(`DEBUG TRANSFORM: Adding __boltThought__ opening div`);
           *     controller.enqueue(encoder.encode(`0: "<div class=\\"__boltThought__\\">"\n`));
           *   }
           *   if (lastChunk.startsWith('g') && !chunk.startsWith('g')) {
           *     logger.info(`DEBUG TRANSFORM: Adding __boltThought__ closing div`);
           *     controller.enqueue(encoder.encode(`0: "</div>\\n"\n`));
           *   }
           * }
           * lastChunk = chunk;
           * let transformedChunk = chunk;
           * if (typeof chunk === 'string' && chunk.startsWith('g')) {
           *   let content = chunk.split(':').slice(1).join(':');
           *   if (content.endsWith('\n')) {
           *     content = content.slice(0, content.length - 1);
           *   }
           *   transformedChunk = `0:${content}\n`;
           *   logger.info(`DEBUG TRANSFORM: Transformed 'g' chunk from "${chunk.substring(0, 50)}..." to "${transformedChunk.substring(0, 50)}..."`);
           * }
           */
        },
      }),
    );

    return createUIMessageStreamResponse({ stream });
  } catch (error: any) {
    logger.error(error);

    const errorResponse = {
      error: true,
      message: error.message || 'An unexpected error occurred',
      statusCode: error.statusCode || 500,
      isRetryable: error.isRetryable !== false, // Default to retryable unless explicitly false
      provider: error.provider || 'unknown',
    };

    if (error.message?.includes('API key')) {
      return new Response(
        JSON.stringify({
          ...errorResponse,
          message: 'Invalid or missing API key',
          statusCode: 401,
          isRetryable: false,
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
          statusText: 'Unauthorized',
        },
      );
    }

    return new Response(JSON.stringify(errorResponse), {
      status: errorResponse.statusCode,
      headers: { 'Content-Type': 'application/json' },
      statusText: 'Error',
    });
  }
}
