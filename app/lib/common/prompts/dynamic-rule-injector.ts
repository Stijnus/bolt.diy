import type { ModelInfo } from '~/lib/modules/llm/types';
import type { DesignScheme } from '~/types/design-scheme';
import type { DetectedIntent } from './intent-detection';
import type { ProviderCategory } from './provider-categories';
import type {
  VerbosityLevel,
  RuleCategory,
  IntentCategory,
  ProviderCategory as SchemaProviderCategory,
} from './schema-loader';
import { loadRuleData, getRulesForIntent, getProviderOptimization, validateContent } from './schema-loader';
import { getProviderCategory } from './provider-categories';
import { getCompressedSupabaseInstructions } from './compressed-supabase-rules';
import { getCompressedDesignInstructions } from './compressed-design-standards';
import { WORK_DIR } from '~/utils/constants';
import { allowedHTMLElements } from '~/utils/markdown';
import { createScopedLogger } from '~/utils/logger';
import type { SupabaseConnectionState } from '~/lib/stores/supabase';

const logger = createScopedLogger('DynamicRuleInjector');

export interface RuleInjectionOptions {
  cwd?: string;
  allowedHtmlElements?: string[];
  modificationTagName?: string;
  designScheme?: DesignScheme;
  chatMode?: 'discuss' | 'build';
  contextOptimization?: boolean;
  supabase?: {
    isConnected: boolean;
    hasSelectedProject: boolean;
    credentials?: { anonKey?: string; supabaseUrl?: string };
  };
  supabaseConnection?: SupabaseConnectionState;
  projectType?: 'web' | 'mobile' | 'node' | 'auto';
  providerName: string;
  modelDetails?: ModelInfo;
  detectedIntent?: DetectedIntent;
  maxTokens?: number;
  forceVerbosity?: VerbosityLevel;
}

export interface GeneratedPrompt {
  content: string;
  metadata: {
    estimatedTokens: number;
    verbosityLevel: VerbosityLevel;
    providerCategory: ProviderCategory;
    intentCategory?: string;
    rulesIncluded: string[];
    rulesExcluded: string[];
    optimizationApplied: boolean;
    validationResults?: {
      valid: boolean;
      violations: Array<{
        rule: string;
        severity: 'error' | 'warning' | 'info';
        description: string;
      }>;
    };
  };
}

/**
 * Main dynamic rule injection system
 */
export class DynamicRuleInjector {
  private _options: Required<
    Omit<
      RuleInjectionOptions,
      | 'detectedIntent'
      | 'maxTokens'
      | 'forceVerbosity'
      | 'supabase'
      | 'designScheme'
      | 'modelDetails'
      | 'supabaseConnection'
    >
  > &
    Pick<
      RuleInjectionOptions,
      | 'detectedIntent'
      | 'maxTokens'
      | 'forceVerbosity'
      | 'supabase'
      | 'designScheme'
      | 'modelDetails'
      | 'supabaseConnection'
    >;
  private _providerCategory: ProviderCategory;
  private _ruleData: ReturnType<typeof loadRuleData>;

  constructor(options: RuleInjectionOptions) {
    this._options = {
      cwd: WORK_DIR,
      allowedHtmlElements: allowedHTMLElements,
      modificationTagName: 'boltArtifact',
      chatMode: 'build',
      contextOptimization: false,
      projectType: 'auto',
      supabase: undefined,
      supabaseConnection: undefined,
      ...options,
    };

    this._providerCategory = getProviderCategory(options.providerName, options.modelDetails);
    this._ruleData = loadRuleData();
  }

