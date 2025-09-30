import type { VerbosityLevel } from './schema-loader';
import { generateOptimizedPrompt } from './dynamic-rule-injector';
import { detectIntent } from './intent-detection';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('PromptOptimizerTests');

export interface TestScenario {
  id: string;
  name: string;
  description: string;
  userMessage: string;
  context: {
    chatMode: 'discuss' | 'build';
    hasExistingFiles?: boolean;
    supabaseConnected?: boolean;
    projectType?: 'web' | 'mobile' | 'node' | 'auto';
  };
  expectedIntent?: string;
  expectedComplexity?: 'simple' | 'moderate' | 'complex';
}

export interface TestResult {
  scenario: TestScenario;
  providerCategory: string;
  verbosity: VerbosityLevel;
  tokenCount: number;
  tokenReduction: number;
  intentAccuracy: boolean;
  validationPassed: boolean;
  generationTime: number;
  issues: string[];
  strengths: string[];
}

export interface TestSuite {
  name: string;
  scenarios: TestScenario[];
  providers: string[];
  expectedResults: {
    maxTokenReduction: number;
    minIntentAccuracy: number;
    maxGenerationTime: number;
  };
}

/**
 * Comprehensive test scenarios covering different use cases
 */
export const TEST_SCENARIOS: TestScenario[] = [
  {
    id: 'create-simple-landing',
    name: 'Create Simple Landing Page',
    description: 'User wants to create a basic landing page',
    userMessage: 'Create a simple landing page for my startup with a hero section and contact form',
    context: {
      chatMode: 'build',
      hasExistingFiles: false,
      projectType: 'web',
    },
    expectedIntent: 'create-project',
    expectedComplexity: 'simple',
  },

  {
    id: 'fix-auth-bug',
    name: 'Fix Authentication Bug',
    description: 'User reports a specific authentication issue',
    userMessage: 'The login form is showing "undefined" error when users enter invalid credentials',
    context: {
      chatMode: 'build',
      hasExistingFiles: true,
      projectType: 'web',
    },
    expectedIntent: 'fix-bug',
    expectedComplexity: 'simple',
  },

  {
    id: 'add-database-auth',
    name: 'Add Database Authentication',
    description: 'User wants to add user authentication with database',
    userMessage: 'Add user registration and login functionality using Supabase auth with email/password',
    context: {
      chatMode: 'build',
      hasExistingFiles: true,
      supabaseConnected: true,
      projectType: 'web',
    },
    expectedIntent: 'database-ops',
    expectedComplexity: 'moderate',
  },

  {
    id: 'explain-react-hooks',
    name: 'Explain React Hooks',
    description: 'User asks for explanation of React concepts',
    userMessage: 'Can you explain how useEffect works and when to use it?',
    context: {
      chatMode: 'discuss',
      hasExistingFiles: true,
      projectType: 'web',
    },
    expectedIntent: 'explain-code',
    expectedComplexity: 'simple',
  },

  {
    id: 'design-dashboard',
    name: 'Design Analytics Dashboard',
    description: 'User wants to create a complex dashboard with charts',
    userMessage: 'Create a comprehensive analytics dashboard with charts, tables, and real-time data visualization',
    context: {
      chatMode: 'build',
      hasExistingFiles: true,
      projectType: 'web',
    },
    expectedIntent: 'design-ui',
    expectedComplexity: 'complex',
  },

  {
    id: 'mobile-app-creation',
    name: 'Create Mobile App',
    description: 'User wants to create a React Native mobile app',
    userMessage: 'Build a mobile app for tracking fitness activities with navigation and local storage',
    context: {
      chatMode: 'build',
      hasExistingFiles: false,
      projectType: 'mobile',
    },
    expectedIntent: 'create-project',
    expectedComplexity: 'moderate',
  },

  {
    id: 'refactor-components',
    name: 'Refactor React Components',
    description: 'User wants to improve existing code structure',
    userMessage: 'Refactor these React components to use TypeScript and improve performance',
    context: {
      chatMode: 'build',
      hasExistingFiles: true,
      projectType: 'web',
    },
    expectedIntent: 'refactor-code',
    expectedComplexity: 'moderate',
  },

  {
    id: 'deploy-configuration',
    name: 'Deploy to Netlify',
    description: 'User wants deployment setup',
    userMessage: 'Set up deployment to Netlify with environment variables and build configuration',
    context: {
      chatMode: 'build',
      hasExistingFiles: true,
      projectType: 'web',
    },
    expectedIntent: 'deploy-config',
    expectedComplexity: 'moderate',
  },
];

