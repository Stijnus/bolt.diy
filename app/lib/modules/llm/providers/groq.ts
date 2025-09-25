import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

export default class GroqProvider extends BaseProvider {
  name = 'Groq';
  getApiKeyLink = 'https://console.groq.com/keys';

  config = {
    apiTokenKey: 'GROQ_API_KEY',
  };

  staticModels: ModelInfo[] = [
    // Official Llama 4 API (2025) - Partnership with Meta
    {
      name: 'llama-4-scout',
      label: 'Llama 4 Scout (Multimodal MoE)',
      provider: 'Groq',
      maxTokenAllowed: 128000
    },
    {
      name: 'llama-4-maverick',
      label: 'Llama 4 Maverick (Advanced)',
      provider: 'Groq',
      maxTokenAllowed: 128000
    },

    // Llama-3-Groq-Tool-Use models - Specialized for tool use
    {
      name: 'llama-3-groq-70b-tool-use',
      label: 'Llama 3 Groq 70B Tool Use',
      provider: 'Groq',
      maxTokenAllowed: 64000
    },
    {
      name: 'llama-3-groq-8b-tool-use',
      label: 'Llama 3 Groq 8B Tool Use',
      provider: 'Groq',
      maxTokenAllowed: 64000
    },

    // Latest Llama models maintained for compatibility
    {
      name: 'llama-3.3-70b-versatile',
      label: 'Llama 3.3 70B Versatile',
      provider: 'Groq',
      maxTokenAllowed: 32000
    },
    {
      name: 'llama-3.2-90b-vision-preview',
      label: 'Llama 3.2 90B Vision',
      provider: 'Groq',
      maxTokenAllowed: 32000
    },
    {
      name: 'deepseek-r1-distill-llama-70b',
      label: 'DeepSeek R1 Distill Llama 70B',
      provider: 'Groq',
      maxTokenAllowed: 131072
    },
  ];

  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv?: Record<string, string>,
  ): Promise<ModelInfo[]> {
    const { apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: settings,
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'GROQ_API_KEY',
    });

    if (!apiKey) {
      throw `Missing Api Key configuration for ${this.name} provider`;
    }

    const response = await fetch(`https://api.groq.com/openai/v1/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const res = (await response.json()) as any;

    const data = res.data.filter(
      (model: any) => model.object === 'model' && model.active && model.context_window > 8000,
    );

    return data.map((m: any) => ({
      name: m.id,
      label: `${m.id} - context ${m.context_window ? Math.floor(m.context_window / 1000) + 'k' : 'N/A'} [ by ${m.owned_by}]`,
      provider: this.name,
      maxTokenAllowed: m.context_window || 8000,
    }));
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
      defaultApiTokenKey: 'GROQ_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const openai = createOpenAI({
      baseURL: 'https://api.groq.com/openai/v1',
      apiKey,
    });

    return openai(model);
  }
}
