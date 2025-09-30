import type { Message } from 'ai';

export type IntentCategory =
  | 'create-project' // Creating entirely new projects
  | 'add-feature' // Adding new functionality to existing projects
  | 'fix-bug' // Debugging and fixing issues
  | 'refactor-code' // Code improvements and restructuring
  | 'database-ops' // Database operations (schema, queries, auth)
  | 'design-ui' // UI/UX design and styling
  | 'explain-code' // Code explanation and documentation
  | 'deploy-config' // Deployment and configuration
  | 'add-tests' // Testing implementation
  | 'general-discuss'; // General discussion and planning

export type IntentConfidence = 'high' | 'medium' | 'low';

export interface DetectedIntent {
  category: IntentCategory;
  confidence: IntentConfidence;
  keywords: string[];
  context: {
    requiresDatabase?: boolean;
    requiresFileChanges?: boolean;
    requiresDesign?: boolean;
    requiresDeployment?: boolean;
    isExistingProject?: boolean;
    complexity: 'simple' | 'moderate' | 'complex';
  };
}

export interface IntentDetectionOptions {
  chatMode?: 'discuss' | 'build';
  projectType?: 'web' | 'mobile' | 'node' | 'auto';
  hasExistingFiles?: boolean;
  supabaseConnected?: boolean;
}

/**
 * Intent detection patterns with keywords and confidence scoring
 */
const INTENT_PATTERNS: Record<
  IntentCategory,
  {
    keywords: string[];
    exclusiveKeywords?: string[];
    contextIndicators: {
      requiresDatabase?: string[];
      requiresFileChanges?: string[];
      requiresDesign?: string[];
      requiresDeployment?: string[];
    };
    complexityIndicators: {
      simple: string[];
      moderate: string[];
      complex: string[];
    };
  }
> = {
  'create-project': {
    keywords: [
      'create new',
      'build from scratch',
      'start fresh',
      'new project',
      'initialize',
      'bootstrap',
      'scaffold',
      'generate new',
      'start a new',
      'build a new',
    ],
    exclusiveKeywords: ['add to', 'modify existing', 'update current', 'fix in'],
    contextIndicators: {
      requiresFileChanges: ['app', 'project structure', 'package.json'],
      requiresDesign: ['ui', 'interface', 'design', 'styling', 'components'],
      requiresDatabase: ['database', 'auth', 'users', 'data storage', 'backend'],
    },
    complexityIndicators: {
      simple: ['simple', 'basic', 'minimal', 'quick', 'template'],
      moderate: ['with authentication', 'responsive', 'api integration'],
      complex: ['full-stack', 'microservices', 'advanced features', 'enterprise'],
    },
  },

  'add-feature': {
    keywords: [
      'add',
      'implement',
      'create function',
      'new feature',
      'extend',
      'enhance',
      'include',
      'integrate',
      'build feature',
      'develop',
      'support for',
    ],
    contextIndicators: {
      requiresFileChanges: ['function', 'component', 'module', 'feature'],
      requiresDatabase: ['store', 'save', 'persist', 'database', 'table', 'query'],
      requiresDesign: ['ui', 'form', 'button', 'page', 'component', 'styling'],
      requiresDeployment: ['deploy', 'publish', 'host', 'environment'],
    },
    complexityIndicators: {
      simple: ['simple', 'basic', 'quick', 'small'],
      moderate: ['with validation', 'responsive', 'interactive'],
      complex: ['real-time', 'advanced', 'machine learning', 'complex logic'],
    },
  },

  'fix-bug': {
    keywords: [
      'fix',
      'bug',
      'error',
      'issue',
      'problem',
      'broken',
      'not working',
      'debug',
      'troubleshoot',
      'resolve',
      'repair',
      'correct',
    ],
    contextIndicators: {
      requiresFileChanges: ['file', 'code', 'function', 'component'],
      requiresDatabase: ['query', 'connection', 'data', 'database error'],
      requiresDesign: ['styling', 'layout', 'css', 'responsive', 'ui'],
    },
    complexityIndicators: {
      simple: ['typo', 'simple fix', 'quick fix', 'minor'],
      moderate: ['logic error', 'validation', 'performance'],
      complex: ['architecture', 'memory leak', 'concurrency', 'security'],
    },
  },

  'refactor-code': {
    keywords: [
      'refactor',
      'optimize',
      'improve',
      'restructure',
      'reorganize',
      'clean up',
      'simplify',
      'modernize',
      'update',
      'rewrite',
    ],
    contextIndicators: {
      requiresFileChanges: ['code', 'structure', 'architecture', 'organization'],
      requiresDatabase: ['schema', 'queries', 'models'],
      requiresDesign: ['components', 'styling', 'ui architecture'],
    },
    complexityIndicators: {
      simple: ['variable names', 'formatting', 'comments'],
      moderate: ['function extraction', 'component structure'],
      complex: ['architecture overhaul', 'design patterns', 'full rewrite'],
    },
  },

  'database-ops': {
    keywords: [
      'database',
      'table',
      'schema',
      'query',
      'sql',
      'migration',
      'auth',
      'user management',
      'data model',
      'supabase',
      'postgres',
      'crud',
    ],
    contextIndicators: {
      requiresDatabase: ['always'],
      requiresFileChanges: ['migration', 'model', 'api', 'client'],
    },
    complexityIndicators: {
      simple: ['single table', 'basic crud', 'simple query'],
      moderate: ['relationships', 'authentication', 'rls policies'],
      complex: ['complex queries', 'stored procedures', 'advanced security'],
    },
  },

  'design-ui': {
    keywords: [
      'design',
      'ui',
      'ux',
      'styling',
      'css',
      'theme',
      'layout',
      'responsive',
      'components',
      'interface',
      'visual',
      'appearance',
      'colors',
      'fonts',
    ],
    contextIndicators: {
      requiresDesign: ['always'],
      requiresFileChanges: ['component', 'styling', 'css', 'theme'],
    },
    complexityIndicators: {
      simple: ['color change', 'basic styling', 'simple component'],
      moderate: ['responsive design', 'theme system', 'animations'],
      complex: ['design system', 'advanced animations', 'accessibility'],
    },
  },

  'explain-code': {
    keywords: [
      'explain',
      'how does',
      'what is',
      'understand',
      'documentation',
      'describe',
      'walkthrough',
      'analyze',
      'review',
      'clarify',
    ],
    contextIndicators: {},
    complexityIndicators: {
      simple: ['single function', 'basic concept'],
      moderate: ['component structure', 'flow'],
      complex: ['architecture', 'entire system', 'patterns'],
    },
  },

  'deploy-config': {
    keywords: [
      'deploy',
      'deployment',
      'host',
      'publish',
      'environment',
      'config',
      'setup',
      'netlify',
      'vercel',
      'docker',
      'build',
      'production',
    ],
    contextIndicators: {
      requiresDeployment: ['always'],
      requiresFileChanges: ['config', 'environment', 'build'],
    },
    complexityIndicators: {
      simple: ['static deploy', 'basic hosting'],
      moderate: ['environment variables', 'build configuration'],
      complex: ['ci/cd', 'docker', 'kubernetes', 'microservices'],
    },
  },

  'add-tests': {
    keywords: [
      'test',
      'testing',
      'unit test',
      'integration test',
      'spec',
      'coverage',
      'jest',
      'vitest',
      'cypress',
      'e2e',
    ],
    contextIndicators: {
      requiresFileChanges: ['test', 'spec', 'config'],
    },
    complexityIndicators: {
      simple: ['unit test', 'single function'],
      moderate: ['component testing', 'integration'],
      complex: ['e2e testing', 'full coverage', 'test automation'],
    },
  },

  'general-discuss': {
    keywords: [
      'what',
      'how',
      'why',
      'should i',
      'recommend',
      'advice',
      'best practice',
      'approach',
      'strategy',
      'planning',
    ],
    contextIndicators: {},
    complexityIndicators: {
      simple: ['simple question', 'quick advice'],
      moderate: ['technical guidance', 'best practices'],
      complex: ['architecture planning', 'technology selection'],
    },
  },
};

