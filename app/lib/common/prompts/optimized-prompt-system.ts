/**
 * Optimized Prompt System - Main Integration
 *
 * This file provides the main interface for the new prompt optimization system,
 * integrating all the components built during the optimization project:
 *
 * 1. Intent Detection System
 * 2. Mode-Specific Prompt Builders
 * 3. Rule Constants and Schema Management
 * 4. Compressed Supabase and Design Rules
 * 5. Dynamic Rule Injection
 * 6. 3-Tier Verbosity System
 * 7. Provider-Verbosity Mapping
 * 8. Performance Testing and Benchmarking
 */

import type { Message } from 'ai';
import type { DesignScheme } from '~/types/design-scheme';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { SupabaseConnectionState } from '~/lib/stores/supabase';
import { detectIntent } from './intent-detection';
import { generateOptimizedPrompt } from './dynamic-rule-injector';
import { getOptimalVerbosity } from './provider-verbosity-mapping';
import { runPerformanceBenchmark } from './performance-benchmarks';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('OptimizedPromptSystem');

export interface OptimizedPromptOptions {
  // Core configuration
  providerName: string;
  modelDetails?: ModelInfo;
  chatMode?: 'discuss' | 'build';
  projectType?: 'web' | 'mobile' | 'node' | 'auto';

  // Context
  cwd?: string;
  allowedHtmlElements?: string[];
  designScheme?: DesignScheme;
  contextOptimization?: boolean;

  // Database
  supabase?: {
    isConnected: boolean;
    hasSelectedProject: boolean;
    credentials?: {
      anonKey?: string;
      supabaseUrl?: string;
    };
  };
  supabaseConnection?: SupabaseConnectionState;

  // Optimization settings
  maxTokens?: number;
  forceVerbosity?: 'minimal' | 'standard' | 'detailed';
  enableBenchmarking?: boolean;

  // User context for intent detection
  messages?: Message[];
  userExperience?: 'beginner' | 'intermediate' | 'expert';
}

export interface OptimizedPromptResult {
  prompt: string;
  metadata: {
    tokenCount: number;
    tokenReduction: number; // Percentage compared to baseline
    verbosity: 'minimal' | 'standard' | 'detailed';
    providerCategory: string;
    intentCategory?: string;
    intentConfidence?: string;
    optimizationsApplied: string[];
    generationTime: number;
    validationPassed: boolean;
  };
  performance?: {
    comparedToBaseline: number; // Percentage improvement
    efficiency: 'excellent' | 'good' | 'moderate' | 'poor';
    recommendation: string;
  };
}

/**
 * Main class for the optimized prompt system
 */
export class OptimizedPromptSystem {
  private _benchmarkingEnabled: boolean;

  constructor(enableBenchmarking = false) {
    this._benchmarkingEnabled = enableBenchmarking;
  }

  /**
   * Generates an optimized prompt with full intent detection and optimization
   */
  async generatePrompt(options: OptimizedPromptOptions): Promise<OptimizedPromptResult> {
    const startTime = Date.now();

    try {
      // Step 1: Detect intent from messages if provided
      let detectedIntent;

      if (options.messages && options.messages.length > 0) {
        detectedIntent = detectIntent(options.messages, {
          chatMode: options.chatMode,
          hasExistingFiles: options.projectType !== 'auto', // Simple heuristic
          supabaseConnected: options.supabase?.isConnected,
          projectType: options.projectType,
        });

        logger.info('Intent detected', {
          category: detectedIntent.category,
          confidence: detectedIntent.confidence,
          complexity: detectedIntent.context.complexity,
        });
      }

      // Step 2: Generate optimized prompt using dynamic rule injection
      const result = generateOptimizedPrompt({
        providerName: options.providerName,
        modelDetails: options.modelDetails,
        chatMode: options.chatMode || 'build',
        projectType: options.projectType || 'auto',
        cwd: options.cwd,
        allowedHtmlElements: options.allowedHtmlElements,
        designScheme: options.designScheme,
        contextOptimization: options.contextOptimization,
        supabase: options.supabase,
        supabaseConnection: options.supabaseConnection,
        detectedIntent,
        maxTokens: options.maxTokens,
        forceVerbosity: options.forceVerbosity,
      });

      const generationTime = Date.now() - startTime;

      // Step 3: Calculate performance metrics
      let performance;

      if (this._benchmarkingEnabled) {
        performance = await this._calculatePerformance(options, result);
      }

      // Step 4: Calculate token reduction compared to baseline
      const tokenReduction = await this._calculateTokenReduction(options, result);

      return {
        prompt: result.content,
        metadata: {
          tokenCount: result.metadata.estimatedTokens,
          tokenReduction,
          verbosity: result.metadata.verbosityLevel,
          providerCategory: result.metadata.providerCategory,
          intentCategory: result.metadata.intentCategory,
          intentConfidence: detectedIntent?.confidence,
          optimizationsApplied: this._getOptimizationList(result),
          generationTime,
          validationPassed: result.metadata.validationResults?.valid ?? true,
        },
        performance,
      };
    } catch (error) {
      logger.error('Prompt generation failed', { error, options });
      throw new Error(`Optimized prompt generation failed: ${error}`);
    }
  }

