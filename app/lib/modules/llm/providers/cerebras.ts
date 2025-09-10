import { cerebras } from '@ai-sdk/cerebras';
import type { LanguageModel } from 'ai';
import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';

export default class CerebrasProvider extends BaseProvider {
  name = 'Cerebras';
  getApiKeyLink = 'https://cloud.cerebras.ai/platform';

  config = {
    apiTokenKey: 'CEREBRAS_API_KEY',
  };

  staticModels: ModelInfo[] = [
    {
      name: 'llama3.1-8b',
      label: 'Llama 3.1 8B',
      provider: 'Cerebras',
      maxTokenAllowed: 8192,
    },
    {
      name: 'llama3.1-70b',
      label: 'Llama 3.1 70B',
      provider: 'Cerebras',
      maxTokenAllowed: 8192,
    },
    {
      name: 'llama-3.3-70b',
      label: 'Llama 3.3 70B',
      provider: 'Cerebras',
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
      defaultApiTokenKey: 'CEREBRAS_API_KEY',
    });

    const baseUrl = fetchBaseUrl || 'https://api.cerebras.ai/v1';

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

      // Filter for models that support chat completions
      const models =
        res.data?.filter((model: any) => model.object === 'model' && model.id && !model.id.includes('embedding')) || [];

      return models.map((model: any) => ({
        name: model.id,
        label: `${model.id} - context ${model.context_length ? Math.floor(model.context_length / 1000) + 'k' : 'N/A'}`,
        provider: this.name,
        maxTokenAllowed: model.context_length || 8192,
      }));
    } catch (error) {
      console.error(`Error fetching Cerebras models:`, error);
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

    const { apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'CEREBRAS_API_KEY',
    });

    if (!apiKey) {
      throw `Missing Api Key configuration for ${this.name} provider`;
    }

    // cerebras() only accepts a single argument (model id) via ai-sdk v5
    return cerebras(model);
  }
}