/**
 * Analyzes the latest user message to detect intent
 */
export function detectIntent(messages: Message[], options: IntentDetectionOptions = {}): DetectedIntent {
  // Get the latest user message
  const latestMessage = [...messages].reverse().find((msg) => msg.role === 'user');

  if (!latestMessage) {
    return createDefaultIntent(options);
  }

  const content = extractTextContent(latestMessage.content);
  const normalizedContent = content.toLowerCase();

  // Score each intent category
  const intentScores: Array<{
    category: IntentCategory;
    score: number;
    matchedKeywords: string[];
  }> = [];

  for (const [category, patterns] of Object.entries(INTENT_PATTERNS)) {
    let score = 0;
    const matchedKeywords: string[] = [];

    // Check for keyword matches
    for (const keyword of patterns.keywords) {
      if (normalizedContent.includes(keyword.toLowerCase())) {
        score += 2;
        matchedKeywords.push(keyword);
      }
    }

    // Check for exclusive keyword conflicts (reduce score if found)
    if (patterns.exclusiveKeywords) {
      for (const exclusiveKeyword of patterns.exclusiveKeywords) {
        if (normalizedContent.includes(exclusiveKeyword.toLowerCase())) {
          score -= 3;
        }
      }
    }

    // Boost score based on chat mode alignment
    if (
      options.chatMode === 'build' &&
      ['create-project', 'add-feature', 'fix-bug'].includes(category as IntentCategory)
    ) {
      score += 1;
    }

    if (options.chatMode === 'discuss' && ['explain-code', 'general-discuss'].includes(category as IntentCategory)) {
      score += 1;
    }

    // Boost score for database operations if Supabase is connected
    if (category === 'database-ops' && options.supabaseConnected) {
      score += 1;
    }

    // Boost score for add-feature if existing project detected
    if (category === 'add-feature' && options.hasExistingFiles) {
      score += 1;
    }

    // Reduce score for create-project if existing files detected
    if (category === 'create-project' && options.hasExistingFiles) {
      score -= 2;
    }

    intentScores.push({
      category: category as IntentCategory,
      score: Math.max(0, score), // Ensure non-negative
      matchedKeywords,
    });
  }

  // Sort by score and get the best match
  intentScores.sort((a, b) => b.score - a.score);

  const bestMatch = intentScores[0];

  // Determine confidence based on score and second-best match
  let confidence: IntentConfidence = 'low';

  if (bestMatch.score >= 4) {
    confidence = 'high';
  } else if (bestMatch.score >= 2) {
    confidence = 'medium';
  }

  // If second best is very close, reduce confidence
  if (intentScores[1] && bestMatch.score - intentScores[1].score <= 1) {
    confidence = confidence === 'high' ? 'medium' : 'low';
  }

  // Generate context based on detected patterns
  const patterns = INTENT_PATTERNS[bestMatch.category];
  const context = generateContext(normalizedContent, patterns, options);

  return {
    category: bestMatch.category,
    confidence,
    keywords: bestMatch.matchedKeywords,
    context,
  };
}

