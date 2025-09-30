import type { ProviderCategory } from './provider-categories';
import type { VerbosityLevel } from './schema-loader';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('ProviderVerbosityMapping');

/**
 * Maps provider categories to optimal verbosity levels and provides
 * context-aware adjustments based on task complexity and intent confidence
 */

export interface VerbosityContext {
  intentComplexity?: 'simple' | 'moderate' | 'complex';
  intentConfidence?: 'high' | 'medium' | 'low';
  isExistingProject?: boolean;
  hasTimeConstraints?: boolean;
  isDebugging?: boolean;
  userExperience?: 'beginner' | 'intermediate' | 'expert';
  taskType?: 'creative' | 'analytical' | 'maintenance' | 'exploratory';
}

/**
 * Detailed mapping configuration for each provider category
 */
export const PROVIDER_VERBOSITY_MAPPING: Record<
  ProviderCategory,
  {
    baseVerbosity: VerbosityLevel;
    description: string;
    reasoning: string;
    contextAdjustments: {
      [K in keyof VerbosityContext]?: Record<string, VerbosityLevel>;
    };
    tokenBudget: {
      minimal: number;
      standard: number;
      detailed: number;
    };
    strengths: string[];
    limitations: string[];
  }
> = {
  'high-context': {
    baseVerbosity: 'detailed',
    description: 'Providers with massive context windows (400K-2M tokens) benefit from comprehensive instructions',
    reasoning:
      'Large context windows allow for detailed examples, comprehensive guidelines, and complex reasoning patterns',
    contextAdjustments: {
      intentComplexity: {
        simple: 'standard',
        moderate: 'detailed',
        complex: 'detailed',
      },
      userExperience: {
        beginner: 'detailed',
        intermediate: 'detailed',
        expert: 'standard',
      },
      taskType: {
        creative: 'detailed',
        analytical: 'detailed',
        maintenance: 'standard',
        exploratory: 'detailed',
      },
    },
    tokenBudget: {
      minimal: 800,
      standard: 1500,
      detailed: 3000,
    },
    strengths: [
      'Can handle complex, multi-step instructions',
      'Benefits from detailed examples and patterns',
      'Excellent for comprehensive code quality guidelines',
      'Can process extensive context and constraints',
    ],
    limitations: [
      'May be slower due to large context processing',
      'Can be overkill for simple tasks',
      'Higher computational cost',
    ],
  },

  reasoning: {
    baseVerbosity: 'minimal',
    description: 'Models with internal reasoning capabilities work best with concise, clear objectives',
    reasoning:
      'Reasoning models figure out implementation details internally, prefer direct instructions over verbose guidance',
    contextAdjustments: {
      intentComplexity: {
        simple: 'minimal',
        moderate: 'minimal',
        complex: 'standard',
      },
      intentConfidence: {
        high: 'minimal',
        medium: 'minimal',
        low: 'standard',
      },
      isDebugging: {
        true: 'minimal',
      },
      userExperience: {
        beginner: 'standard',
        intermediate: 'minimal',
        expert: 'minimal',
      },
    },
    tokenBudget: {
      minimal: 200,
      standard: 400,
      detailed: 600,
    },
    strengths: [
      'Excellent at figuring out implementation details',
      'Works well with minimal guidance',
      'Fast inference with concise prompts',
      'Good at problem-solving and debugging',
    ],
    limitations: [
      'May miss specific formatting requirements',
      'Less predictable output format',
      'Can over-reason simple tasks',
    ],
  },

  'speed-optimized': {
    baseVerbosity: 'minimal',
    description: 'Ultra-fast inference providers require minimal, focused instructions for optimal performance',
    reasoning: 'Speed-optimized models prioritize fast response times, minimal token usage maximizes their efficiency',
    contextAdjustments: {
      intentComplexity: {
        simple: 'minimal',
        moderate: 'minimal',
        complex: 'standard',
      },
      hasTimeConstraints: {
        true: 'minimal',
      },
      isDebugging: {
        true: 'minimal',
      },
      taskType: {
        maintenance: 'minimal',
        analytical: 'minimal',
        creative: 'standard',
        exploratory: 'standard',
      },
    },
    tokenBudget: {
      minimal: 150,
      standard: 300,
      detailed: 500,
    },
    strengths: [
      'Extremely fast response times',
      'Efficient token usage',
      'Good for quick fixes and iterations',
      'Excellent for debugging tasks',
    ],
    limitations: [
      'May miss nuanced requirements',
      'Less suitable for complex creative tasks',
      'Limited context awareness',
    ],
  },

  'local-models': {
    baseVerbosity: 'minimal',
    description: 'Self-hosted models benefit from simple, clear instructions due to resource constraints',
    reasoning: 'Local models often have limited resources, simplified instructions reduce processing overhead',
    contextAdjustments: {
      intentComplexity: {
        simple: 'minimal',
        moderate: 'standard',
        complex: 'standard',
      },
      userExperience: {
        beginner: 'standard',
        intermediate: 'minimal',
        expert: 'minimal',
      },
      taskType: {
        creative: 'standard',
        analytical: 'minimal',
        maintenance: 'minimal',
        exploratory: 'standard',
      },
    },
    tokenBudget: {
      minimal: 200,
      standard: 400,
      detailed: 600,
    },
    strengths: [
      'Privacy and data security',
      'No network dependency',
      'Cost-effective for high usage',
      'Customizable and fine-tunable',
    ],
    limitations: [
      'Limited model capabilities',
      'Resource constraints',
      'May struggle with complex tasks',
      'Requires local infrastructure',
    ],
  },

  'coding-specialized': {
    baseVerbosity: 'detailed',
    description: 'Models optimized for code generation benefit from comprehensive coding guidelines and patterns',
    reasoning: 'Coding-specialized models excel when given detailed code quality standards and architectural guidance',
    contextAdjustments: {
      intentComplexity: {
        simple: 'standard',
        moderate: 'detailed',
        complex: 'detailed',
      },
      isExistingProject: {
        true: 'detailed',
        false: 'standard',
      },
      userExperience: {
        beginner: 'detailed',
        intermediate: 'detailed',
        expert: 'standard',
      },
      taskType: {
        creative: 'detailed',
        analytical: 'detailed',
        maintenance: 'standard',
        exploratory: 'detailed',
      },
    },
    tokenBudget: {
      minimal: 400,
      standard: 800,
      detailed: 1500,
    },
    strengths: [
      'Excellent code generation capabilities',
      'Strong understanding of programming patterns',
      'Good at following coding standards',
      'Efficient at complex software architecture',
    ],
    limitations: [
      'May over-engineer simple solutions',
      'Can be verbose in explanations',
      'Less effective for non-coding tasks',
    ],
  },

  standard: {
    baseVerbosity: 'standard',
    description: 'Balanced providers work well with standard prompt complexity',
    reasoning:
      'Standard providers offer a good balance of capability and efficiency with moderate instruction complexity',
    contextAdjustments: {
      intentComplexity: {
        simple: 'minimal',
        moderate: 'standard',
        complex: 'detailed',
      },
      intentConfidence: {
        high: 'standard',
        medium: 'standard',
        low: 'detailed',
      },
      userExperience: {
        beginner: 'detailed',
        intermediate: 'standard',
        expert: 'minimal',
      },
      taskType: {
        creative: 'standard',
        analytical: 'standard',
        maintenance: 'minimal',
        exploratory: 'detailed',
      },
    },
    tokenBudget: {
      minimal: 300,
      standard: 600,
      detailed: 1200,
    },
    strengths: [
      'Good general-purpose capabilities',
      'Balanced performance across tasks',
      'Reasonable token efficiency',
      'Widely available and reliable',
    ],
    limitations: [
      'May not excel at specialized tasks',
      'Average performance in all areas',
      'Not optimized for specific use cases',
    ],
  },
};

