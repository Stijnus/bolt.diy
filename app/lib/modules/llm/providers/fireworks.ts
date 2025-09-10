import { fireworks } from '@ai-sdk/fireworks';
import type { LanguageModel } from 'ai';
import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';

export default class FireworksProvider extends BaseProvider {
  name = 'Fireworks';
  getApiKeyLink = 'https://fireworks.ai/api-keys';

  config = {
    apiTokenKey: 'FIREWORKS_API_KEY',
  };

  staticModels: ModelInfo[] = [
    {
      name: 'accounts/fireworks/models/llama-v3p1-8b-instruct',
      label: 'Llama 3.1 8B Instruct',
      provider: 'Fireworks',
      maxTokenAllowed: 8192,
    },
    {
      name: 'accounts/fireworks/models/llama-v3p1-70b-instruct',
      label: 'Llama 3.1 70B Instruct',
      provider: 'Fireworks',
      maxTokenAllowed: 8192,
    },
    {
      name: 'accounts/fireworks/models/llama-v3p1-405b-instruct',
      label: 'Llama 3.1 405B Instruct',
      provider: 'Fireworks',
      maxTokenAllowed: 8192,
    },
    {
      name: 'accounts/fireworks/models/qwen2p5-coder-32b-instruct',
      label: 'Qwen 2.5 Coder 32B Instruct',
      provider: 'Fireworks',
      maxTokenAllowed: 8192,
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
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'FIREWORKS_API_KEY',
    });

    const baseUrl = fetchBaseUrl || 'https://api.fireworks.ai/inference/v1';

    if (!apiKey) {
      throw `Missing Api Key configuration for ${this.name} provider`;
    }

    try {
      const response = await fetch(`${baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const res = (await response.json()) as any;

      // Filter for text generation models (not embedding or image models)
      const models =
        res.data?.filter(
          (model: any) =>
            (model.object === 'model' &&
              model.id &&
              !model.id.includes('embedding') &&
              !model.id.includes('stable-diffusion') &&
              model.id.includes('instruct')) ||
            model.id.includes('chat'),
        ) || [];

      return models.map((model: any) => ({
        name: model.id,
        label: `${model.id.split('/').pop()} - context ${model.context_length ? Math.floor(model.context_length / 1000) + 'k' : 'N/A'}`,
        provider: this.name,
        maxTokenAllowed: model.context_length || 8192,
      }));
    } catch (error) {
      console.error(`Error fetching Fireworks models:`, error);
      return [];
    }
  }

  getModelInstance(options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModel {
    const { model, serverEnv, apiKeys, providerSettings } = options;

    const { baseUrl, apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'FIREWORKS_API_KEY',
    });

    if (!apiKey) {
      throw `Missing Api Key configuration for ${this.name} provider`;
    }

    const fireworksInstance = fireworks({
      baseURL: baseUrl || 'https://api.fireworks.ai/inference/v1',
      apiKey,
    });

    return fireworksInstance(model);
  }
}
