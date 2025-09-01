import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { streamText } from '~/lib/.server/llm/stream-text';
import type { IProviderSetting, ProviderInfo } from '~/types/model';
import { generateText } from 'ai';
import { PROVIDER_LIST } from '~/utils/constants';
import { MAX_TOKENS_FALLBACK, PROVIDER_COMPLETION_LIMITS, isReasoningModel } from '~/lib/.server/llm/constants';
import { ModelCapabilityService } from '~/lib/.server/llm/model-capability-service';
import { LLMManager } from '~/lib/modules/llm/manager';
import type { ModelInfo } from '~/lib/modules/llm/types';
import { getApiKeysFromCookie, getProviderSettingsFromCookie } from '~/lib/api/cookies';
import { createScopedLogger } from '~/utils/logger';

export async function action(args: ActionFunctionArgs) {
  return llmCallAction(args);
}

async function getModelList(options: {
  apiKeys?: Record<string, string>;
  providerSettings?: Record<string, IProviderSetting>;
  serverEnv?: Record<string, string>;
}) {
  const llmManager = LLMManager.getInstance(import.meta.env);
  return llmManager.updateModelList(options);
}

const logger = createScopedLogger('api.llmcall');

async function getCompletionTokenLimit(
  modelDetails: ModelInfo,
  options: {
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
    serverEnv?: Record<string, string>;
  },
): Promise<number> {
  try {
    // Use ModelCapabilityService for dynamic, accurate limits
    const capabilityService = ModelCapabilityService.getInstance();
    const limits = await capabilityService.getSafeTokenLimits(modelDetails, options);

    return limits.maxCompletionTokens;
  } catch (error) {
    logger.warn(`Failed to get dynamic token limits for ${modelDetails.name}, using fallback:`, error);

    // Fallback to legacy logic with conservative limits
    if (modelDetails.maxCompletionTokens && modelDetails.maxCompletionTokens > 0) {
      return modelDetails.maxCompletionTokens;
    }

    const providerDefault = PROVIDER_COMPLETION_LIMITS[modelDetails.provider];

    if (providerDefault) {
      return providerDefault;
    }

    return Math.min(MAX_TOKENS_FALLBACK, 8192); // Very conservative fallback
  }
}

async function validateTokenLimits(
  modelDetails: ModelInfo,
  requestedTokens: number,
  options: {
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
    serverEnv?: Record<string, string>;
  },
): Promise<{ valid: boolean; error?: string }> {
  try {
    // Use ModelCapabilityService for dynamic validation
    const capabilityService = ModelCapabilityService.getInstance();
    const validation = await capabilityService.validateTokenRequest(modelDetails, requestedTokens, options);

    return {
      valid: validation.valid,
      error: validation.error,
    };
  } catch (error) {
    logger.warn(`Failed to validate token limits for ${modelDetails.name}, using fallback validation:`, error);

    // Fallback validation
    const modelMaxTokens = modelDetails.maxTokenAllowed || 128000;
    const maxCompletionTokens = await getCompletionTokenLimit(modelDetails, options);

    if (requestedTokens > modelMaxTokens) {
      return {
        valid: false,
        error: `Requested tokens (${requestedTokens}) exceed model's context window (${modelMaxTokens}). Please reduce your request size.`,
      };
    }

    if (requestedTokens > maxCompletionTokens) {
      return {
        valid: false,
        error: `Requested tokens (${requestedTokens}) exceed model's completion limit (${maxCompletionTokens}). Consider using a model with higher token limits.`,
      };
    }

    return { valid: true };
  }
}

