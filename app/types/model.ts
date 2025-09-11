import type { ModelInfo } from '~/lib/modules/llm/types';

export type ProviderInfo = {
  staticModels: ModelInfo[];
  name: string;
  getDynamicModels?: (
    providerName: string,
    apiKeys?: Record<string, string>,
    providerSettings?: IProviderSetting,
    serverEnv?: Record<string, string>,
  ) => Promise<ModelInfo[]>;
  getApiKeyLink?: string;
  labelForGetApiKey?: string;
  icon?: string;
};

export interface RateLimitConfig {
  requestsPerMinute: number;
  burstLimit: number;
}

export interface IProviderSetting {
  enabled?: boolean;
  baseUrl?: string;
  OPENAI_LIKE_API_MODELS?: string;
  // New optional advanced controls for SDK v5 alignment
  customHeaders?: Record<string, string>;
  timeout?: number; // in ms
  maxRetries?: number;
  rateLimit?: RateLimitConfig;
}

export type IProviderConfig = ProviderInfo & {
  settings: IProviderSetting;
};