  /**
   * Quick generation without benchmarking for production use
   */
  async generateQuickPrompt(options: OptimizedPromptOptions): Promise<string> {
    const result = await this.generatePrompt({ ...options, enableBenchmarking: false });
    return result.prompt;
  }

  /**
   * Batch generation for testing and comparison
   */
  async generateBatchPrompts(
    baseOptions: OptimizedPromptOptions,
    variations: {
      providers?: string[];
      verbosities?: ('minimal' | 'standard' | 'detailed')[];
      chatModes?: ('discuss' | 'build')[];
    },
  ): Promise<Array<OptimizedPromptResult & { config: Partial<OptimizedPromptOptions> }>> {
    const results: Array<OptimizedPromptResult & { config: Partial<OptimizedPromptOptions> }> = [];

    const providers = variations.providers || [baseOptions.providerName];
    const verbosities = variations.verbosities || ['minimal', 'standard', 'detailed'];
    const chatModes = variations.chatModes || [baseOptions.chatMode || 'build'];

    for (const providerName of providers) {
      for (const verbosity of verbosities) {
        for (const chatMode of chatModes) {
          const config = {
            ...baseOptions,
            providerName,
            forceVerbosity: verbosity,
            chatMode,
            enableBenchmarking: false, // Disable for batch operations
          };

          const result = await this.generatePrompt(config);
          results.push({
            ...result,
            config: { providerName, forceVerbosity: verbosity, chatMode },
          });
        }
      }
    }

    return results;
  }

  /**
   * Analyzes and recommends optimal settings for a provider
   */
  async analyzeProvider(
    providerName: string,
    modelDetails?: ModelInfo,
    userExperience: 'beginner' | 'intermediate' | 'expert' = 'intermediate',
  ): Promise<{
    recommendedVerbosity: 'minimal' | 'standard' | 'detailed';
    estimatedTokenReduction: number;
    strengths: string[];
    limitations: string[];
    recommendations: string[];
  }> {
    // Test with a sample scenario
    const testOptions: OptimizedPromptOptions = {
      providerName,
      modelDetails,
      chatMode: 'build',
      messages: [{ id: 'test-analyze', role: 'user', content: 'Create a simple React component with TypeScript' }],
      userExperience,
    };

    const result = await this.generatePrompt(testOptions);

    const { verbosity, reasoning } = getOptimalVerbosity(result.metadata.providerCategory as any, {
      intentComplexity: 'moderate',
      userExperience,
      taskType: 'creative',
    });

    return {
      recommendedVerbosity: verbosity,
      estimatedTokenReduction: result.metadata.tokenReduction,
      strengths: this._getProviderStrengths(result.metadata.providerCategory),
      limitations: this._getProviderLimitations(result.metadata.providerCategory),
      recommendations: [
        reasoning,
        `Use ${verbosity} verbosity for optimal performance`,
        result.performance?.recommendation || 'Monitor performance over time',
      ],
    };
  }

  /**
   * Private helper methods
   */
  private async _calculatePerformance(
    options: OptimizedPromptOptions,
    _result: any,
  ): Promise<OptimizedPromptResult['performance']> {
    // Run a quick benchmark comparison
    const benchmark = await runPerformanceBenchmark(
      {
        chatMode: options.chatMode,
        projectType: options.projectType,
        supabase: options.supabase,
      },
      [options.providerName],
    );

    const comparison = benchmark.comparisons[0];

    if (!comparison) {
      return {
        comparedToBaseline: 0,
        efficiency: 'moderate',
        recommendation: 'Unable to calculate performance metrics',
      };
    }

    let efficiency: 'excellent' | 'good' | 'moderate' | 'poor' = 'moderate';

    if (comparison.improvement.tokenReduction > 50) {
      efficiency = 'excellent';
    } else if (comparison.improvement.tokenReduction > 25) {
      efficiency = 'good';
    } else if (comparison.improvement.tokenReduction < 0) {
      efficiency = 'poor';
    }

    return {
      comparedToBaseline: comparison.improvement.tokenReduction,
      efficiency,
      recommendation: comparison.recommendation,
    };
  }

  private async _calculateTokenReduction(options: OptimizedPromptOptions, result: any): Promise<number> {
    // Quick estimation compared to a standard baseline
    const estimatedBaseline = 1000; // Average baseline token count
    return Math.max(0, Math.round(((estimatedBaseline - result.metadata.estimatedTokens) / estimatedBaseline) * 100));
  }

