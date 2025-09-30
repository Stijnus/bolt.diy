import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createDeepSeek } from '@ai-sdk/deepseek';

export default class DeepseekProvider extends BaseProvider {
  name = 'Deepseek';
  getApiKeyLink = 'https://platform.deepseek.com/apiKeys';

  config = {
    apiTokenKey: 'DEEPSEEK_API_KEY',
  };

  staticModels: ModelInfo[] = [
    // DeepSeek Chat - DeepSeek-V3.2-Exp (Non-thinking Mode)
    {
      name: 'deepseek-chat',
      label: 'DeepSeek Chat (V3.2-Exp)',
      provider: 'Deepseek',
      maxTokenAllowed: 128000, // 128K context length
      maxCompletionTokens: 8192, // Maximum 8K output tokens
    },

    // DeepSeek Reasoner - DeepSeek-V3.2-Exp (Thinking Mode)
    {
      name: 'deepseek-reasoner',
      label: 'DeepSeek Reasoner (V3.2-Exp)',
      provider: 'Deepseek',
      maxTokenAllowed: 128000, // 128K context length
      maxCompletionTokens: 64000, // Maximum 64K output tokens with reasoning
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
      defaultApiTokenKey: 'DEEPSEEK_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const response = await fetch(`https://api.deepseek.com/v1/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models from ${this.name}: ${response.statusText}`);
    }

    const res = (await response.json()) as any;
    const staticModelIds = this.staticModels.map((m) => m.name);

    // Filter for DeepSeek models and exclude static models to avoid duplicates
    const data = res.data.filter(
      (model: any) =>
        model.object === 'model' && model.id.startsWith('deepseek-') && !staticModelIds.includes(model.id),
    );

    return data.map((m: any) => {
      // All current DeepSeek models have 128K context
      let contextWindow = 128000;
      let maxCompletionTokens = 8192; // default for deepseek-chat

      if (m.id === 'deepseek-chat') {
        // DeepSeek Chat - V3.2-Exp (Non-thinking Mode)
        contextWindow = 128000;
        maxCompletionTokens = 8192; // Maximum 8K output
      } else if (m.id === 'deepseek-reasoner') {
        // DeepSeek Reasoner - V3.2-Exp (Thinking Mode)
        contextWindow = 128000;
        maxCompletionTokens = 64000; // Maximum 64K output with reasoning
      }

      return {
        name: m.id,
        label: `${m.id} (${Math.floor(contextWindow / 1000)}k context)`,
        provider: this.name,
        maxTokenAllowed: contextWindow,
        maxCompletionTokens,
      };
    });
  }

  getModelInstance(options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 {
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
