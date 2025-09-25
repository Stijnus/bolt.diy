import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

export default class XAIProvider extends BaseProvider {
  name = 'xAI';
  getApiKeyLink = 'https://docs.x.ai/docs/quickstart#creating-an-api-key';

  config = {
    apiTokenKey: 'XAI_API_KEY',
  };

  staticModels: ModelInfo[] = [
    // Grok 4 (2025) - Most intelligent model
    {
      name: 'grok-4',
      label: 'Grok 4 (Most Intelligent)',
      provider: 'xAI',
      maxTokenAllowed: 128000
    },

    // Grok Code Fast 1 - Specialized for coding (70.8% SWE-bench)
    {
      name: 'grok-code-fast-1',
      label: 'Grok Code Fast 1 (Coding Specialist)',
      provider: 'xAI',
      maxTokenAllowed: 256000
    },

    // Grok 3 - Large context model
    {
      name: 'grok-3',
      label: 'Grok 3 (1M Context)',
      provider: 'xAI',
      maxTokenAllowed: 1000000
    },
    {
      name: 'grok-3-beta',
      label: 'Grok 3 Beta',
      provider: 'xAI',
      maxTokenAllowed: 1000000
    },
  ];

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
      defaultApiTokenKey: 'XAI_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const openai = createOpenAI({
      baseURL: 'https://api.x.ai/v1',
      apiKey,
    });

    return openai(model);
  }
}
