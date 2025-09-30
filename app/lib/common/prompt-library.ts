import { createUnifiedPrompt } from './prompts/unified-prompt';
import { createProviderOptimizedPrompt } from './prompts/provider-optimized-prompt';
import { generateOptimizedPromptQuick } from './prompts/optimized-prompt-system';
import type { DesignScheme } from '~/types/design-scheme';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { Message } from 'ai';
import type { SupabaseConnectionState } from '~/lib/stores/supabase';

export interface PromptOptions {
  cwd: string;
  allowedHtmlElements: string[];
  modificationTagName: string;
  designScheme?: DesignScheme;
  chatMode?: 'discuss' | 'build';
  contextOptimization?: boolean;
  supabase?: {
    isConnected: boolean;
    hasSelectedProject: boolean;
    credentials?: {
      anonKey?: string;
      supabaseUrl?: string;
    };
  };
  supabaseConnection?: SupabaseConnectionState;
  projectType?: 'web' | 'mobile' | 'node' | 'auto';
  messages?: Message[];
  maxTokens?: number;
  forceVerbosity?: 'minimal' | 'standard' | 'detailed';
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
      get: (options: PromptOptions) => string | Promise<string>;
    }
  > = {
    default: {
      label: 'Unified Prompt',
      description: 'Optimized dynamic prompt with context-aware loading and 40-60% token reduction',
      get: (options) =>
        createUnifiedPrompt({
          cwd: options.cwd,
          allowedHtmlElements: options.allowedHtmlElements,
          modificationTagName: options.modificationTagName,
          designScheme: options.designScheme,
          chatMode: options.chatMode,
          contextOptimization: options.contextOptimization,
          supabase: options.supabase,
          supabaseConnection: options.supabaseConnection,
          projectType: options.projectType,
        }),
    },
    'provider-optimized': {
      label: 'Provider-Optimized Prompt',
      description: "Provider-specific prompts optimized for each LLM's unique characteristics and capabilities",
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
          supabase: options.supabase,
          supabaseConnection: options.supabaseConnection,
          projectType: options.projectType,
          providerName: providerOptions.providerName,
          modelDetails: providerOptions.modelDetails,
        });
      },
    },
    optimized: {
      label: 'AI-Optimized Prompt',
      description: 'Next-generation prompt with intent detection, dynamic rule injection, and 60-80% token reduction',
      get: async (options) => {
        const providerOptions = options as ProviderAwarePromptOptions;

        if (!providerOptions.providerName) {
          // Fallback to unified prompt if no provider specified
          return this.library.default.get(options);
        }

        try {
          return await generateOptimizedPromptQuick({
            providerName: providerOptions.providerName,
            modelDetails: providerOptions.modelDetails,
            chatMode: options.chatMode,
            projectType: options.projectType,
            cwd: options.cwd,
            allowedHtmlElements: options.allowedHtmlElements,
            designScheme: options.designScheme,
            contextOptimization: options.contextOptimization,
            supabase: options.supabase,
            supabaseConnection: options.supabaseConnection,
            messages: options.messages,
            maxTokens: options.maxTokens,
            forceVerbosity: options.forceVerbosity,
          });
        } catch (error) {
          console.warn('Optimized prompt generation failed, falling back to provider-optimized:', error);
          return this.library['provider-optimized'].get(options);
        }
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

  static async getPromptFromLibrary(promptId: string, options: PromptOptions) {
    const prompt = this.library[promptId];

    if (!prompt) {
      throw 'Prompt Not Found';
    }

    return await this.library[promptId]?.get(options);
  }

  /**
   * Provider-aware prompt selection
   * Automatically selects the best prompt based on provider capabilities
   */
  static async getProviderAwarePrompt(options: ProviderAwarePromptOptions): Promise<string> {
    // If provider-optimized prompt is specifically requested
    if (options.providerName) {
      return await this.library['provider-optimized'].get(options);
    }

    // Fallback to default unified prompt
    return await this.library.default.get(options);
  }

  /**
   * Legacy method with provider awareness
   */
  static async getPromptFromLibraryWithProvider(
    promptId: string,
    options: PromptOptions,
    providerName?: string,
    modelDetails?: ModelInfo,
    messages?: Message[],
  ): Promise<string> {
    const providerAwareOptions: ProviderAwarePromptOptions = {
      ...options,
      providerName,
      modelDetails,
      messages,
    };

    // If using default prompt but provider is specified, use provider-optimized instead
    if (promptId === 'default' && providerName) {
      return await this.library['provider-optimized'].get(providerAwareOptions);
    }

    return await this.getPromptFromLibrary(promptId, providerAwareOptions);
  }
}
