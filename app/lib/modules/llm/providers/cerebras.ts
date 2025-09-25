import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

export default class CerebrasProvider extends BaseProvider {
  name = 'Cerebras';
  getApiKeyLink = 'https://cloud.cerebras.ai/';

  config = {
    apiTokenKey: 'CEREBRAS_API_KEY',
  };

  staticModels: ModelInfo[] = [
    // Cerebras Inference - Ultra-fast LLaMA models with Wafer-Scale Engine
    {
      name: 'llama3.1-8b',
      label: 'Llama 3.1 8B (Ultra Fast)',
      provider: 'Cerebras',
      maxTokenAllowed: 32000,
    },
    {
      name: 'llama3.1-70b',
      label: 'Llama 3.1 70B (Ultra Fast)',
      provider: 'Cerebras',
      maxTokenAllowed: 32000,
    },
    {
      name: 'llama3.2-1b',
      label: 'Llama 3.2 1B (Fastest)',
      provider: 'Cerebras',
      maxTokenAllowed: 32000,
    },
    {
      name: 'llama3.2-3b',
      label: 'Llama 3.2 3B (Fast)',
      provider: 'Cerebras',
      maxTokenAllowed: 32000,
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
      defaultApiTokenKey: 'CEREBRAS_API_KEY',
    });

    if (!apiKey) {
      throw `Missing Api Key configuration for ${this.name} provider`;
    }

    const response = await fetch(`https://api.cerebras.ai/v1/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const res = (await response.json()) as any;
    const staticModelIds = this.staticModels.map((m) => m.name);

    const data = res.data.filter(
      (model: any) => model.object === 'model' && model.id.startsWith('llama') && !staticModelIds.includes(model.id),
    );

    return data.map((m: any) => ({
      name: m.id,
      label: `${m.id} (Cerebras WSE)`,
      provider: this.name,
      maxTokenAllowed: m.context_window || 32000,
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
      defaultApiTokenKey: 'CEREBRAS_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const cerebras = createOpenAI({
      baseURL: 'https://api.cerebras.ai/v1',
      apiKey,
    });

    return cerebras(model);
  }
}
