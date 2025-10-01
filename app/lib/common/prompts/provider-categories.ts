import type { ModelInfo } from '~/lib/modules/llm/types';
import { isReasoningModel } from '~/lib/common/model-utils';

// Provider category types
export type ProviderCategory =
  | 'high-context'
  | 'reasoning'
  | 'speed-optimized'
  | 'local-models'
  | 'coding-specialized'
  | 'standard';

export interface ProviderCategoryConfig {
  category: ProviderCategory;
  name: string;
  description: string;
  tokenReduction: number; // 0%, 15%, or 30% reduction
  prefersConcisePrompts: boolean; // true for reasoning/speed-optimized
}

export const PROVIDER_CATEGORIES: Record<ProviderCategory, ProviderCategoryConfig> = {
  'high-context': {
    category: 'high-context',
    name: 'High-Context Providers',
    description: 'Large context window models (Gemini, Claude) - can handle detailed prompts',
    tokenReduction: 0,
    prefersConcisePrompts: false,
  },

  reasoning: {
    category: 'reasoning',
    name: 'Reasoning Models',
    description: 'Models with internal reasoning (o1, o3, DeepSeek R1) - prefer concise prompts',
    tokenReduction: 30,
    prefersConcisePrompts: true,
  },

  'speed-optimized': {
    category: 'speed-optimized',
    name: 'Speed-Optimized',
    description: 'Fast inference models (Groq, Cerebras) - optimize for speed',
    tokenReduction: 30,
    prefersConcisePrompts: true,
  },

  'local-models': {
    category: 'local-models',
    name: 'Local Models',
    description: 'Self-hosted via Ollama - moderate optimization',
    tokenReduction: 15,
    prefersConcisePrompts: true,
  },

  'coding-specialized': {
    category: 'coding-specialized',
    name: 'Coding-Specialized',
    description: 'Code-focused models (DeepSeek, Grok) - detailed coding prompts work best',
    tokenReduction: 0,
    prefersConcisePrompts: false,
  },

  standard: {
    category: 'standard',
    name: 'Standard',
    description: 'Balanced general-purpose models',
    tokenReduction: 0,
    prefersConcisePrompts: false,
  },
};

// Provider to category mapping based on 2025 research analysis
export const PROVIDER_TO_CATEGORY: Record<string, ProviderCategory> = {
  // High-Context Providers (400K-2M tokens) - 2025 updated
  Google: 'high-context', // Gemini 2.5 has 1M+ context
  Anthropic: 'high-context', // Claude 4 has 200K+ context
  Moonshot: 'high-context', // Kimi K3 has 2M context

  // Reasoning Models (internal reasoning) - 2025 expanded
  'OpenAI-o1': 'reasoning', // Will be detected by model name
  'OpenAI-o3': 'reasoning', // Will be detected by model name
  'Anthropic-Claude-4': 'reasoning', // Will be detected by model name
  'DeepSeek-R1': 'reasoning', // Will be detected by model name
  'Kimi-Thinking': 'reasoning', // Will be detected by model name

  // Speed-Optimized (ultra-fast inference)
  Groq: 'speed-optimized',
  Cerebras: 'speed-optimized',
  Cloudflare: 'speed-optimized',

  // Local Models (Ollama)
  Ollama: 'local-models',

  // Coding-Specialized - 2025 updated
  Deepseek: 'coding-specialized', // V3.1 Terminus specialized for coding
  xAI: 'coding-specialized', // Grok 4 has strong coding capabilities
  Alibaba: 'coding-specialized', // Qwen3-Coder series specialized for coding

  // Standard Providers - many now have GPT-5 class models
  OpenAI: 'standard', // Even though GPT-5 is powerful, base provider is standard
  Github: 'standard',
  Cohere: 'standard',
  Mistral: 'standard',
  OpenRouter: 'standard',
  Perplexity: 'standard',
  Together: 'standard',
  LMStudio: 'standard',
  OpenAILike: 'standard',
  AmazonBedrock: 'standard',
  HuggingFace: 'standard',
  Hyperbolic: 'standard',
  ZAI: 'coding-specialized',
};

/**
 * Determines the provider category based on provider name and model details
 */
export function getProviderCategory(providerName: string, modelDetails?: ModelInfo): ProviderCategory {
  // Priority 1: Reasoning models (detected by model name)
  if (modelDetails?.name && isReasoningModel(modelDetails.name)) {
    return 'reasoning';
  }

  // Priority 2: Fast models (detected by model name patterns)
  if (modelDetails?.name) {
    const modelName = modelDetails.name.toLowerCase();

    if (/\b(fast|instant|flash|turbo)\b/i.test(modelName)) {
      return 'speed-optimized';
    }
  }

  // Priority 3: Provider-based mapping
  return PROVIDER_TO_CATEGORY[providerName] || 'standard';
}

/**
 * Gets the configuration for a specific provider category
 */
export function getCategoryConfig(category: ProviderCategory): ProviderCategoryConfig {
  return PROVIDER_CATEGORIES[category];
}

/**
 * Gets token reduction percentage for a provider category
 */
export function getTokenReduction(category: ProviderCategory): number {
  return PROVIDER_CATEGORIES[category].tokenReduction;
}
