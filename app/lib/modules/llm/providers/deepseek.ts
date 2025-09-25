import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModel } from 'ai';
import { createDeepSeek } from '@ai-sdk/deepseek';

export default class DeepseekProvider extends BaseProvider {
  name = 'Deepseek';
  getApiKeyLink = 'https://platform.deepseek.com/apiKeys';

  config = {
    apiTokenKey: 'DEEPSEEK_API_KEY',
  };

  staticModels: ModelInfo[] = [
    // DeepSeek V3.1-Terminus (September 2025) - Latest generation
    {
      name: 'deepseek-chat',
      label: 'DeepSeek V3.1 Chat (Latest)',
      provider: 'Deepseek',
      maxTokenAllowed: 128000
    },
    {
      name: 'deepseek-reasoner',
      label: 'DeepSeek V3.1 Reasoner (Thinking Mode)',
      provider: 'Deepseek',
      maxTokenAllowed: 128000
    },

    // DeepSeek-Coder-V2 - Specialized coding model (338 languages)
    {
      name: 'deepseek-coder-v2',
      label: 'DeepSeek Coder V2 (338 Languages)',
      provider: 'Deepseek',
      maxTokenAllowed: 128000
    },
    {
      name: 'deepseek-coder',
      label: 'DeepSeek Coder (Legacy)',
      provider: 'Deepseek',
      maxTokenAllowed: 32000
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
      defaultApiTokenKey: 'DEEPSEEK_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const deepseek = createDeepSeek({
      apiKey,
    });

    return deepseek(model);
  }
}
