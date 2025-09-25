import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

export default class GithubProvider extends BaseProvider {
  name = 'Github';
  getApiKeyLink = 'https://github.com/settings/personal-access-tokens';

  config = {
    apiTokenKey: 'GITHUB_API_KEY',
  };

  // GitHub Models - Curated selection with developer-focused integration
  // Find more models: https://github.com/marketplace?type=models
  staticModels: ModelInfo[] = [
    // OpenAI Models via GitHub
    { name: 'o1-preview', label: 'o1-preview (Reasoning)', provider: 'Github', maxTokenAllowed: 128000 },
    { name: 'o1-mini', label: 'o1-mini (Fast Reasoning)', provider: 'Github', maxTokenAllowed: 128000 },
    { name: 'gpt-4o', label: 'GPT-4o (Multimodal)', provider: 'Github', maxTokenAllowed: 128000 },
    { name: 'gpt-4o-mini', label: 'GPT-4o Mini (Efficient)', provider: 'Github', maxTokenAllowed: 128000 },

    // Anthropic Models via GitHub
    { name: 'claude-3.5-sonnet', label: 'Claude 3.5 Sonnet', provider: 'Github', maxTokenAllowed: 200000 },
    { name: 'claude-3.5-haiku', label: 'Claude 3.5 Haiku', provider: 'Github', maxTokenAllowed: 200000 },

    // Meta LLaMA Models via GitHub
    { name: 'llama-3.1-405b-instruct', label: 'LLaMA 3.1 405B', provider: 'Github', maxTokenAllowed: 128000 },
    { name: 'llama-3.1-70b-instruct', label: 'LLaMA 3.1 70B', provider: 'Github', maxTokenAllowed: 128000 },

    // Google Gemini Models via GitHub
    { name: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', provider: 'Github', maxTokenAllowed: 128000 },
    { name: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', provider: 'Github', maxTokenAllowed: 128000 },

    // Mistral Models via GitHub
    { name: 'mistral-large', label: 'Mistral Large', provider: 'Github', maxTokenAllowed: 128000 },
    { name: 'mistral-nemo', label: 'Mistral Nemo', provider: 'Github', maxTokenAllowed: 128000 },

    // DeepSeek Models via GitHub
    { name: 'deepseek-v3', label: 'DeepSeek V3', provider: 'Github', maxTokenAllowed: 64000 },

    // Cohere Models via GitHub
    { name: 'command-r-plus', label: 'Command R+', provider: 'Github', maxTokenAllowed: 128000 },
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
      defaultApiTokenKey: 'GITHUB_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const openai = createOpenAI({
      baseURL: 'https://models.inference.ai.azure.com',
      apiKey,
    });

    return openai(model);
  }
}