/**
 * Provider test configurations
 */
export const PROVIDER_CONFIGURATIONS = [
  { name: 'OpenAI', category: 'standard' },
  { name: 'Anthropic', category: 'high-context' },
  { name: 'Groq', category: 'speed-optimized' },
  { name: 'Ollama', category: 'local-models' },
  { name: 'Deepseek', category: 'coding-specialized' },
  { name: 'OpenAI-o1', category: 'reasoning' },
] as const;

/**
 * Test suite definitions
 */
export const TEST_SUITES: TestSuite[] = [
  {
    name: 'Core Functionality Test',
    scenarios: TEST_SCENARIOS.slice(0, 4), // Basic scenarios
    providers: ['OpenAI', 'Anthropic', 'Groq'],
    expectedResults: {
      maxTokenReduction: 60,
      minIntentAccuracy: 0.8,
      maxGenerationTime: 1000,
    },
  },

  {
    name: 'Provider Optimization Test',
    scenarios: TEST_SCENARIOS,
    providers: PROVIDER_CONFIGURATIONS.map((p) => p.name),
    expectedResults: {
      maxTokenReduction: 70,
      minIntentAccuracy: 0.85,
      maxGenerationTime: 2000,
    },
  },

  {
    name: 'Speed Test',
    scenarios: [TEST_SCENARIOS[1], TEST_SCENARIOS[3]], // Bug fix and explanation
    providers: ['Groq', 'OpenAI-o1'],
    expectedResults: {
      maxTokenReduction: 80,
      minIntentAccuracy: 0.9,
      maxGenerationTime: 500,
    },
  },
];

/**
 * Runs a single test scenario against a provider
 */
export async function runTestScenario(
  scenario: TestScenario,
  providerName: string,
  providerCategory: string,
): Promise<TestResult> {
  const startTime = Date.now();

  try {
    // Simulate user messages for intent detection
    const messages = [{ id: `test-${scenario.id}`, role: 'user' as const, content: scenario.userMessage }];

    // Detect intent
    const detectedIntent = detectIntent(messages, {
      chatMode: scenario.context.chatMode,
      hasExistingFiles: scenario.context.hasExistingFiles,
      supabaseConnected: scenario.context.supabaseConnected,
      projectType: scenario.context.projectType,
    });

    // Generate optimized prompt
    const result = generateOptimizedPrompt({
      providerName,
      chatMode: scenario.context.chatMode,
      projectType: scenario.context.projectType,
      supabase: scenario.context.supabaseConnected
        ? {
            isConnected: true,
            hasSelectedProject: true,
            credentials: {
              supabaseUrl: 'test-url',
              anonKey: 'test-key',
            },
          }
        : {
            isConnected: false,
            hasSelectedProject: false,
          },
      detectedIntent,
    });

    const generationTime = Date.now() - startTime;

    // Calculate baseline token count (using standard verbosity)
    const baselineResult = generateOptimizedPrompt({
      providerName: 'OpenAI', // Standard baseline
      chatMode: scenario.context.chatMode,
      projectType: scenario.context.projectType,
      forceVerbosity: 'standard',
      detectedIntent,
    });

    const tokenReduction = Math.round(
      ((baselineResult.metadata.estimatedTokens - result.metadata.estimatedTokens) /
        baselineResult.metadata.estimatedTokens) *
        100,
    );

    // Validate intent accuracy
    const intentAccuracy = scenario.expectedIntent ? detectedIntent.category === scenario.expectedIntent : true;

    // Check for issues
    const issues: string[] = [];
    const strengths: string[] = [];

    if (!intentAccuracy) {
      issues.push(`Intent mismatch: expected ${scenario.expectedIntent}, got ${detectedIntent.category}`);
    }

    if (result.metadata.validationResults && !result.metadata.validationResults.valid) {
      issues.push(
        `Validation failed: ${result.metadata.validationResults.violations.map((v) => v.description).join(', ')}`,
      );
    }

    if (generationTime > 2000) {
      issues.push(`Slow generation: ${generationTime}ms`);
    }

    if (tokenReduction > 30) {
      strengths.push(`Good token reduction: ${tokenReduction}%`);
    }

    if (detectedIntent.confidence === 'high') {
      strengths.push('High intent confidence');
    }

    if (result.metadata.optimizationApplied) {
      strengths.push('Provider optimization applied');
    }

    return {
      scenario,
      providerCategory,
      verbosity: result.metadata.verbosityLevel,
      tokenCount: result.metadata.estimatedTokens,
      tokenReduction,
      intentAccuracy,
      validationPassed: !result.metadata.validationResults || result.metadata.validationResults.valid,
      generationTime,
      issues,
      strengths,
    };
  } catch (error) {
    logger.error('Test scenario failed', { scenario: scenario.id, providerName, error });

    return {
      scenario,
      providerCategory,
      verbosity: 'standard',
      tokenCount: 0,
      tokenReduction: 0,
      intentAccuracy: false,
      validationPassed: false,
      generationTime: Date.now() - startTime,
      issues: [`Test execution failed: ${error}`],
      strengths: [],
    };
  }
}