/**
 * Gets optimal verbosity level for a provider with context adjustments
 */
export function getOptimalVerbosity(
  providerCategory: ProviderCategory,
  context: VerbosityContext = {},
): {
  verbosity: VerbosityLevel;
  reasoning: string;
  adjustments: string[];
} {
  const mapping = PROVIDER_VERBOSITY_MAPPING[providerCategory];
  let verbosity = mapping.baseVerbosity;
  const adjustments: string[] = [];

  // Apply context-based adjustments
  for (const [contextKey, contextValue] of Object.entries(context)) {
    if (contextValue !== undefined && mapping.contextAdjustments[contextKey as keyof VerbosityContext]) {
      const adjustment = mapping.contextAdjustments[contextKey as keyof VerbosityContext]?.[String(contextValue)];

      if (adjustment && adjustment !== verbosity) {
        adjustments.push(`${contextKey}: ${contextValue} → ${adjustment}`);
        verbosity = adjustment;
      }
    }
  }

  // Log the decision for debugging
  logger.info('Verbosity determination', {
    providerCategory,
    baseVerbosity: mapping.baseVerbosity,
    finalVerbosity: verbosity,
    context,
    adjustments,
  });

  return {
    verbosity,
    reasoning: mapping.reasoning,
    adjustments,
  };
}

/**
 * Gets token budget for a provider and verbosity level
 */
export function getTokenBudget(providerCategory: ProviderCategory, verbosity: VerbosityLevel): number {
  const mapping = PROVIDER_VERBOSITY_MAPPING[providerCategory];
  return mapping.tokenBudget[verbosity];
}

/**
 * Validates if a verbosity level is appropriate for a provider
 */
