import type { LanguageModel } from 'ai';
import { BaseProvider, getOpenAILikeModel } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';

export default class TogetherProvider extends BaseProvider {
  name = 'Together';
  getApiKeyLink = 'https://api.together.xyz/settings/api-keys';

  config = {
    baseUrlKey: 'TOGETHER_API_BASE_URL',
    apiTokenKey: 'TOGETHER_API_KEY',
  };

  staticModels: ModelInfo[] = [
    // Llama 4 Series (2025) - Multimodal MoE models
    {
      name: 'meta-llama/Llama-4-Scout',
      label: 'Llama 4 Scout (Multimodal MoE)',
      provider: 'Together',
      maxTokenAllowed: 128000,
    },
    {
      name: 'meta-llama/Llama-4-Maverick',
      label: 'Llama 4 Maverick (Advanced)',
      provider: 'Together',
      maxTokenAllowed: 128000,
    },

    // Llama 3.3 Series - Latest stable models
    {
      name: 'meta-llama/Llama-3.3-70B-Instruct',
      label: 'Llama 3.3 70B Instruct (Multilingual)',
      provider: 'Together',
      maxTokenAllowed: 128000,
    },

    // Top coding models available on Together
    {
      name: 'Qwen/Qwen2.5-Coder-32B-Instruct',
      label: 'Qwen 2.5 Coder 32B (Code Specialist)',
      provider: 'Together',
      maxTokenAllowed: 32000,
    },

    // Multimodal and vision models
    {
      name: 'meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo',
      label: 'Llama 3.2 90B Vision (Multimodal)',
      provider: 'Together',
      maxTokenAllowed: 64000,
    },

    // Efficient models for fast inference
    {
      name: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
      label: 'Mixtral 8x7B Instruct (Efficient)',
      provider: 'Together',
      maxTokenAllowed: 32000,
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

    return data.map((m: any) => ({
      name: m.id,
      label: `${m.display_name} - in:$${m.pricing.input.toFixed(2)} out:$${m.pricing.output.toFixed(2)} - context ${Math.floor(m.context_length / 1000)}k`,
      provider: this.name,
      maxTokenAllowed: 8000,
    }));
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
      defaultBaseUrlKey: 'TOGETHER_API_BASE_URL',
      defaultApiTokenKey: 'TOGETHER_API_KEY',
    });

    if (!baseUrl || !apiKey) {
      throw new Error(`Missing configuration for ${this.name} provider`);
    }

    return getOpenAILikeModel(baseUrl, apiKey, model);
  }
}
