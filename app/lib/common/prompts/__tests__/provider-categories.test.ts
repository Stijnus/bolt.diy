import { describe, it, expect } from 'vitest';
import {
  getProviderCategory,
  getCategoryConfig,
  getTokenReduction,
  PROVIDER_CATEGORIES,
  PROVIDER_TO_CATEGORY,
} from '~/lib/common/prompts/provider-categories';

describe('Provider Categories', () => {
  describe('PROVIDER_CATEGORIES', () => {
    it('should have all 6 category configs', () => {
      const categories = Object.keys(PROVIDER_CATEGORIES);
      expect(categories).toHaveLength(6);
      expect(categories).toContain('high-context');
      expect(categories).toContain('reasoning');
      expect(categories).toContain('speed-optimized');
      expect(categories).toContain('local-models');
      expect(categories).toContain('coding-specialized');
      expect(categories).toContain('standard');
    });

    it('should have valid token reduction values', () => {
      Object.values(PROVIDER_CATEGORIES).forEach((config) => {
        expect(config.tokenReduction).toBeGreaterThanOrEqual(0);
        expect(config.tokenReduction).toBeLessThanOrEqual(30);

        // Valid values: 0, 15, 30
        expect([0, 15, 30]).toContain(config.tokenReduction);
      });
    });

    it('should have concise preference for reasoning and speed-optimized', () => {
      expect(PROVIDER_CATEGORIES.reasoning.prefersConcisePrompts).toBe(true);
      expect(PROVIDER_CATEGORIES['speed-optimized'].prefersConcisePrompts).toBe(true);
    });

    it('should not prefer concise for high-context and coding-specialized', () => {
      expect(PROVIDER_CATEGORIES['high-context'].prefersConcisePrompts).toBe(false);
      expect(PROVIDER_CATEGORIES['coding-specialized'].prefersConcisePrompts).toBe(false);
    });
  });

  describe('PROVIDER_TO_CATEGORY', () => {
    it('should map common providers', () => {
      expect(PROVIDER_TO_CATEGORY.OpenAI).toBeDefined();
      expect(PROVIDER_TO_CATEGORY.Anthropic).toBeDefined();
      expect(PROVIDER_TO_CATEGORY.Google).toBeDefined();
      expect(PROVIDER_TO_CATEGORY.Groq).toBeDefined();
      expect(PROVIDER_TO_CATEGORY.Ollama).toBeDefined();
      expect(PROVIDER_TO_CATEGORY.Deepseek).toBeDefined();
    });

    it('should categorize Groq as speed-optimized', () => {
      expect(PROVIDER_TO_CATEGORY.Groq).toBe('speed-optimized');
    });

    it('should categorize Ollama as local-models', () => {
      expect(PROVIDER_TO_CATEGORY.Ollama).toBe('local-models');
    });

    it('should categorize Anthropic and Google as high-context', () => {
      expect(PROVIDER_TO_CATEGORY.Anthropic).toBe('high-context');
      expect(PROVIDER_TO_CATEGORY.Google).toBe('high-context');
    });

    it('should categorize Deepseek as coding-specialized', () => {
      expect(PROVIDER_TO_CATEGORY.Deepseek).toBe('coding-specialized');
    });
  });

  describe('getProviderCategory', () => {
    it('should return correct category for known providers', () => {
      expect(getProviderCategory('OpenAI')).toBe('standard');
      expect(getProviderCategory('Groq')).toBe('speed-optimized');
      expect(getProviderCategory('Ollama')).toBe('local-models');
    });

    it('should default to standard for unknown providers', () => {
      expect(getProviderCategory('UnknownProvider')).toBe('standard');
    });

    it('should detect reasoning models by model name', () => {
      const modelDetails = {
        name: 'o1-preview',
        label: 'o1-preview',
        provider: 'OpenAI',
        maxTokenAllowed: 128000,
      };
      expect(getProviderCategory('OpenAI', modelDetails)).toBe('reasoning');
    });

    it('should detect fast models by name patterns', () => {
      const fastModel = {
        name: 'gpt-4-turbo',
        label: 'gpt-4-turbo',
        provider: 'OpenAI',
        maxTokenAllowed: 128000,
      };
      expect(getProviderCategory('OpenAI', fastModel)).toBe('speed-optimized');
    });
  });

  describe('getCategoryConfig', () => {
    it('should return config for valid category', () => {
      const config = getCategoryConfig('reasoning');
      expect(config).toBeDefined();
      expect(config.category).toBe('reasoning');
      expect(config.name).toBeDefined();
      expect(config.description).toBeDefined();
    });

    it('should return all required fields', () => {
      const config = getCategoryConfig('standard');
      expect(config.category).toBe('standard');
      expect(config.name).toBeTruthy();
      expect(config.description).toBeTruthy();
      expect(typeof config.tokenReduction).toBe('number');
      expect(typeof config.prefersConcisePrompts).toBe('boolean');
    });
  });

  describe('getTokenReduction', () => {
    it('should return 0 for standard providers', () => {
      expect(getTokenReduction('standard')).toBe(0);
    });

    it('should return 30 for reasoning models', () => {
      expect(getTokenReduction('reasoning')).toBe(30);
    });

    it('should return 30 for speed-optimized', () => {
      expect(getTokenReduction('speed-optimized')).toBe(30);
    });

    it('should return 15 for local models', () => {
      expect(getTokenReduction('local-models')).toBe(15);
    });

    it('should return 0 for high-context', () => {
      expect(getTokenReduction('high-context')).toBe(0);
    });
  });
});
