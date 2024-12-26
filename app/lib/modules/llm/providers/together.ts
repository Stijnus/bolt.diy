import { BaseProvider, getOpenAILikeModel } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';

interface TogetherModelResponse {
  data: Array<{
    name: string;
    display_name?: string;
    display_type: string;
  }>;
}

export default class TogetherProvider extends BaseProvider {
  name = 'Together';
  getApiKeyLink = 'https://api.together.xyz/settings/api-keys';

  config = {
    baseUrlKey: 'TOGETHER_API_BASE_URL',
    apiTokenKey: 'TOGETHER_API_KEY',
  };

  staticModels: ModelInfo[] = [
    {
      name: 'Qwen/Qwen2.5-Coder-32B-Instruct',
      label: 'Qwen/Qwen2.5-Coder-32B-Instruct',
      provider: 'Together',
      maxTokenAllowed: 8000,
    },
    {
      name: 'meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo',
      label: 'meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo',
      provider: 'Together',
      maxTokenAllowed: 8000,
    },
    {
      name: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
      label: 'Mixtral 8x7B Instruct',
      provider: 'Together',
      maxTokenAllowed: 8192,
    },
  ];

  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv: Record<string, string> = {},
  ): Promise<ModelInfo[]> {
    try {
      const { baseUrl: fetchBaseUrl, apiKey } = this.getProviderBaseUrlAndKey({
        apiKeys,
        providerSettings: settings,
        serverEnv,
        defaultBaseUrlKey: 'TOGETHER_API_BASE_URL',
        defaultApiTokenKey: 'TOGETHER_API_KEY',
      });
      const baseUrl = fetchBaseUrl || 'https://api.together.xyz/v1';

      if (!baseUrl || !apiKey) {
        // Return static models if API key is missing
        return this.staticModels;
      }

      const response = await fetch(`${baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch Together models: ${response.statusText}`);
      }

      const data = (await response.json()) as TogetherModelResponse;

      return data.data
        .filter((model) => model.display_type === 'model')
        .map((model) => ({
          name: model.name,
          label: model.display_name || model.name,
          provider: this.name,
          maxTokenAllowed: 8192,
        }));
    } catch (error: any) {
      // If there's an error fetching dynamic models, return static models as fallback
      console.error('Error fetching Together models:', error?.message || 'Unknown error');
      return this.staticModels;
    }
  }

  getModelInstance(options: {
    model: string;
    serverEnv: any;
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
