import { getCodingPrompt } from './prompts/coding-prompt';
import { getLightweightPrompt } from './prompts/lightweight-prompt';
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

export interface PromptInfo {
  id: string;
  label: string;
  description: string;
  icon: string;
  features: string[];
  bestFor: string[];
  tokenUsage: 'low' | 'medium' | 'high';
  complexity: 'simple' | 'moderate' | 'advanced';
  recommended?: boolean;
}

export class PromptLibrary {
  static library: Record<
    string,
    {
      label: string;
      description: string;
      get: (options: PromptOptions) => string;
      info: PromptInfo;
    }
  > = {
    coding: {
      label: 'Full-Featured Coding',
      description:
        'Complete development environment with advanced AI capabilities, design systems, and mobile app support. Best for creating new projects and complex development tasks.',
      get: (options) => getCodingPrompt(options.cwd, options.supabase, options.designScheme),
      info: {
        id: 'coding',
        label: 'Full-Featured Coding',
        description:
          'Complete development environment with advanced AI capabilities, design systems, and mobile app support. Perfect for creating new projects and complex development tasks.',
        icon: 'i-ph:code-bold',
        features: [
          'Advanced Token Management',
          'Mobile App Development',
          'Production-Ready Designs',
          'Database Integration',
          'Component Architecture',
          'Accessibility Support',
          'Real-time Optimization',
          'Multi-framework Support',
        ],
        bestFor: [
          'New Projects',
          'Complex Applications',
          'Mobile Apps',
          'Full-Stack Development',
          'Design Systems',
          'Production Apps',
        ],
        tokenUsage: 'high',
        complexity: 'advanced',
        recommended: true,
      },
    },
    lightweight: {
      label: 'Lightweight & Fast',
      description:
        'Streamlined prompt for quick tasks, simple fixes, and when response speed matters most. Lower token usage with essential features only.',
      get: (options) => getLightweightPrompt(options),
      info: {
        id: 'lightweight',
        label: 'Lightweight & Fast',
        description:
          'Streamlined prompt for quick tasks, simple fixes, and when response speed matters most. Optimized for speed with essential features only.',
        icon: 'i-ph:lightning-fill',
        features: [
          'Fast Responses',
          'Low Token Usage',
          'Essential Features',
          'Quick Fixes',
          'Basic Artifacts',
          'Simple Projects',
          'Performance Optimized',
          'Minimal Dependencies',
        ],
        bestFor: [
          'Quick Fixes',
          'Simple Tasks',
          'Prototyping',
          'Learning',
          'Speed-Critical Work',
          'Resource-Limited Usage',
        ],
        tokenUsage: 'low',
        complexity: 'simple',
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

  static getInfoList(): PromptInfo[] {
    return Object.entries(this.library).map(([key, value]) => ({
      ...value.info,
      id: key,
    }));
  }

  static getPromptInfo(promptId: string): PromptInfo | null {
    const prompt = this.library[promptId];
    return prompt ? { ...prompt.info, id: promptId } : null;
  }
  static getPropmtFromLibrary(promptId: string, options: PromptOptions) {
    const prompt = this.library[promptId];

    if (!prompt) {
      throw 'Prompt Not Found';
    }

    return this.library[promptId]?.get(options);
  }
}
