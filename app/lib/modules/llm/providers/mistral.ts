import { createMistral } from '@ai-sdk/mistral';
import type { LanguageModel } from 'ai';
import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';

export default class MistralProvider extends BaseProvider {
  name = 'Mistral';
  getApiKeyLink = 'https://console.mistral.ai/api-keys/';

  config = {
    apiTokenKey: 'MISTRAL_API_KEY',
  };

  staticModels: ModelInfo[] = [
    // Codestral 25.01 (January 2025) - #1 on LMsys copilot arena
    {
      name: 'codestral-25.01',
      label: 'Codestral 25.01 (#1 Copilot Arena)',
      provider: 'Mistral',
      maxTokenAllowed: 256000,
    },
    {
      name: 'codestral-latest',
      label: 'Codestral Latest',
      provider: 'Mistral',
      maxTokenAllowed: 256000,
    },

    // Mistral Large Latest - General purpose flagship
    {
      name: 'mistral-large-latest',
      label: 'Mistral Large Latest',
      provider: 'Mistral',
      maxTokenAllowed: 128000,
    },

    // Specialized models maintained for compatibility
    {
      name: 'open-mixtral-8x22b',
      label: 'Mixtral 8x22B',
      provider: 'Mistral',
      maxTokenAllowed: 64000,
    },
    {
      name: 'open-codestral-mamba',
      label: 'Codestral Mamba (Fast)',
      provider: 'Mistral',
      maxTokenAllowed: 32000,
    },
    {
      name: 'mistral-small-latest',
      label: 'Mistral Small',
      provider: 'Mistral',
      maxTokenAllowed: 32000,
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
      defaultApiTokenKey: 'MISTRAL_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const mistral = createMistral({
      apiKey,
    });

    return mistral(model);
  }
}
