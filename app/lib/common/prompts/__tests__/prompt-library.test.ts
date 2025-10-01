import { describe, it, expect } from 'vitest';
import { PromptLibrary } from '~/lib/common/prompt-library';

describe('PromptLibrary', () => {
  const baseOptions = {
    cwd: '/test',
    allowedHtmlElements: ['div', 'span'],
    modificationTagName: 'boltArtifact',
  };

  describe('getList', () => {
    it('should return list of available prompts', () => {
      const list = PromptLibrary.getList();
      expect(list).toBeInstanceOf(Array);
      expect(list.length).toBeGreaterThan(0);
      expect(list[0]).toHaveProperty('id');
      expect(list[0]).toHaveProperty('label');
      expect(list[0]).toHaveProperty('description');
    });

    it('should include default and provider-optimized prompts', () => {
      const list = PromptLibrary.getList();
      const ids = list.map((item) => item.id);
      expect(ids).toContain('default');
      expect(ids).toContain('provider-optimized');
    });

    it('should not include the removed optimized prompt', () => {
      const list = PromptLibrary.getList();
      const ids = list.map((item) => item.id);
      expect(ids).not.toContain('optimized');
    });
  });

  describe('getPromptFromLibrary', () => {
    it('should return a prompt for default', () => {
      const prompt = PromptLibrary.getPromptFromLibrary('default', baseOptions);
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
    });

    it('should return a prompt for provider-optimized when used with provider options', () => {
      const promptOptions: any = {
        ...baseOptions,
        providerName: 'OpenAI',
      };
      const prompt = PromptLibrary.getPromptFromLibrary('provider-optimized', promptOptions);
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
    });

    it('should throw error for invalid prompt id', () => {
      expect(() => {
        PromptLibrary.getPromptFromLibrary('invalid-prompt-id', baseOptions);
      }).toThrow(/not found/);
    });

    it('should include key sections in prompt', () => {
      const prompt = PromptLibrary.getPromptFromLibrary('default', baseOptions);

      // Check for essential prompt elements
      expect(prompt).toContain('Bolt');
      expect(prompt.length).toBeGreaterThan(100); // Should be substantial
    });
  });

  describe('getProviderAwarePrompt', () => {
    it('should return unified prompt when no provider specified', () => {
      const prompt = PromptLibrary.getProviderAwarePrompt(baseOptions);
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
    });

    it('should return provider-optimized prompt when provider specified', () => {
      const prompt = PromptLibrary.getProviderAwarePrompt({
        ...baseOptions,
        providerName: 'Anthropic',
      });
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
    });
  });

  describe('getPromptFromLibraryWithProvider', () => {
    it('should use provider-optimized for default when provider specified', () => {
      const prompt = PromptLibrary.getPromptFromLibraryWithProvider('default', baseOptions, 'OpenAI');
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
    });

    it('should use unified prompt for default when no provider specified', () => {
      const prompt = PromptLibrary.getPromptFromLibraryWithProvider('default', baseOptions);
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
    });

    it('should handle different chat modes', () => {
      const buildPrompt = PromptLibrary.getPromptFromLibraryWithProvider('default', {
        ...baseOptions,
        chatMode: 'build',
      });
      const discussPrompt = PromptLibrary.getPromptFromLibraryWithProvider('default', {
        ...baseOptions,
        chatMode: 'discuss',
      });

      expect(buildPrompt).not.toBe(discussPrompt);
      expect(buildPrompt.length).toBeGreaterThan(0);
      expect(discussPrompt.length).toBeGreaterThan(0);
    });
  });
});
