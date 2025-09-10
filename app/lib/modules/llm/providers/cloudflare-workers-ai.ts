import type { LanguageModel } from 'ai';
import { createWorkersAI } from 'workers-ai-provider';
import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';

export default class CloudflareWorkersAIProvider extends BaseProvider {
  name = 'CloudflareWorkersAI';
  getApiKeyLink = 'https://dash.cloudflare.com/profile/api-tokens';

  config = {
    apiTokenKey: 'CLOUDFLARE_API_TOKEN',
  };

  staticModels: ModelInfo[] = [
    {
      name: '@cf/meta/llama-3.1-8b-instruct',
      label: 'Llama 3.1 8B Instruct',
      provider: 'CloudflareWorkersAI',
      maxTokenAllowed: 8192,
    },
    {
      name: '@cf/meta/llama-3.1-70b-instruct',
      label: 'Llama 3.1 70B Instruct',
      provider: 'CloudflareWorkersAI',
      maxTokenAllowed: 8192,
    },
    {
      name: '@cf/qwen/qwen1.5-14b-chat-awq',
      label: 'Qwen 1.5 14B Chat',
      provider: 'CloudflareWorkersAI',
      maxTokenAllowed: 8192,
    },
    {
      name: '@cf/microsoft/phi-2',
      label: 'Microsoft Phi-2',
      provider: 'CloudflareWorkersAI',
      maxTokenAllowed: 2048,
    },
    {
      name: '@cf/mistral/mistral-7b-instruct-v0.1',
      label: 'Mistral 7B Instruct',
      provider: 'CloudflareWorkersAI',
      maxTokenAllowed: 8192,
    },
  ];

  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv: Record<string, string> = {},
  ): Promise<ModelInfo[]> {
    const { apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: settings,
      serverEnv,
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'CLOUDFLARE_API_TOKEN',
    });

    const accountId = serverEnv.CLOUDFLARE_ACCOUNT_ID || settings?.accountId;

    if (!apiKey || !accountId) {
      throw `Missing Api Key or Account ID configuration for ${this.name} provider`;
    }

    try {
      const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/models/search`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const res = (await response.json()) as any;

      // Filter for text generation models
      const models =
        res.result?.filter(
          (model: any) => model.task?.type === 'text-generation' && model.name && model.name.startsWith('@cf/'),
        ) || [];

      return models.map((model: any) => ({
        name: model.name,
        label: `${model.name.split('/').pop()} - ${model.description || 'Cloudflare Workers AI'}`,
        provider: this.name,
        maxTokenAllowed: model.properties?.max_total_tokens || 8192,
      }));
    } catch (error) {
      console.error(`Error fetching Cloudflare Workers AI models:`, error);
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
      defaultApiTokenKey: 'CLOUDFLARE_API_TOKEN',
    });

    const accountId = (serverEnv as any).CLOUDFLARE_ACCOUNT_ID || providerSettings?.[this.name]?.accountId;

    if (!apiKey || !accountId) {
      throw `Missing Api Key or Account ID configuration for ${this.name} provider`;
    }

    // Create a mock AI binding object for the workers-ai-provider
    const mockAI = {
      run: async (model: string, options: any) => {
        const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(options),
        });
        return await response.json();
      },
    };

    const workersAI = createWorkersAI({
      binding: mockAI,
    });

    return workersAI(model);
  }
}
