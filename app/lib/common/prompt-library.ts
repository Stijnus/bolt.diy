import { getFineTunedPrompt } from './prompts/new-prompt';
import optimized from './prompts/optimized';
import { getSystemPrompt } from './prompts/prompts';
import type { DesignScheme } from '~/types/design-scheme';

export interface PromptOptions {
  cwd: string;
  allowedHtmlElements: string[];
  modificationTagName: string;
  designScheme?: DesignScheme;
  supabase?: {
    isConnected: boolean;
    hasSelectedProject: boolean;
    credentials?: {
      anonKey?: string;
      supabaseUrl?: string;
    };
  };
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
      label: 'Optimized Prompt',
      description: 'Consolidated, optimized system prompt (single source of truth)',
      get: (options) => optimized(options),
    },
    original: {
      label: 'Optimized Prompt (legacy alias)',
      description: 'Alias of the consolidated optimized prompt for backward compatibility',
      get: (options) => optimized(options),
    },
    optimized: {
      label: 'Optimized Prompt',
      description: 'Consolidated, optimized system prompt (single source of truth)',
      get: (options) => optimized(options),
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
  static getPropmtFromLibrary(promptId: string, options: PromptOptions) {
    const prompt = this.library[promptId];

    if (!prompt) {
      throw 'Prompt Now Found';
    }

    return this.library[promptId]?.get(options);
  }
}
