import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';

export default class DeepInfraProvider extends BaseProvider {
  name = 'DeepInfra';
  getApiKeyLink = 'https://deepinfra.com/dash/api_keys';

  config = {
    apiTokenKey: 'DEEPINFRA_API_KEY',
  };

  staticModels: ModelInfo[] = [
    {
      name: 'meta-llama/Meta-Llama-3.1-8B-Instruct',
      label: 'Llama 3.1 8B Instruct',
      provider: 'DeepInfra',
      maxTokenAllowed: 8192,
    },
    {
      name: 'meta-llama/Meta-Llama-3.1-70B-Instruct',
      label: 'Llama 3.1 70B Instruct',
      provider: 'DeepInfra',
      maxTokenAllowed: 8192,
    },
    {
      name: 'microsoft/WizardLM-2-8x22B',
      label: 'WizardLM 2 8x22B',
      provider: 'DeepInfra',
      maxTokenAllowed: 8192,
    },
    {
      name: 'Qwen/Qwen2.5-Coder-32B-Instruct',
      label: 'Qwen 2.5 Coder 32B Instruct',
      provider: 'DeepInfra',
      maxTokenAllowed: 8192,
    },
    {
      name: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
      label: 'Mixtral 8x7B Instruct',
      provider: 'DeepInfra',
      maxTokenAllowed: 32768,
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
      defaultApiTokenKey: 'DEEPINFRA_API_KEY',
    });

    const baseUrl = fetchBaseUrl || 'https://api.deepinfra.com/v1/openai';

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

      // Filter for text generation models
      const models =
        res.data?.filter(
          (model: any) =>
            model.object === 'model' &&
            model.id &&
            !model.id.includes('embedding') &&
            !model.id.includes('whisper') &&
            !model.id.includes('image'),
        ) || [];

      return models.map((model: any) => ({
        name: model.id,
        label: `${model.id.split('/').pop()} - DeepInfra`,
        provider: this.name,
        maxTokenAllowed: model.context_length || 8192,
      }));
    } catch (error) {
      console.error(`Error fetching DeepInfra models:`, error);
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
      defaultApiTokenKey: 'DEEPINFRA_API_KEY',
    });

    if (!apiKey) {
      throw `Missing Api Key configuration for ${this.name} provider`;
    }

    const openai = createOpenAI({
      baseURL: baseUrl || 'https://api.deepinfra.com/v1/openai',
      apiKey,
    });

    return openai(model);
  }
}