  /**
   * Generates optimized prompt with dynamic rule injection
   */
  generatePrompt(): GeneratedPrompt {
    const startTime = Date.now();

    // Determine optimal verbosity level
    const verbosity = this._determineVerbosity();

    // Get provider optimization settings
    const optimization = getProviderOptimization(this._providerCategory as SchemaProviderCategory);

    // Get intent-specific rules
    const intentRules = this._getIntentSpecificRules(verbosity);

    // Build prompt sections
    const sections = this._buildPromptSections(verbosity, intentRules);

    // Apply token optimization if needed
    const optimizedSections = this._applyTokenOptimization(sections, verbosity, optimization);

    // Combine sections into final prompt
    const content = optimizedSections.join('\n\n');

    // Validate content
    const validationResults = this._validatePromptContent(content, intentRules.included);

    // Calculate metadata
    const estimatedTokens = this._estimatePromptTokens(content);
    const generationTime = Date.now() - startTime;

    logger.info('Dynamic prompt generated', {
      provider: this._options.providerName,
      providerCategory: this._providerCategory,
      verbosity,
      estimatedTokens,
      sectionsCount: optimizedSections.length,
      intentCategory: this._options.detectedIntent?.category,
      generationTime,
    });

    return {
      content,
      metadata: {
        estimatedTokens,
        verbosityLevel: verbosity,
        providerCategory: this._providerCategory,
        intentCategory: this._options.detectedIntent?.category,
        rulesIncluded: intentRules.included,
        rulesExcluded: intentRules.excluded,
        optimizationApplied: optimization.tokenReduction !== 0,
        validationResults,
      },
    };
  }

  /**
   * Determines optimal verbosity level based on context
   */
  private _determineVerbosity(): VerbosityLevel {
    // Explicit override
    if (this._options.forceVerbosity) {
      return this._options.forceVerbosity;
    }

    // Provider-based preference
    const optimization = getProviderOptimization(this._providerCategory as SchemaProviderCategory);
    let verbosity = optimization.preferredVerbosity;

    // Intent-based adjustments
    if (this._options.detectedIntent) {
      const intent = this._options.detectedIntent;

      // High confidence simple tasks can use minimal verbosity
      if (intent.confidence === 'high' && intent.context.complexity === 'simple') {
        verbosity = 'minimal';
      }

      // Complex tasks or low confidence need detailed verbosity
      if (intent.context.complexity === 'complex' || intent.confidence === 'low') {
        verbosity = verbosity === 'minimal' ? 'standard' : 'detailed';
      }

      // Bug fixes can often use minimal verbosity
      if (intent.category === 'fix-bug' && intent.confidence === 'high') {
        verbosity = 'minimal';
      }
    }

    // Token limit constraints
    if (this._options.maxTokens && this._options.maxTokens < 4000) {
      verbosity = 'minimal';
    } else if (this._options.maxTokens && this._options.maxTokens < 8000 && verbosity === 'detailed') {
      verbosity = 'standard';
    }

    return verbosity;
  }

  /**
   * Gets intent-specific rules and determines which to include/exclude
   */
  private _getIntentSpecificRules(verbosity: VerbosityLevel): {
    included: RuleCategory[];
    excluded: RuleCategory[];
    required: string;
    optional: string;
  } {
    if (!this._options.detectedIntent) {
      // Fallback for unknown intent
      const defaultRules: RuleCategory[] = ['webcontainer_constraints', 'technology_preferences'];

      if (this._options.chatMode === 'build') {
        defaultRules.push('artifact_creation', 'code_quality');
      }

      return {
        included: defaultRules,
        excluded: [],
        required: '',
        optional: '',
      };
    }

    const intentCategory = this._options.detectedIntent.category as IntentCategory;
    const placeholders = {
      cwd: this._options.cwd,
    };

    const intentRules = getRulesForIntent(intentCategory, verbosity, placeholders);
    const mapping = this._ruleData.intentRuleMappings[intentCategory];

    const included = [...mapping.required, ...mapping.optional] as RuleCategory[];
    const excluded = mapping.forbidden as RuleCategory[];

    return {
      included,
      excluded,
      required: intentRules.required,
      optional: intentRules.optional,
    };
  }