/**
 * Runs a complete test suite
 */
export async function runTestSuite(suite: TestSuite): Promise<{
  results: TestResult[];
  summary: {
    totalTests: number;
    passedTests: number;
    averageTokenReduction: number;
    averageGenerationTime: number;
    intentAccuracy: number;
    validationSuccess: number;
  };
  recommendations: string[];
}> {
  logger.info(`Running test suite: ${suite.name}`);

  const results: TestResult[] = [];

  // Run all combinations of scenarios and providers
  for (const scenario of suite.scenarios) {
    for (const providerName of suite.providers) {
      const providerConfig = PROVIDER_CONFIGURATIONS.find((p) => p.name === providerName);
      const providerCategory = providerConfig?.category || 'standard';

      const result = await runTestScenario(scenario, providerName, providerCategory);
      results.push(result);
    }
  }

  // Calculate summary statistics
  const totalTests = results.length;
  const passedTests = results.filter((r) => r.issues.length === 0).length;
  const averageTokenReduction = results.reduce((sum, r) => sum + r.tokenReduction, 0) / totalTests;
  const averageGenerationTime = results.reduce((sum, r) => sum + r.generationTime, 0) / totalTests;
  const intentAccuracy = results.filter((r) => r.intentAccuracy).length / totalTests;
  const validationSuccess = results.filter((r) => r.validationPassed).length / totalTests;

  // Generate recommendations
  const recommendations: string[] = [];

  if (averageTokenReduction < suite.expectedResults.maxTokenReduction * 0.7) {
    recommendations.push('Consider more aggressive token optimization for better efficiency');
  }

  if (intentAccuracy < suite.expectedResults.minIntentAccuracy) {
    recommendations.push('Improve intent detection accuracy with better keyword patterns');
  }

  if (averageGenerationTime > suite.expectedResults.maxGenerationTime) {
    recommendations.push('Optimize prompt generation performance');
  }

  // Provider-specific recommendations
  const providerResults = results.reduce(
    (acc, result) => {
      if (!acc[result.providerCategory]) {
        acc[result.providerCategory] = [];
      }

      acc[result.providerCategory].push(result);

      return acc;
    },
    {} as Record<string, TestResult[]>,
  );

  for (const [category, categoryResults] of Object.entries(providerResults)) {
    const categoryTokenReduction =
      categoryResults.reduce((sum, r) => sum + r.tokenReduction, 0) / categoryResults.length;

    if (categoryTokenReduction < 20 && category !== 'high-context') {
      recommendations.push(`${category} providers could benefit from more aggressive optimization`);
    }
  }

  logger.info(`Test suite completed: ${suite.name}`, {
    totalTests,
    passedTests,
    averageTokenReduction,
    averageGenerationTime,
    intentAccuracy,
    validationSuccess,
  });

  return {
    results,
    summary: {
      totalTests,
      passedTests,
      averageTokenReduction,
      averageGenerationTime,
      intentAccuracy,
      validationSuccess,
    },
    recommendations,
  };
}

/**
 * Runs all test suites and generates a comprehensive report
 */
