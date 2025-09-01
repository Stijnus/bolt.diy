import { BaseProvider, getOpenAILikeModel } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';

export default class TogetherProvider extends BaseProvider {
  name = 'Together';
  getApiKeyLink = 'https://api.together.xyz/settings/api-keys';

  config = {
    baseUrlKey: 'TOGETHER_API_BASE_URL',
    apiTokenKey: 'TOGETHER_API_KEY',
  };

  staticModels: ModelInfo[] = [
    /*
     * Essential fallback models - only the most stable/reliable ones
     * Llama 3.2 90B Vision: 128k context, multimodal capabilities
     */
    {
      name: 'meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo',
      label: 'Llama 3.2 90B Vision',
      provider: 'Together',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 8192,
    },

    // Mixtral 8x7B: 32k context, strong performance
    {
      name: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
      label: 'Mixtral 8x7B Instruct',
      provider: 'Together',
      maxTokenAllowed: 32000,
      maxCompletionTokens: 8192,
    },
  ];

  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv: Record<string, string> = {},
  ): Promise<ModelInfo[]> {
    const { baseUrl: fetchBaseUrl, apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: settings,
      serverEnv,
      defaultBaseUrlKey: 'TOGETHER_API_BASE_URL',
      defaultApiTokenKey: 'TOGETHER_API_KEY',
    });
    const baseUrl = fetchBaseUrl || 'https://api.together.xyz/v1';

    if (!baseUrl || !apiKey) {
      return [];
    }

    // console.log({ baseUrl, apiKey });

    const response = await fetch(`${baseUrl}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const res = (await response.json()) as any;
    const data = (res || []).filter((model: any) => model.type === 'chat');

    return data.map((m: any) => {
      // Use actual context length from Together API
      const contextWindow = m.context_length || 8000;

      // Determine completion tokens based on model type
      let maxCompletionTokens = 4096; // Conservative default

      // Model-specific completion token limits for Together.ai
      if (m.id?.includes('llama-3.1') || m.id?.includes('llama-3.2')) {
        maxCompletionTokens = Math.min(8192, contextWindow * 0.25); // 25% of context for Llama models
      } else if (m.id?.includes('mixtral') || m.id?.includes('mistral')) {
        maxCompletionTokens = Math.min(8192, contextWindow * 0.25); // 25% of context for Mistral models
      } else if (m.id?.includes('qwen') || m.id?.includes('deepseek')) {
        maxCompletionTokens = Math.min(32768, contextWindow * 0.25); // Higher limits for newer models
      } else {
        // Generic fallback: use 25% of context window, capped at 8K for safety
        maxCompletionTokens = Math.min(8192, Math.floor(contextWindow * 0.25));
      }

      return {
        name: m.id,
        label: `${m.display_name} - in:$${m.pricing.input.toFixed(2)} out:$${m.pricing.output.toFixed(2)} - context ${Math.floor(contextWindow / 1000)}k`,
        provider: this.name,
        maxTokenAllowed: contextWindow,
        maxCompletionTokens,
      };
    });
  }

  getModelInstance(options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 {
    const { model, serverEnv, apiKeys, providerSettings } = options;

    const { baseUrl, apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: 'TOGETHER_API_BASE_URL',
      defaultApiTokenKey: 'TOGETHER_API_KEY',
    });

    if (!baseUrl || !apiKey) {
      throw new Error(`Missing configuration for ${this.name} provider`);
    }

    return getOpenAILikeModel(baseUrl, apiKey, model);
  }
}
