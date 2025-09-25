import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModel } from 'ai';
import { createCohere } from '@ai-sdk/cohere';

export default class CohereProvider extends BaseProvider {
  name = 'Cohere';
  getApiKeyLink = 'https://dashboard.cohere.com/api-keys';

  config = {
    apiTokenKey: 'COHERE_API_KEY',
  };

  staticModels: ModelInfo[] = [
    // Command A 03-2025 (March 2025) - Most performant model (111B params)
    {
      name: 'command-a-03-2025',
      label: 'Command A 03-2025 (Best Performance)',
      provider: 'Cohere',
      maxTokenAllowed: 256000
    },

    // Command R+ 08-2024 - Enterprise-grade models with improved capabilities
    {
      name: 'command-r-plus-08-2024',
      label: 'Command R+ 08-2024 (Enterprise)',
      provider: 'Cohere',
      maxTokenAllowed: 128000
    },
    {
      name: 'command-r-08-2024',
      label: 'Command R 08-2024',
      provider: 'Cohere',
      maxTokenAllowed: 128000
    },

    // Legacy models maintained for compatibility
    {
      name: 'command-r-plus',
      label: 'Command R+ (Legacy)',
      provider: 'Cohere',
      maxTokenAllowed: 64000
    },
    {
      name: 'command-r',
      label: 'Command R (Legacy)',
      provider: 'Cohere',
      maxTokenAllowed: 64000
    },

    // Aya Expanse multilingual models
    {
      name: 'c4ai-aya-expanse-32b',
      label: 'Aya Expanse 32B (Multilingual)',
      provider: 'Cohere',
      maxTokenAllowed: 64000
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
      defaultApiTokenKey: 'COHERE_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const cohere = createCohere({
      apiKey,
    });

    return cohere(model);
  }
}
