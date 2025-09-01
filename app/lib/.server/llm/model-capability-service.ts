import { createScopedLogger } from '~/utils/logger';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import { getModelCapabilityFromDatabase, areCapabilitiesStale } from './model-database';

const logger = createScopedLogger('model-capability-service');

export interface ModelCapabilities {
  name: string;
  provider: string;
  maxInputTokens: number;
  maxOutputTokens: number;
  contextWindow: number;
  supportsSystemPrompt: boolean;
  supportsTools: boolean;
  isReasoning: boolean;
  lastUpdated: number;
}

// Provider-specific capability detection strategies
const PROVIDER_CAPABILITY_DETECTORS = {
  Anthropic: {
    apiEndpoint: 'https://api.anthropic.com/v1/models',
    getHeaders: (apiKey: string) => ({
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    }),
    parseCapabilities: (data: any[]): ModelCapabilities[] => {
      return data
        .filter((model: any) => model.type === 'model')
        .map((model: any) => {
          // Known Anthropic model limits based on API documentation
          const limits = getAnthropicModelLimits(model.id);
          return {
            name: model.id,
            provider: 'Anthropic',
            maxInputTokens: limits.maxInputTokens,
            maxOutputTokens: limits.maxOutputTokens,
            contextWindow: limits.contextWindow,
            supportsSystemPrompt: true,
            supportsTools: true,
            isReasoning: false,
            lastUpdated: Date.now(),
          };
        });
    },
  },

  OpenAI: {
    apiEndpoint: 'https://api.openai.com/v1/models',
    getHeaders: (apiKey: string) => ({
      Authorization: `Bearer ${apiKey}`,
    }),
    parseCapabilities: (data: any[]): ModelCapabilities[] => {
      return data
        .filter((model: any) => model.object === 'model')
        .map((model: any) => {
          const limits = getOpenAIModelLimits(model.id);
          return {
            name: model.id,
            provider: 'OpenAI',
            maxInputTokens: limits.maxInputTokens,
            maxOutputTokens: limits.maxOutputTokens,
            contextWindow: limits.contextWindow,
            supportsSystemPrompt: true,
            supportsTools: !isReasoningModel(model.id),
            isReasoning: isReasoningModel(model.id),
            lastUpdated: Date.now(),
          };
        });
    },
  },

  Google: {
    apiEndpoint: null, // Google doesn't have a models endpoint, use static detection
    parseCapabilities: null,
  },

  // Add more providers as needed
};

// Known model capability mappings based on official documentation
function getAnthropicModelLimits(modelId: string): {
  maxInputTokens: number;
  maxOutputTokens: number;
  contextWindow: number;
} {
  // Claude 3 Haiku
  if (modelId.includes('claude-3-haiku')) {
    return { maxInputTokens: 200000, maxOutputTokens: 4096, contextWindow: 200000 };
  }

  // Claude 3.5 Haiku - CORRECTED: 8192 tokens, not unlimited
  if (modelId.includes('claude-3-5-haiku')) {
    return { maxInputTokens: 200000, maxOutputTokens: 8192, contextWindow: 200000 };
  }

  // Claude 3.5 Sonnet
  if (modelId.includes('claude-3-5-sonnet')) {
    return { maxInputTokens: 200000, maxOutputTokens: 8192, contextWindow: 200000 };
  }

  // Claude 3.7 Sonnet (newer models)
  if (modelId.includes('claude-3-7-sonnet') || modelId.includes('claude-sonnet-4')) {
    return { maxInputTokens: 200000, maxOutputTokens: 32000, contextWindow: 200000 };
  }

  // Claude 4 Opus
  if (modelId.includes('claude-opus-4')) {
    return { maxInputTokens: 200000, maxOutputTokens: 32000, contextWindow: 200000 };
  }

  // Conservative defaults for unknown Claude models
  return { maxInputTokens: 200000, maxOutputTokens: 4096, contextWindow: 200000 };
}