export async function runComprehensiveTests(): Promise<{
  suiteResults: Array<{
    suite: TestSuite;
    results: TestResult[];
    summary: Awaited<ReturnType<typeof runTestSuite>>['summary'];
    recommendations: string[];
  }>;
  overallSummary: {
    totalSuites: number;
    totalTests: number;
    overallPassRate: number;
    bestPerformingProvider: string;
    mostEfficientProvider: string;
    recommendations: string[];
  };
}> {
  logger.info('Starting comprehensive prompt optimizer tests');

  const suiteResults = [];

  for (const suite of TEST_SUITES) {
    const suiteResult = await runTestSuite(suite);
    suiteResults.push({
      suite,
      ...suiteResult,
    });
  }

  // Calculate overall statistics
  const totalSuites = suiteResults.length;
  const totalTests = suiteResults.reduce((sum, s) => sum + s.summary.totalTests, 0);
  const overallPassRate = suiteResults.reduce((sum, s) => sum + s.summary.passedTests, 0) / totalTests;

  // Find best performing providers
  const allResults = suiteResults.flatMap((s) => s.results);
  const providerPerformance = allResults.reduce(
    (acc, result) => {
      if (!acc[result.providerCategory]) {
        acc[result.providerCategory] = {
          totalTests: 0,
          passedTests: 0,
          totalTokenReduction: 0,
          totalGenerationTime: 0,
        };
      }

      const stats = acc[result.providerCategory];
      stats.totalTests++;

      if (result.issues.length === 0) {
        stats.passedTests++;
      }

      stats.totalTokenReduction += result.tokenReduction;
      stats.totalGenerationTime += result.generationTime;

      return acc;
    },
    {} as Record<string, any>,
  );

  let bestPerformingProvider = '';
  let mostEfficientProvider = '';
  let bestPassRate = 0;
  let bestEfficiency = 0;

  for (const [provider, stats] of Object.entries(providerPerformance)) {
    const passRate = stats.passedTests / stats.totalTests;
    const efficiency = stats.totalTokenReduction / stats.totalTests;

    if (passRate > bestPassRate) {
      bestPassRate = passRate;
      bestPerformingProvider = provider;
    }

    if (efficiency > bestEfficiency) {
      bestEfficiency = efficiency;
      mostEfficientProvider = provider;
    }
  }

  // Generate overall recommendations
  const overallRecommendations: string[] = [];

  if (overallPassRate < 0.8) {
    overallRecommendations.push('System needs significant improvements - pass rate below 80%');
  }

  if (bestEfficiency < 30) {
    overallRecommendations.push('Token optimization could be more aggressive across all providers');
  }

  // Consolidate common recommendations
  const allRecommendations = suiteResults.flatMap((s) => s.recommendations);
  const recommendationCounts = allRecommendations.reduce(
    (acc, rec) => {
      acc[rec] = (acc[rec] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const commonRecommendations = Object.entries(recommendationCounts)
    .filter(([, count]) => count >= 2)
    .map(([rec]) => rec);

  overallRecommendations.push(...commonRecommendations);

  logger.info('Comprehensive tests completed', {
    totalSuites,
    totalTests,
    overallPassRate,
    bestPerformingProvider,
    mostEfficientProvider,
  });

  return {
    suiteResults,
    overallSummary: {
      totalSuites,
      totalTests,
      overallPassRate,
      bestPerformingProvider,
      mostEfficientProvider,
      recommendations: overallRecommendations,
    },
  };
}

/**
 * Utility function to format test results for display
 */
export function formatTestResults(results: TestResult[]): string {
  let output = 'Prompt Optimization Test Results\n';
  output += '================================\n\n';

  for (const result of results) {
    output += `Scenario: ${result.scenario.name}\n`;
    output += `Provider: ${result.providerCategory}\n`;
    output += `Verbosity: ${result.verbosity}\n`;
    output += `Tokens: ${result.tokenCount}\n`;
    output += `Token Reduction: ${result.tokenReduction}%\n`;
    output += `Intent Accuracy: ${result.intentAccuracy ? '✓' : '✗'}\n`;
    output += `Validation: ${result.validationPassed ? '✓' : '✗'}\n`;
    output += `Generation Time: ${result.generationTime}ms\n`;

    if (result.strengths.length > 0) {
      output += `Strengths: ${result.strengths.join(', ')}\n`;
    }

    if (result.issues.length > 0) {
      output += `Issues: ${result.issues.join(', ')}\n`;
    }

    output += '\n---\n\n';
  }

  return output;
}
