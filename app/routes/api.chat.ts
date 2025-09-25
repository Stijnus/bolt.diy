import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { createUIMessageStream, createUIMessageStreamResponse, type JSONValue } from 'ai';
import { type FileMap } from '~/lib/.server/llm/constants';
import { streamText, type Messages, type StreamingOptions } from '~/lib/.server/llm/stream-text';
import type { IProviderSetting } from '~/types/model';
import { createScopedLogger } from '~/utils/logger';
import { getFilePaths, selectContext } from '~/lib/.server/llm/select-context';
import type { ContextAnnotation, ProgressAnnotation } from '~/types/context';
import { WORK_DIR } from '~/utils/constants';
import { createSummary } from '~/lib/.server/llm/create-summary';

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
  const { messages, files, promptId, contextOptimization, supabase } = await request.json<{
    messages: Messages;
    files: any;
    promptId?: string;
    contextOptimization: boolean;
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
  let progressCounter = 1;

  try {
    const annotations: JSONValue[] = [];

    const uiStream = createUIMessageStream({
      async execute({ writer }) {
        const writeProgress = (progress: ProgressAnnotation) => {
          writer.write({
            type: 'data-progress',
            data: progress,
          } as any);
        };

        const addAnnotation = (annotation: ContextAnnotation | { type: string; [key: string]: unknown }) => {
          annotations.push(annotation as JSONValue);
          writer.write({
            type: 'message-metadata',
            messageMetadata: { annotations },
          } as any);
        };

        const filePaths = getFilePaths(files || {});
        let filteredFiles: FileMap | undefined = undefined;
        let summary: string | undefined = undefined;

        if (filePaths.length > 0 && contextOptimization) {
          logger.debug('Generating Chat Summary');
          writeProgress({
            type: 'progress',
            label: 'summary',
            status: 'in-progress',
            order: progressCounter++,
            message: 'Analysing Request',
          });

          summary = await createSummary({
            messages: [...messages],
            env: context.cloudflare?.env,
            apiKeys,
            providerSettings,
            promptId,
            contextOptimization,
            onFinish(resp) {
              if (resp.usage) {
                cumulativeUsage.outputTokens += resp.usage.outputTokens || 0;
                cumulativeUsage.inputTokens += resp.usage.inputTokens || 0;
                cumulativeUsage.totalTokens += resp.usage.totalTokens || 0;
              }
            },
          });

          writeProgress({
            type: 'progress',
            label: 'summary',
            status: 'complete',
            order: progressCounter++,
            message: 'Analysis Complete',
          });

          if (summary) {
            addAnnotation({
              type: 'chatSummary',
              summary,
              chatId: messages.slice(-1)?.[0]?.id ?? '',
            });
          }

          logger.debug('Updating Context Buffer');
          writeProgress({
            type: 'progress',
            label: 'context',
            status: 'in-progress',
            order: progressCounter++,
            message: 'Determining Files to Read',
          });

          filteredFiles = await selectContext({
            messages: [...messages],
            env: context.cloudflare?.env,
            apiKeys,
            files,
            providerSettings,
            promptId,
            contextOptimization,
            summary: summary ?? '',
            onFinish(resp) {
              if (resp.usage) {
                cumulativeUsage.outputTokens += resp.usage.outputTokens || 0;
                cumulativeUsage.inputTokens += resp.usage.inputTokens || 0;
                cumulativeUsage.totalTokens += resp.usage.totalTokens || 0;
              }
            },
          });

          if (filteredFiles) {
            logger.debug(`files in context : ${JSON.stringify(Object.keys(filteredFiles))}`);
            addAnnotation({
              type: 'codeContext',
              files: Object.keys(filteredFiles).map((key) => {
                let path = key;

                if (path.startsWith(WORK_DIR)) {
                  path = path.replace(WORK_DIR, '');
                }

                return path;
              }),
            });
          }

          writeProgress({
            type: 'progress',
            label: 'context',
            status: 'complete',
            order: progressCounter++,
            message: 'Code Files Selected',
          });
        }

        const options: StreamingOptions = {
          toolChoice: 'none',
        };

        writeProgress({
          type: 'progress',
          label: 'response',
          status: 'in-progress',
          order: progressCounter++,
          message: 'Generating Response',
        });

        const result = await streamText({
          messages,
          env: context.cloudflare?.env,
          options,
          apiKeys,
          files,
          providerSettings,
          promptId,
          contextOptimization,
          contextFiles: filteredFiles,
          summary,
          supabaseConnection: supabase,
        });

        const usagePromise = result.usage;

        writer.merge(
          result.toUIMessageStream({
            originalMessages: messages,
            onError: (error) => {
              logger.error('Streaming error', error);

              return error instanceof Error ? error.message : 'An error occurred while streaming the response.';
            },
            messageMetadata: () => (annotations.length ? { annotations } : undefined),
          }),
        );

        try {
          const usage = await usagePromise;

          if (usage) {
            cumulativeUsage.outputTokens += usage.outputTokens || 0;
            cumulativeUsage.inputTokens += usage.inputTokens || 0;
            cumulativeUsage.totalTokens += usage.totalTokens || 0;

            addAnnotation({
              type: 'usage',
              value: {
                outputTokens: cumulativeUsage.outputTokens,
                inputTokens: cumulativeUsage.inputTokens,
                totalTokens: cumulativeUsage.totalTokens,
              },
            });
          }
        } catch (error) {
          logger.error('Failed to read usage information', error);
        }

        writeProgress({
          type: 'progress',
          label: 'response',
          status: 'complete',
          order: progressCounter++,
          message: 'Response Generated',
        });
      },
      onError: (error: any) => {
        logger.error('Chat streaming failed', error);

        return error instanceof Error ? error.message : 'An error occurred while handling the request.';
      },
    });

    return createUIMessageStreamResponse({
      stream: uiStream,
      headers: {
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error: any) {
    logger.error(error);

    if (error.message?.includes('API key')) {
      throw new Response('Invalid or missing API key', {
        status: 401,
        statusText: 'Unauthorized',
      });
    }

    throw new Response(null, {
      status: 500,
      statusText: 'Internal Server Error',
    });
  }
}