  private _getOptimizationList(result: any): string[] {
    const optimizations: string[] = [];

    if (result.metadata.optimizationApplied) {
      optimizations.push('Provider-specific optimization');
    }

    optimizations.push(`Verbosity: ${result.metadata.verbosityLevel}`);

    if (result.metadata.rulesIncluded.length < 8) {
      optimizations.push('Rule filtering');
    }

    if (result.metadata.intentCategory) {
      optimizations.push('Intent-based optimization');
    }

    return optimizations;
  }

  private _getProviderStrengths(category: string): string[] {
    const strengthsMap: Record<string, string[]> = {
      'high-context': ['Large context windows', 'Detailed instructions', 'Complex reasoning'],
      reasoning: ['Internal reasoning', 'Problem solving', 'Minimal guidance needed'],
      'speed-optimized': ['Fast response times', 'Efficient processing', 'Quick iterations'],
      'local-models': ['Privacy', 'No network dependency', 'Customizable'],
      'coding-specialized': ['Code generation', 'Programming patterns', 'Technical accuracy'],
      standard: ['Balanced performance', 'Reliability', 'Wide availability'],
    };

    return strengthsMap[category] || ['General capabilities'];
  }

  private _getProviderLimitations(category: string): string[] {
    const limitationsMap: Record<string, string[]> = {
      'high-context': ['Slower processing', 'Higher cost', 'May be overkill'],
      reasoning: ['Less predictable', 'May over-think', 'Limited formatting control'],
      'speed-optimized': ['Limited context', 'Less nuanced', 'Basic capabilities'],
      'local-models': ['Resource constraints', 'Limited capabilities', 'Setup complexity'],
      'coding-specialized': ['May over-engineer', 'Less general purpose', 'Verbose'],
      standard: ['Average performance', 'Not specialized', 'May not excel'],
    };

    return limitationsMap[category] || ['General limitations'];
  }
}

/**
 * Factory functions for easy usage
 */

/**
 * Quick prompt generation for production use
 */
export async function generateOptimizedPromptQuick(options: OptimizedPromptOptions): Promise<string> {
  const system = new OptimizedPromptSystem(false);
  return await system.generateQuickPrompt(options);
}

/**
 * Full prompt generation with performance analysis
 */
export async function generateOptimizedPromptFull(options: OptimizedPromptOptions): Promise<OptimizedPromptResult> {
  const system = new OptimizedPromptSystem(true);
  return await system.generatePrompt(options);
}

/**
 * Provider analysis and recommendations
 */
export async function analyzeProviderOptimal(
  providerName: string,
  modelDetails?: ModelInfo,
  userExperience: 'beginner' | 'intermediate' | 'expert' = 'intermediate',
): Promise<ReturnType<OptimizedPromptSystem['analyzeProvider']>> {
  const system = new OptimizedPromptSystem(true);
  return await system.analyzeProvider(providerName, modelDetails, userExperience);
}

/**
 * Usage examples and documentation
 */
export const USAGE_EXAMPLES = {
  quickGeneration: `
// Quick prompt generation for production
const prompt = await generateOptimizedPromptQuick({
  providerName: 'OpenAI',
  chatMode: 'build',
  messages: [{ role: 'user', content: 'Create a login form' }]
});
`,

  fullAnalysis: `
// Full prompt generation with performance analysis
const result = await generateOptimizedPromptFull({
  providerName: 'Anthropic',
  chatMode: 'build',
  projectType: 'web',
  supabase: { isConnected: true, hasSelectedProject: true },
  messages: [{ role: 'user', content: 'Add user authentication' }],
  enableBenchmarking: true
});

console.log(\`Token reduction: \${result.metadata.tokenReduction}%\`);
console.log(\`Efficiency: \${result.performance?.efficiency}\`);
`,

  providerAnalysis: `
// Analyze provider capabilities and get recommendations
const analysis = await analyzeProviderOptimal('Groq', modelDetails, 'expert');
console.log(\`Recommended verbosity: \${analysis.recommendedVerbosity}\`);
console.log(\`Estimated reduction: \${analysis.estimatedTokenReduction}%\`);
`,

  batchTesting: `
// Batch testing across providers and settings
const system = new OptimizedPromptSystem(true);
const results = await system.generateBatchPrompts(baseOptions, {
  providers: ['OpenAI', 'Anthropic', 'Groq'],
  verbosities: ['minimal', 'standard', 'detailed']
});

// Analyze results
const bestResult = results.reduce((best, current) =>
  current.metadata.tokenReduction > best.metadata.tokenReduction ? current : best
);
`,
};

/**
 * System configuration and constants
 */
export const OPTIMIZATION_CONFIG = {
  DEFAULT_VERBOSITY: 'standard' as const,
  MAX_TOKEN_REDUCTION_TARGET: 60, // Percentage
  MIN_ACCEPTABLE_REDUCTION: 10, // Percentage
  BENCHMARK_SAMPLE_SIZE: 5,
  PERFORMANCE_THRESHOLDS: {
    EXCELLENT: 50, // Token reduction percentage
    GOOD: 25,
    MODERATE: 10,
    POOR: 0,
  },
};

export default OptimizedPromptSystem;