function getOpenAIModelLimits(modelId: string): {
  maxInputTokens: number;
  maxOutputTokens: number;
  contextWindow: number;
} {
  // o1 models (reasoning) - check first to avoid conflicts
  if (modelId.includes('o1-mini')) {
    return { maxInputTokens: 128000, maxOutputTokens: 65536, contextWindow: 128000 };
  }

  if (modelId.includes('o1-preview')) {
    return { maxInputTokens: 128000, maxOutputTokens: 32768, contextWindow: 128000 };
  }

  // GPT-4o models - check mini first to avoid conflicts
  if (modelId.includes('gpt-4o-mini')) {
    return { maxInputTokens: 128000, maxOutputTokens: 16384, contextWindow: 128000 };
  }

  if (modelId.includes('gpt-4o')) {
    return { maxInputTokens: 128000, maxOutputTokens: 16384, contextWindow: 128000 };
  }

  // GPT-4 Turbo
  if (modelId.includes('gpt-4-turbo')) {
    return { maxInputTokens: 128000, maxOutputTokens: 4096, contextWindow: 128000 };
  }

  // GPT-3.5 Turbo
  if (modelId.includes('gpt-3.5-turbo')) {
    return { maxInputTokens: 16385, maxOutputTokens: 4096, contextWindow: 16385 };
  }

  // Conservative defaults
  return { maxInputTokens: 128000, maxOutputTokens: 4096, contextWindow: 128000 };
}

function isReasoningModel(modelId: string): boolean {
  return /^(o1|o3|gpt-5)/i.test(modelId);
}

// In-memory cache with TTL
class ModelCapabilityCache {
  private _cache = new Map<string, { data: ModelCapabilities; expiry: number }>();
  private readonly _ttl = 1000 * 60 * 60; // 1 hour

  set(key: string, data: ModelCapabilities): void {
    this._cache.set(key, {
      data: { ...data, lastUpdated: Date.now() },
      expiry: Date.now() + this._ttl,
    });
  }

  get(key: string): ModelCapabilities | null {
    const entry = this._cache.get(key);

    if (!entry || Date.now() > entry.expiry) {
      this._cache.delete(key);
      return null;
    }

    return entry.data;
  }

  clear(): void {
    this._cache.clear();
  }
}

class ModelCapabilityService {
  private static _instance: ModelCapabilityService;
  private _cache = new ModelCapabilityCache();

  static getInstance(): ModelCapabilityService {
    if (!ModelCapabilityService._instance) {
      ModelCapabilityService._instance = new ModelCapabilityService();
    }

    return ModelCapabilityService._instance;
  }

  /**
   * Get model capabilities with smart 4-tier fallback strategies
   */
  async getModelCapabilities(
    model: ModelInfo,
    options: {
      apiKeys?: Record<string, string>;
      providerSettings?: Record<string, IProviderSetting>;
      serverEnv?: Record<string, string>;
    },
  ): Promise<ModelCapabilities> {
    const cacheKey = `${model.provider}:${model.name}`;

    // Check cache first
    const cached = this._cache.get(cacheKey);

    if (cached) {
      logger.info(`Using cached capabilities for ${model.name}`);
      return cached;
    }

    // Tier 1: Try to get dynamic capabilities from provider API
    try {
      const capabilities = await this._fetchProviderCapabilities(model, options);

      if (capabilities) {
        this._cache.set(cacheKey, capabilities);
        logger.info(`Fetched dynamic capabilities for ${model.name}`);

        return capabilities;
      }
    } catch (error) {
      logger.warn(`Failed to fetch dynamic capabilities for ${model.name}:`, error);
    }

    // Tier 2: Check curated model database
    const databaseEntry = getModelCapabilityFromDatabase(model.name);

    if (databaseEntry && !areCapabilitiesStale(databaseEntry)) {
      const dbCapabilities: ModelCapabilities = {
        name: databaseEntry.name,
        provider: databaseEntry.provider,
        maxInputTokens: databaseEntry.maxInputTokens,
        maxOutputTokens: databaseEntry.maxOutputTokens,
        contextWindow: databaseEntry.contextWindow,
        supportsSystemPrompt: databaseEntry.supportsSystemPrompt,
        supportsTools: databaseEntry.supportsTools,
        isReasoning: databaseEntry.isReasoning,
        lastUpdated: Date.now(),
      };

      this._cache.set(cacheKey, dbCapabilities);
      logger.info(`Using database capabilities for ${model.name}`);

      return dbCapabilities;
    }

    // Tier 3: Provider-specific static detection
    const staticCapabilities = this._getStaticCapabilities(model);
    logger.info(`Using provider-specific static capabilities for ${model.name}`);

    return staticCapabilities;
  }

  /**
   * Get safe token limits for API calls
   */
  async getSafeTokenLimits(
    model: ModelInfo,
    options: {
      apiKeys?: Record<string, string>;
      providerSettings?: Record<string, IProviderSetting>;
      serverEnv?: Record<string, string>;
    },
  ): Promise<{ maxTokens: number; maxCompletionTokens: number }> {
    const capabilities = await this.getModelCapabilities(model, options);

    // Apply safety margins (10% buffer for safety)
    const safetyMargin = 0.9;
    const maxCompletionTokens = Math.floor(capabilities.maxOutputTokens * safetyMargin);

    return {
      maxTokens: isReasoningModel(model.name) ? capabilities.maxInputTokens : maxCompletionTokens,
      maxCompletionTokens,
    };
  }

