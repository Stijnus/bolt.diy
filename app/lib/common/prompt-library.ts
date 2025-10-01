import { createUnifiedPrompt } from './prompts/unified-prompt';
import { createProviderOptimizedPrompt } from './prompts/provider-optimized-prompt';
import type { DesignScheme } from '~/types/design-scheme';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { SupabaseConnectionState } from '~/lib/stores/supabase';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('PromptLibrary');

export interface PromptOptions {
  cwd: string;
  allowedHtmlElements: string[];
  modificationTagName: string;
  designScheme?: DesignScheme;
  chatMode?: 'discuss' | 'build';
  contextOptimization?: boolean;
  supabaseConnection?: SupabaseConnectionState;
  projectType?: 'web' | 'mobile' | 'node' | 'auto';
}

export interface ProviderAwarePromptOptions extends PromptOptions {
  providerName?: string;
  modelDetails?: ModelInfo;
}

export class PromptLibrary {
  static library: Record<
    string,
    {
      label: string;
      description: string;
      get: (options: PromptOptions) => string;
    }
  > = {
    default: {
      label: 'Unified Prompt',
      description: 'Standard prompt with context-aware loading and balanced token usage',
      get: (options) =>
        createUnifiedPrompt({
          cwd: options.cwd,
          allowedHtmlElements: options.allowedHtmlElements,
          modificationTagName: options.modificationTagName,
          designScheme: options.designScheme,
          chatMode: options.chatMode,
          contextOptimization: options.contextOptimization,
          supabaseConnection: options.supabaseConnection,
          projectType: options.projectType,
        }),
    },
    'provider-optimized': {
      label: 'Provider-Optimized Prompt',
      description: "Provider-specific prompts optimized for each LLM's unique characteristics",
      get: (options) => {
        // This will be called with provider-aware options
        const providerOptions = options as ProviderAwarePromptOptions;

        if (!providerOptions.providerName) {
          // Fallback to unified prompt if no provider specified
          return this.library.default.get(options);
        }

        return createProviderOptimizedPrompt({
          cwd: options.cwd,
          allowedHtmlElements: options.allowedHtmlElements,
          modificationTagName: options.modificationTagName,
          designScheme: options.designScheme,
          chatMode: options.chatMode,
          contextOptimization: options.contextOptimization,
          supabaseConnection: options.supabaseConnection,
          projectType: options.projectType,
          providerName: providerOptions.providerName,
          modelDetails: providerOptions.modelDetails,
        });
      },
    },
  };

  static getList() {
    return Object.entries(this.library).map(([key, value]) => {
      const { label, description } = value;
      return {
        id: key,
        label,
        description,
      };
    });
  }

  static getPromptFromLibrary(promptId: string, options: PromptOptions): string {
    const prompt = this.library[promptId];

    if (!prompt) {
      logger.error('Prompt not found in library', { promptId, availablePrompts: Object.keys(this.library) });
      throw new Error(`Prompt '${promptId}' not found. Available prompts: ${Object.keys(this.library).join(', ')}`);
    }

    try {
      return prompt.get(options);
    } catch (error) {
      logger.error('Failed to generate prompt', {
        promptId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Failed to generate prompt '${promptId}': ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Provider-aware prompt selection
   * Automatically selects the best prompt based on provider capabilities
   */
  static getProviderAwarePrompt(options: ProviderAwarePromptOptions): string {
    // If provider is specified, use provider-optimized prompt
    if (options.providerName) {
      return this.library['provider-optimized'].get(options);
    }

    // Fallback to default unified prompt
    return this.library.default.get(options);
  }

  /**
   * Main method with provider awareness - used by stream-text.ts
   */
  static getPromptFromLibraryWithProvider(
    promptId: string,
    options: PromptOptions,
    providerName?: string,
    modelDetails?: ModelInfo,
  ): string {
    const providerAwareOptions: ProviderAwarePromptOptions = {
      ...options,
      providerName,
      modelDetails,
    };

    // If using default prompt but provider is specified, use provider-optimized instead
    if (promptId === 'default' && providerName) {
      return this.library['provider-optimized'].get(providerAwareOptions);
    }

    return this.getPromptFromLibrary(promptId, providerAwareOptions);
  }
}