  /**
   * Builds prompt sections based on intent and context
   */
  private _buildPromptSections(
    verbosity: VerbosityLevel,
    intentRules: ReturnType<typeof this._getIntentSpecificRules>,
  ): string[] {
    const sections: string[] = [];

    // System header (always included)
    sections.push(this._getSystemHeader(verbosity));

    // Core rules based on intent
    if (intentRules.required) {
      sections.push(intentRules.required);
    }

    // Context-specific sections
    this._addContextSpecificSections(sections, verbosity);

    // Optional rules (if space allows)
    if (intentRules.optional && verbosity !== 'minimal') {
      sections.push(intentRules.optional);
    }

    // Mode-specific instructions
    sections.push(this._getModeInstructions(verbosity));

    return sections.filter((section) => section.trim() !== '');
  }

  /**
   * Adds context-specific sections (Supabase, Design, etc.)
   */
  private _addContextSpecificSections(sections: string[], verbosity: VerbosityLevel): void {
    const intent = this._options.detectedIntent;

    // Supabase instructions for database operations
    if (intent?.context.requiresDatabase || intent?.category === 'database-ops') {
      const supabaseState = this._options.supabaseConnection ||
        this._options.supabase || {
          isConnected: false,
          hasSelectedProject: false,
        };

      const supabaseInstructions = getCompressedSupabaseInstructions(supabaseState, verbosity);

      if (supabaseInstructions) {
        sections.push(supabaseInstructions);
      }
    }

    // Design instructions for UI work
    if (intent?.context.requiresDesign || intent?.category === 'design-ui') {
      const designContext = {
        isNewProject: intent?.category === 'create-project',
        requiresResponsive: true,
        hasExistingDesignSystem: false,
        targetComplexity: intent?.context.complexity || 'moderate',
      };

      const designInstructions = getCompressedDesignInstructions(verbosity, this._options.designScheme, designContext);

      if (designInstructions) {
        sections.push(designInstructions);
      }
    }

    // Mobile-specific instructions
    if (this._options.projectType === 'mobile') {
      sections.push(this._getMobileInstructions(verbosity));
    }

    // Message formatting
    sections.push(this._getMessageFormatting());
  }

  /**
   * Applies token optimization based on provider and constraints
   */
  private _applyTokenOptimization(
    sections: string[],
    verbosity: VerbosityLevel,
    optimization: ReturnType<typeof getProviderOptimization>,
  ): string[] {
    if (!this._options.maxTokens || optimization.tokenReduction <= 0) {
      return sections;
    }

    const currentTokens = this._estimatePromptTokens(sections.join('\n\n'));

    if (currentTokens <= this._options.maxTokens) {
      return sections;
    }

    logger.info('Applying token optimization', {
      currentTokens,
      maxTokens: this._options.maxTokens,
      reductionTarget: optimization.tokenReduction,
    });

    // Progressive optimization strategies
    let optimizedSections = [...sections];

    // 1. Remove optional sections first
    if (currentTokens > this._options.maxTokens && verbosity !== 'minimal') {
      optimizedSections = this._removeOptionalSections(optimizedSections);
    }

    // 2. Reduce verbosity if still too long
    const newTokens = this._estimatePromptTokens(optimizedSections.join('\n\n'));

    if (newTokens > this._options.maxTokens && verbosity !== 'minimal') {
      const lowerVerbosity = verbosity === 'detailed' ? 'standard' : 'minimal';
      return this._buildPromptSections(lowerVerbosity, this._getIntentSpecificRules(lowerVerbosity));
    }

    return optimizedSections;
  }

  /**
   * Removes optional sections to reduce token count
   */
  private _removeOptionalSections(sections: string[]): string[] {
    const optimization = getProviderOptimization(this._providerCategory as SchemaProviderCategory);
    const excludedSections = optimization.excludedSections;

    return sections.filter((section) => {
      // Keep sections that don't match excluded patterns
      return !excludedSections.some((excluded) => section.includes(excluded));
    });
  }

  /**
   * Validates generated prompt content
   */
  private _validatePromptContent(content: string, includedRules: RuleCategory[]) {
    return validateContent(content, includedRules);
  }

  /**
   * Estimates token count for the prompt
   */
  private _estimatePromptTokens(content: string): number {
    // Simple estimation: ~4 characters per token
    return Math.ceil(content.length / 4);
  }