export function isVerbosityAppropriate(
  providerCategory: ProviderCategory,
  verbosity: VerbosityLevel,
  estimatedTokens: number,
): {
  appropriate: boolean;
  reason?: string;
  recommendation?: VerbosityLevel;
} {
  const mapping = PROVIDER_VERBOSITY_MAPPING[providerCategory];
  const budget = mapping.tokenBudget[verbosity];

  if (estimatedTokens > budget * 1.5) {
    const lowerVerbosity = verbosity === 'detailed' ? 'standard' : 'minimal';
    return {
      appropriate: false,
      reason: `Token count (${estimatedTokens}) exceeds budget (${budget}) for ${verbosity} verbosity`,
      recommendation: lowerVerbosity,
    };
  }

  if (estimatedTokens < budget * 0.3 && verbosity !== 'detailed') {
    const higherVerbosity = verbosity === 'minimal' ? 'standard' : 'detailed';
    return {
      appropriate: false,
      reason: `Token count (${estimatedTokens}) is much lower than budget (${budget}), could use more detail`,
      recommendation: higherVerbosity,
    };
  }

  return { appropriate: true };
}

/**
 * Gets provider strengths and limitations for prompt optimization
 */
export function getProviderCharacteristics(providerCategory: ProviderCategory): {
  strengths: string[];
  limitations: string[];
  description: string;
} {
  const mapping = PROVIDER_VERBOSITY_MAPPING[providerCategory];
  return {
    strengths: mapping.strengths,
    limitations: mapping.limitations,
    description: mapping.description,
  };
}

/**
 * Compares verbosity efficiency across different providers
 */
export function compareProviderEfficiency(
  providers: ProviderCategory[],
  context: VerbosityContext = {},
): Array<{
  provider: ProviderCategory;
  verbosity: VerbosityLevel;
  estimatedTokens: number;
  efficiency: number; // tokens per capability
  reasoning: string;
}> {
  return providers
    .map((provider) => {
      const { verbosity, reasoning } = getOptimalVerbosity(provider, context);
      const estimatedTokens = getTokenBudget(provider, verbosity);

      // Simple efficiency calculation (lower is better)
      let efficiency = estimatedTokens;

      // Adjust for provider capabilities
      const characteristics = getProviderCharacteristics(provider);
      const capabilityScore = characteristics.strengths.length - characteristics.limitations.length;
      efficiency = efficiency / Math.max(1, capabilityScore);

      return {
        provider,
        verbosity,
        estimatedTokens,
        efficiency,
        reasoning,
      };
    })
    .sort((a, b) => a.efficiency - b.efficiency); // Sort by efficiency (best first)
}

/**
 * Gets verbosity recommendations for specific task types
 */
export function getVerbosityForTask(
  taskType:
    | 'create-project'
    | 'add-feature'
    | 'fix-bug'
    | 'refactor-code'
    | 'database-ops'
    | 'design-ui'
    | 'explain-code',
  providerCategory: ProviderCategory,
  userExperience: 'beginner' | 'intermediate' | 'expert' = 'intermediate',
): {
  verbosity: VerbosityLevel;
  reasoning: string;
  tips: string[];
} {
  const contextMap: Record<string, VerbosityContext> = {
    'create-project': {
      intentComplexity: 'complex',
      taskType: 'creative',
      userExperience,
    },
    'add-feature': {
      intentComplexity: 'moderate',
      taskType: 'creative',
      isExistingProject: true,
      userExperience,
    },
    'fix-bug': {
      intentComplexity: 'simple',
      taskType: 'maintenance',
      isDebugging: true,
      hasTimeConstraints: true,
      userExperience,
    },
    'refactor-code': {
      intentComplexity: 'moderate',
      taskType: 'analytical',
      isExistingProject: true,
      userExperience,
    },
    'database-ops': {
      intentComplexity: 'moderate',
      taskType: 'analytical',
      userExperience,
    },
    'design-ui': {
      intentComplexity: 'moderate',
      taskType: 'creative',
      userExperience,
    },
    'explain-code': {
      intentComplexity: 'simple',
      taskType: 'exploratory',
      userExperience,
    },
  };

  const context = contextMap[taskType] || {};
  const { verbosity, reasoning } = getOptimalVerbosity(providerCategory, context);

  const tips: string[] = [];

  // Add task-specific tips
  if (taskType === 'fix-bug' && verbosity === 'minimal') {
    tips.push('Focus on surgical fixes rather than comprehensive refactoring');
  }

  if (taskType === 'create-project' && verbosity === 'detailed') {
    tips.push('Leverage detailed guidelines for better project structure');
  }

  if (providerCategory === 'reasoning' && verbosity === 'minimal') {
    tips.push('Let the model reason through the solution internally');
  }

  return { verbosity, reasoning, tips };
}

/**
 * Export current mapping for use in prompt generation
 */
export function getProviderVerbosityMapping() {
  return PROVIDER_VERBOSITY_MAPPING;
}