async function llmCallAction({ context, request }: ActionFunctionArgs) {
  const { system, message, model, provider, streamOutput } = await request.json<{
    system: string;
    message: string;
    model: string;
    provider: ProviderInfo;
    streamOutput?: boolean;
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

  if (streamOutput) {
    try {
      const result = await streamText({
        options: {
          system,
        },
        messages: [
          {
            role: 'user',
            content: `${message}`,
          },
        ],
        env: context.cloudflare?.env as any,
        apiKeys,
        providerSettings,
      });

      return new Response(result.textStream, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        },
      });
    } catch (error: unknown) {
      console.log(error);

      if (error instanceof Error && error.message?.includes('API key')) {
        throw new Response('Invalid or missing API key', {
          status: 401,
          statusText: 'Unauthorized',
        });
      }

      // Handle token limit errors with helpful messages
      if (
        error instanceof Error &&
        (error.message?.includes('max_tokens') ||
          error.message?.includes('token') ||
          error.message?.includes('exceeds') ||
          error.message?.includes('maximum'))
      ) {
        throw new Response(
          `Token limit error: ${error.message}. Try reducing your request size or using a model with higher token limits.`,
          {
            status: 400,
            statusText: 'Token Limit Exceeded',
          },
        );
      }

      throw new Response(null, {
        status: 500,
        statusText: 'Internal Server Error',
      });
    }
  } else {
    try {
      const models = await getModelList({ apiKeys, providerSettings, serverEnv: context.cloudflare?.env as any });
      const modelDetails = models.find((m: ModelInfo) => m.name === model);

      if (!modelDetails) {
        throw new Error('Model not found');
      }

      const dynamicMaxTokens = modelDetails
        ? await getCompletionTokenLimit(modelDetails, {
            apiKeys,
            providerSettings,
            serverEnv: context.cloudflare?.env as any,
          })
        : Math.min(MAX_TOKENS_FALLBACK, 8192);

      // Validate token limits before making API request
      const validation = await validateTokenLimits(modelDetails, dynamicMaxTokens, {
        apiKeys,
        providerSettings,
        serverEnv: context.cloudflare?.env as any,
      });

      if (!validation.valid) {
        throw new Response(validation.error, {
          status: 400,
          statusText: 'Token Limit Exceeded',
        });
      }

      const providerInfo = PROVIDER_LIST.find((p) => p.name === provider.name);

      if (!providerInfo) {
        throw new Error('Provider not found');
      }

      logger.info(`Generating response Provider: ${provider.name}, Model: ${modelDetails.name}`);

      // DEBUG: Log reasoning model detection
      const isReasoning = isReasoningModel(modelDetails.name);
      logger.info(`DEBUG: Model "${modelDetails.name}" detected as reasoning model: ${isReasoning}`);

      // Use maxCompletionTokens for reasoning models (o1, GPT-5), maxTokens for traditional models
      const tokenParams = isReasoning ? { maxCompletionTokens: dynamicMaxTokens } : { maxTokens: dynamicMaxTokens };

      // Filter out unsupported parameters for reasoning models
      const baseParams = {
        system,
        messages: [
          {
            role: 'user' as const,
            content: `${message}`,
          },
        ],
        model: providerInfo.getModelInstance({
          model: modelDetails.name,
          serverEnv: context.cloudflare?.env as any,
          apiKeys,
          providerSettings,
        }),
        ...tokenParams,
        toolChoice: 'none' as const,
      };

      // For reasoning models, set temperature to 1 (required by OpenAI API)
      const finalParams = isReasoning
        ? { ...baseParams, temperature: 1 } // Set to 1 for reasoning models (only supported value)
        : { ...baseParams, temperature: 0 };

      // DEBUG: Log final parameters
      logger.info(
        `DEBUG: Final params for model "${modelDetails.name}":`,
        JSON.stringify(
          {
            isReasoning,
            hasTemperature: 'temperature' in finalParams,
            hasMaxTokens: 'maxTokens' in finalParams,
            hasMaxCompletionTokens: 'maxCompletionTokens' in finalParams,
            paramKeys: Object.keys(finalParams).filter((key) => !['model', 'messages', 'system'].includes(key)),
            tokenParams,
            finalParams: Object.fromEntries(
              Object.entries(finalParams).filter(([key]) => !['model', 'messages', 'system'].includes(key)),
            ),
          },
          null,
          2,
        ),
      );

      const result = await generateText(finalParams);
      logger.info(`Generated response`);

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (error: unknown) {
      console.log(error);

      const errorResponse = {
        error: true,
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
        statusCode: (error as any).statusCode || 500,
        isRetryable: (error as any).isRetryable !== false,
        provider: (error as any).provider || 'unknown',
      };

      if (error instanceof Error && error.message?.includes('API key')) {
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

      // Handle token limit errors with helpful messages
      if (
        error instanceof Error &&
        (error.message?.includes('max_tokens') ||
          error.message?.includes('token') ||
          error.message?.includes('exceeds') ||
          error.message?.includes('maximum'))
      ) {
        return new Response(
          JSON.stringify({
            ...errorResponse,
            message: `Token limit error: ${error.message}. Try reducing your request size or using a model with higher token limits.`,
            statusCode: 400,
            isRetryable: false,
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
            statusText: 'Token Limit Exceeded',
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
}