  /**
   * Helper methods for generating specific sections
   */
  private _getSystemHeader(verbosity: VerbosityLevel): string {
    switch (verbosity) {
      case 'minimal':
        return 'You are Bolt, an AI coding assistant. The year is 2025.';
      case 'detailed':
        return 'You are Bolt, an expert AI assistant and exceptional senior software developer with vast knowledge across multiple programming languages, frameworks, and best practices, created by StackBlitz.\n\nThe year is 2025.';
      default:
        return 'You are Bolt, an expert AI assistant and exceptional senior software developer created by StackBlitz. The year is 2025.';
    }
  }

  private _getModeInstructions(verbosity: VerbosityLevel): string {
    if (this._options.chatMode === 'discuss') {
      return 'Provide guidance and plans without implementing code. Use "You should..." not "I will...".';
    }

    switch (verbosity) {
      case 'minimal':
        return "Build mode: Create artifacts with files and commands. Focus on user's request.";
      case 'detailed':
        return `<build_mode_instructions>
Build mode: Implement solutions using artifacts following the rules above.

CRITICAL PROJECT CONTEXT DETECTION:
- BEFORE starting implementation, analyze current project structure
- Look for existing package.json, app/, src/, or framework-specific files
- If project files exist, you are EXTENDING an existing project
- NEVER recreate entire projects when adding features

Response Requirements:
1. Think holistically before implementing
2. Use valid markdown for responses
3. Focus on addressing user's request without deviation
4. For design requests, ensure they are professional and production-worthy
5. Provide brief implementation outline before creating artifacts
</build_mode_instructions>`;
      default:
        return `<build_mode_instructions>
Build mode: Implement solutions using artifacts.
1. Analyze existing project structure first
2. Add to existing projects, don't recreate
3. Focus on user's request without deviation
</build_mode_instructions>`;
    }
  }

  private _getMobileInstructions(verbosity: VerbosityLevel): string {
    if (verbosity === 'minimal') {
      return 'Mobile: React Native/Expo only. Touch targets 44px+. Native patterns.';
    }

    return `<mobile_app_instructions>
React Native and Expo only supported frameworks.
- Touch targets minimum 44×44pt
- Native platform patterns
- Responsive design for mobile
- Performance optimizations
</mobile_app_instructions>`;
  }

  private _getMessageFormatting(): string {
    return `<message_formatting_info>
Available HTML elements: ${this._options.allowedHtmlElements.join(', ') || 'none'}
</message_formatting_info>`;
  }
}

/**
 * Main factory function for generating optimized prompts
 */
export function generateOptimizedPrompt(options: RuleInjectionOptions): GeneratedPrompt {
  const injector = new DynamicRuleInjector(options);
  return injector.generatePrompt();
}

/**
 * Convenience function for generating prompts with intent detection
 */
export function generatePromptWithIntent(
  options: Omit<RuleInjectionOptions, 'detectedIntent'>,
  detectedIntent: DetectedIntent,
): GeneratedPrompt {
  return generateOptimizedPrompt({
    ...options,
    detectedIntent,
  });
}

/**
 * Batch generation for testing different configurations
 */
export function generatePromptVariations(
  baseOptions: RuleInjectionOptions,
  variations: {
    verbosities?: VerbosityLevel[];
    providerNames?: string[];
    chatModes?: ('discuss' | 'build')[];
  },
): Array<GeneratedPrompt & { config: Partial<RuleInjectionOptions> }> {
  const results: Array<GeneratedPrompt & { config: Partial<RuleInjectionOptions> }> = [];

  const verbosities = variations.verbosities || ['minimal', 'standard', 'detailed'];
  const providerNames = variations.providerNames || [baseOptions.providerName];
  const chatModes = variations.chatModes || [baseOptions.chatMode || 'build'];

  for (const verbosity of verbosities) {
    for (const providerName of providerNames) {
      for (const chatMode of chatModes) {
        const config = {
          ...baseOptions,
          forceVerbosity: verbosity,
          providerName,
          chatMode,
        };

        const result = generateOptimizedPrompt(config);
        results.push({
          ...result,
          config: { forceVerbosity: verbosity, providerName, chatMode },
        });
      }
    }
  }

  return results;
}