  /**
   * Validate if requested tokens are within model limits
   */
  async validateTokenRequest(
    model: ModelInfo,
    requestedTokens: number,
    options: {
      apiKeys?: Record<string, string>;
      providerSettings?: Record<string, IProviderSetting>;
      serverEnv?: Record<string, string>;
    },
  ): Promise<{ valid: boolean; actualLimit: number; error?: string }> {
    const limits = await this.getSafeTokenLimits(model, options);
    const effectiveLimit = isReasoningModel(model.name) ? limits.maxTokens : limits.maxCompletionTokens;

    if (requestedTokens > effectiveLimit) {
      return {
        valid: false,
        actualLimit: effectiveLimit,
        error: `Requested ${requestedTokens} tokens exceeds ${model.name} limit of ${effectiveLimit} tokens`,
      };
    }

    return { valid: true, actualLimit: effectiveLimit };
  }

  private async _fetchProviderCapabilities(
    model: ModelInfo,
    options: {
      apiKeys?: Record<string, string>;
      providerSettings?: Record<string, IProviderSetting>;
      serverEnv?: Record<string, string>;
    },
  ): Promise<ModelCapabilities | null> {
    const detector = PROVIDER_CAPABILITY_DETECTORS[model.provider as keyof typeof PROVIDER_CAPABILITY_DETECTORS];

    if (!detector || !detector.apiEndpoint || !detector.parseCapabilities) {
      return null;
    }

    const apiKey =
      options.apiKeys?.[`${model.provider.toUpperCase()}_API_KEY`] ||
      options.serverEnv?.[`${model.provider.toUpperCase()}_API_KEY`];

    if (!apiKey) {
      logger.warn(`No API key available for ${model.provider}, using static capabilities`);
      return null;
    }

    try {
      const response = await fetch(detector.apiEndpoint, {
        headers: detector.getHeaders(apiKey),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as any;
      const capabilities = detector.parseCapabilities(model.provider === 'OpenAI' ? data.data : data);

      return capabilities.find((cap) => cap.name === model.name) || null;
    } catch (error) {
      logger.warn(`Failed to fetch capabilities from ${model.provider} API:`, error);
      return null;
    }
  }

  private _getStaticCapabilities(model: ModelInfo): ModelCapabilities {
    // Use model's existing capabilities if available, otherwise use provider-specific detection
    const maxOutputTokens = this._detectStaticOutputLimit(model);

    return {
      name: model.name,
      provider: model.provider,
      maxInputTokens: model.maxTokenAllowed || 128000,
      maxOutputTokens,
      contextWindow: model.maxTokenAllowed || 128000,
      supportsSystemPrompt: true,
      supportsTools: !isReasoningModel(model.name),
      isReasoning: isReasoningModel(model.name),
      lastUpdated: Date.now(),
    };
  }

  private _detectStaticOutputLimit(model: ModelInfo): number {
    // Use model-specific maxCompletionTokens if available
    if (model.maxCompletionTokens && model.maxCompletionTokens > 0) {
      return model.maxCompletionTokens;
    }

    // Provider-specific detection with accurate limits
    switch (model.provider) {
      case 'Anthropic':
        if (model.name.includes('claude-3-haiku')) {
          return 4096;
        }

        if (model.name.includes('claude-3-5-haiku')) {
          return 8192;
        } // CORRECTED: 8192 not unlimited

        if (model.name.includes('claude-3-5-sonnet')) {
          return 8192;
        }

        if (model.name.includes('claude-3-7-sonnet') || model.name.includes('claude-sonnet-4')) {
          return 32000;
        }

        if (model.name.includes('claude-opus-4')) {
          return 32000;
        }

        return 4096; // Conservative default

      case 'OpenAI':
        if (model.name.includes('o1-mini')) {
          return 65536;
        }

        if (model.name.includes('o1-preview')) {
          return 32768;
        }

        if (model.name.includes('gpt-4o-mini')) {
          return 16384;
        }

        if (model.name.includes('gpt-4o')) {
          return 16384;
        }

        if (model.name.includes('gpt-4')) {
          return 4096;
        }

        return 4096;

      case 'Google':
        if (model.name.includes('gemini-2.0')) {
          return 8192;
        }

        if (model.name.includes('gemini-1.5')) {
          return 8192;
        }

        return 8192;

      default:
        // Conservative default for unknown providers
        return Math.min(8192, model.maxTokenAllowed || 8192);
    }
  }
}

export { ModelCapabilityService };
