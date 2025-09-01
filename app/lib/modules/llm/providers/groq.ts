import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

export default class GroqProvider extends BaseProvider {
  name = 'Groq';
  getApiKeyLink = 'https://console.groq.com/keys';

  config = {
    apiTokenKey: 'GROQ_API_KEY',
  };

  staticModels: ModelInfo[] = [
    /*
     * Essential fallback models - only the most stable/reliable ones
     * Llama 3.1 8B: 128k context, fast and efficient
     */
    {
      name: 'llama-3.1-8b-instant',
      label: 'Llama 3.1 8B',
      provider: 'Groq',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 8192,
    },

    // Llama 3.3 70B: 128k context, most capable model
    {
      name: 'llama-3.3-70b-versatile',
      label: 'Llama 3.3 70B',
      provider: 'Groq',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 8192,
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

    return data.map((m: any) => {
      const contextWindow = m.context_window || 8192;
      const cappedContext = Math.min(contextWindow, 16384);

      // Model-specific completion token limits for Groq
      let maxCompletionTokens = 4096; // Conservative default

      if (m.id?.includes('llama-3.1')) {
        maxCompletionTokens = 8192; // Llama 3.1 supports 8K output
      } else if (m.id?.includes('llama-3.2')) {
        maxCompletionTokens = 8192; // Llama 3.2 supports 8K output
      } else if (m.id?.includes('llama')) {
        maxCompletionTokens = Math.min(4096, Math.floor(cappedContext * 0.25)); // Older Llama models
      } else if (m.id?.includes('mixtral')) {
        maxCompletionTokens = 8192; // Mixtral supports 8K output
      } else if (m.id?.includes('gemma')) {
        maxCompletionTokens = Math.min(8192, Math.floor(cappedContext * 0.25)); // Gemma models
      } else {
        // Generic fallback: 25% of context window, capped at 4K for safety
        maxCompletionTokens = Math.min(4096, Math.floor(cappedContext * 0.25));
      }

      return {
        name: m.id,
        label: `${m.id} - context ${contextWindow ? Math.floor(contextWindow / 1000) + 'k' : 'N/A'} [ by ${m.owned_by}]`,
        provider: this.name,
        maxTokenAllowed: cappedContext,
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