/**
 * Extracts text content from message content (handles both string and array formats)
 */
function extractTextContent(content: any): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join(' ');
  }

  return '';
}

/**
 * Generates context information based on detected patterns
 */
function generateContext(
  content: string,
  patterns: (typeof INTENT_PATTERNS)[IntentCategory],
  options: IntentDetectionOptions,
): DetectedIntent['context'] {
  const context: DetectedIntent['context'] = {
    isExistingProject: options.hasExistingFiles || false,
    complexity: 'moderate', // default
  };

  // Check context indicators
  for (const [contextType, keywords] of Object.entries(patterns.contextIndicators)) {
    if (keywords.some((keyword) => content.includes(keyword.toLowerCase()))) {
      switch (contextType) {
        case 'requiresDatabase':
          context.requiresDatabase = true;
          break;
        case 'requiresFileChanges':
          context.requiresFileChanges = true;
          break;
        case 'requiresDesign':
          context.requiresDesign = true;
          break;
        case 'requiresDeployment':
          context.requiresDeployment = true;
          break;
      }
    }
  }

  // Determine complexity
  for (const [complexity, keywords] of Object.entries(patterns.complexityIndicators)) {
    if (keywords.some((keyword) => content.includes(keyword.toLowerCase()))) {
      context.complexity = complexity as 'simple' | 'moderate' | 'complex';
      break;
    }
  }

  return context;
}

/**
 * Creates a default intent when detection fails
 */
function createDefaultIntent(options: IntentDetectionOptions): DetectedIntent {
  const category = options.chatMode === 'discuss' ? 'general-discuss' : 'add-feature';

  return {
    category,
    confidence: 'low',
    keywords: [],
    context: {
      isExistingProject: options.hasExistingFiles || false,
      complexity: 'moderate',
    },
  };
}

/**
 * Gets recommended sections for a detected intent
 */
export function getRecommendedSections(intent: DetectedIntent): string[] {
  const baseSections = ['system_header', 'system_constraints', 'technology_preferences'];

  switch (intent.category) {
    case 'create-project':
      return [
        ...baseSections,
        'artifact_instructions',
        'code_quality_standards',
        'project_structure_standards',
        ...(intent.context.requiresDesign ? ['design_instructions'] : []),
        ...(intent.context.requiresDatabase ? ['supabase_instructions'] : []),
        'build_mode_instructions',
      ];

    case 'add-feature':
      return [
        ...baseSections,
        'artifact_instructions',
        'code_quality_standards',
        ...(intent.context.requiresDesign ? ['design_instructions'] : []),
        ...(intent.context.requiresDatabase ? ['supabase_instructions'] : []),
        'build_mode_instructions',
      ];

    case 'fix-bug':
      return [...baseSections, 'code_fix_triage', 'artifact_instructions', 'build_mode_instructions'];

    case 'database-ops':
      return [...baseSections, 'supabase_instructions', 'artifact_instructions', 'build_mode_instructions'];

    case 'design-ui':
      return [...baseSections, 'design_instructions', 'artifact_instructions', 'build_mode_instructions'];

    case 'explain-code':
    case 'general-discuss':
      return ['system_header', 'system_constraints', 'message_formatting_info'];

    default:
      return baseSections.concat(['artifact_instructions', 'build_mode_instructions']);
  }
}

/**
 * Determines optimal verbosity level based on intent and provider category
 */
export function getOptimalVerbosity(
  intent: DetectedIntent,
  providerCategory: string,
): 'minimal' | 'standard' | 'detailed' {
  // Simple intents with high confidence can use minimal verbosity
  if (intent.confidence === 'high' && intent.context.complexity === 'simple') {
    return 'minimal';
  }

  // Complex intents or low confidence need detailed verbosity
  if (intent.context.complexity === 'complex' || intent.confidence === 'low') {
    return 'detailed';
  }

  // Speed-optimized providers prefer minimal
  if (providerCategory === 'speed-optimized') {
    return 'minimal';
  }

  // Reasoning models can work with minimal
  if (providerCategory === 'reasoning') {
    return 'minimal';
  }

  return 'standard';
}
