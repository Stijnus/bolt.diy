import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { streamText } from '~/lib/.server/llm/stream-text';
import { stripIndents } from '~/utils/stripIndent';
import type { ProviderInfo } from '~/types/model';
import { getApiKeysFromCookie, getProviderSettingsFromCookie } from '~/lib/api/cookies';
import { createScopedLogger } from '~/utils/logger';

export async function action(args: ActionFunctionArgs) {
  return enhancerAction(args);
}

const logger = createScopedLogger('api.enhancher');

async function enhancerAction({ context, request }: ActionFunctionArgs) {
  const { message, model, provider } = await request.json<{
    message: string;
    model: string;
    provider: ProviderInfo;
    apiKeys?: Record<string, string>;
  }>();

  const { name: providerName } = provider;

  // validate 'model' and 'provider' fields
  if (!model || typeof model !== 'string') {
    throw new Response('Invalid or missing model', {
      status: 400,
      statusText: 'Bad Request',
    });
  }

  if (!providerName || typeof providerName !== 'string') {
    throw new Response('Invalid or missing provider', {
      status: 400,
      statusText: 'Bad Request',
    });
  }

  const cookieHeader = request.headers.get('Cookie');
  const apiKeys = getApiKeysFromCookie(cookieHeader);
  const providerSettings = getProviderSettingsFromCookie(cookieHeader);

  // Validate API key for the specified provider
  if (!apiKeys || typeof apiKeys !== 'object') {
    throw new Response('No API keys configured. Please set up your LLM provider API keys in the settings.', {
      status: 401,
      statusText: 'Unauthorized',
    });
  }

  // Check if the provider has an API key configured
  const providerApiKey = apiKeys[providerName];

  if (!providerApiKey || providerApiKey.trim() === '') {
    throw new Response(
      `No API key configured for provider "${providerName}". Please add your ${providerName} API key in the settings.`,
      {
        status: 401,
        statusText: 'Unauthorized',
      },
    );
  }

  try {
    const result = await streamText({
      messages: [
        {
          role: 'user',
          content:
            `[Model: ${model}]\n\n[Provider: ${providerName}]\n\n` +
            stripIndents`
            You are a professional prompt engineer specializing in crafting precise, effective prompts.
            Your task is to enhance prompts by making them more specific, actionable, and effective.

            I want you to improve the user prompt that is wrapped in \`<original_prompt>\` tags.

            For valid prompts:
            - Make instructions explicit and unambiguous
            - Add relevant context and constraints
            - Remove redundant information
            - Maintain the core intent
            - Ensure the prompt is self-contained
            - Use professional language

            For invalid or unclear prompts:
            - Respond with clear, professional guidance
            - Keep responses concise and actionable
            - Maintain a helpful, constructive tone
            - Focus on what the user should provide
            - Use a standard template for consistency

            IMPORTANT: Your response must ONLY contain the enhanced prompt text.
            Do not include any explanations, metadata, or wrapper tags.

            <original_prompt>
              ${message}
            </original_prompt>
          `,
        },
      ],
      env: context.cloudflare?.env as any,
      apiKeys,
      providerSettings,
      options: {
        system:
          'You are a senior software principal architect, you should help the user analyse the user query and enrich it with the necessary context and constraints to make it more specific, actionable, and effective. You should also ensure that the prompt is self-contained and uses professional language. Your response should ONLY contain the enhanced prompt text. Do not include any explanations, metadata, or wrapper tags.',

        /*
         * onError: (event) => {
         *   throw new Response(null, {
         *     status: 500,
         *     statusText: 'Internal Server Error',
         *   });
         * }
         */
      },
    });

    // Handle streaming errors in a non-blocking way
    (async () => {
      try {
        for await (const part of result.fullStream) {
          if (part.type === 'error') {
            const error: any = part.error;
            logger.error('Streaming error:', error);
            break;
          }
        }
      } catch (error) {
        logger.error('Error processing stream:', error);
      }
    })();

    // Validate that we have a valid stream
    if (!result.textStream) {
      throw new Error('Failed to get response stream from LLM provider');
    }

    // Return the text stream directly since it's already text data
    return new Response(result.textStream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        Connection: 'keep-alive',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no', // Disable proxy buffering
      },
    });
  } catch (error: unknown) {
    console.error('Enhancer API error:', error);

    if (error instanceof Error) {
      const errorMessage = error.message;

      // Handle specific error types with helpful messages
      if (errorMessage.includes('API key') || errorMessage.includes('auth')) {
        throw new Response(`Authentication failed: ${errorMessage}`, {
          status: 401,
          statusText: 'Unauthorized',
        });
      }

      if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
        throw new Response('Rate limit exceeded. Please try again in a few minutes.', {
          status: 429,
          statusText: 'Too Many Requests',
        });
      }

      if (errorMessage.includes('timeout') || errorMessage.includes('network')) {
        throw new Response('Request timeout or network error. Please try again.', {
          status: 408,
          statusText: 'Request Timeout',
        });
      }

      if (errorMessage.includes('quota') || errorMessage.includes('billing')) {
        throw new Response('Provider quota exceeded or billing issue. Please check your account.', {
          status: 402,
          statusText: 'Payment Required',
        });
      }

      // Generic error with message
      throw new Response(`Enhancement failed: ${errorMessage}`, {
        status: 500,
        statusText: 'Internal Server Error',
      });
    }

    // Unknown error type
    throw new Response('An unexpected error occurred. Please try again.', {
      status: 500,
      statusText: 'Internal Server Error',
    });
  }
}
