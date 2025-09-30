import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Button } from '~/components/ui/Button';
import { toast } from 'react-toastify';
import { classNames } from '~/utils/classNames';
import {
  generateOptimizedPromptFull,
  analyzeProviderOptimal,
  OptimizedPromptSystem,
} from '~/lib/common/prompts/optimized-prompt-system';
import type { Message } from 'ai';

interface TestResult {
  prompt: string;
  metadata: {
    tokenCount: number;
    tokenReduction: number;
    verbosity: 'minimal' | 'standard' | 'detailed';
    providerCategory: string;
    intentCategory?: string;
    generationTime: number;
    validationPassed: boolean;
  };
  performance?: {
    comparedToBaseline: number;
    efficiency: 'excellent' | 'good' | 'moderate' | 'poor';
    recommendation: string;
  };
}

interface ProviderAnalysis {
  recommendedVerbosity: 'minimal' | 'standard' | 'detailed';
  estimatedTokenReduction: number;
  strengths: string[];
  limitations: string[];
  recommendations: string[];
}

const TEST_SCENARIOS = [
  {
    id: 'simple-bug',
    name: 'Simple Bug Fix',
    message: 'The login form shows "undefined" error when credentials are invalid',
    expected: { intent: 'fix-bug', complexity: 'simple' },
  },
  {
    id: 'create-auth',
    name: 'Add Authentication',
    message: 'Add user registration and login with Supabase email/password auth',
    expected: { intent: 'database-ops', complexity: 'moderate' },
  },
  {
    id: 'design-dashboard',
    name: 'Design Dashboard',
    message: 'Create a beautiful analytics dashboard with charts and real-time data',
    expected: { intent: 'design-ui', complexity: 'moderate' },
  },
  {
    id: 'explain-react',
    name: 'Explain Code',
    message: 'Can you explain how React useEffect works with dependencies?',
    expected: { intent: 'explain-code', complexity: 'simple' },
  },
  {
    id: 'complex-project',
    name: 'Complex Project',
    message: 'Build a full-stack e-commerce platform with authentication, payments, and admin panel',
    expected: { intent: 'create-project', complexity: 'complex' },
  },
  {
    id: 'fullstack-webapp',
    name: 'Full-Stack Web App (Real Test)',
    message: `Create a full-stack web app using:
- React + Vite
- TailwindCSS
- Radix UI
- Supabase (auth, database, storage)

Requirements:
- Authentication (sign up, login, reset password) via Supabase
- Dashboard layout with sidebar + top nav
- Example table CRUD bound to Supabase
- Radix UI components styled with Tailwind
- Environment variables loaded from \`.env\`
- Code split into clean folders: \`src/components\`, \`src/pages\`, \`src/lib/supabase.ts\``,
    expected: { intent: 'create-project', complexity: 'complex' },
  },
];

const PROVIDERS = [
  { name: 'OpenAI', category: 'standard' },
  { name: 'Anthropic', category: 'high-context' },
  { name: 'Groq', category: 'speed-optimized' },
  { name: 'Ollama', category: 'local-models' },
  { name: 'Deepseek', category: 'coding-specialized' },
  { name: 'OpenAI-o1', category: 'reasoning' },
];

export default function PromptOptimizationTest() {
  const [selectedScenario, setSelectedScenario] = useState(TEST_SCENARIOS[0]);
  const [selectedProvider, setSelectedProvider] = useState(PROVIDERS[0]);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [providerAnalysis, setProviderAnalysis] = useState<ProviderAnalysis | null>(null);
  const [batchResults, setBatchResults] = useState<Array<TestResult & { config: any }> | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'single' | 'provider' | 'batch'>('single');

  const runSingleTest = useCallback(async () => {
    setLoading(true);

    try {
      const messages: Message[] = [{ id: 'test-1', role: 'user', content: selectedScenario.message }];

      const result = await generateOptimizedPromptFull({
        providerName: selectedProvider.name,
        chatMode: 'build',
        projectType: 'web',
        messages,
        supabase:
          selectedScenario.id.includes('auth') || selectedScenario.id.includes('fullstack')
            ? {
                isConnected: true,
                hasSelectedProject: true,
                credentials: { supabaseUrl: 'test-url', anonKey: 'test-key' },
              }
            : { isConnected: false, hasSelectedProject: false },
      });

      setTestResult(result);
      toast.success(`Test completed! ${result.metadata.tokenReduction}% token reduction`);
    } catch (error) {
      toast.error(`Test failed: ${error}`);
      console.error('Test error:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedScenario, selectedProvider]);

  const analyzeProvider = useCallback(async () => {
    setLoading(true);

    try {
      const analysis = await analyzeProviderOptimal(selectedProvider.name);
      setProviderAnalysis(analysis);
      toast.success('Provider analysis completed!');
    } catch (error) {
      toast.error(`Analysis failed: ${error}`);
      console.error('Analysis error:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedProvider]);

  const runBatchTest = useCallback(async () => {
    setLoading(true);

    try {
      const system = new OptimizedPromptSystem(true);
      const baseOptions = {
        providerName: selectedProvider.name,
        chatMode: 'build' as const,
        projectType: 'web' as const,
        messages: [{ id: 'test-batch', role: 'user' as const, content: selectedScenario.message }],
      };

      const results = await system.generateBatchPrompts(baseOptions, {
        providers: PROVIDERS.map((p) => p.name),
        verbosities: ['minimal', 'standard', 'detailed'],
      });

      setBatchResults(results);
      toast.success(`Batch test completed! ${results.length} variations tested`);
    } catch (error) {
      toast.error(`Batch test failed: ${error}`);
      console.error('Batch test error:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedScenario]);

  const getEfficiencyColor = (efficiency: string) => {
    switch (efficiency) {
      case 'excellent':
        return 'text-green-500';
      case 'good':
        return 'text-blue-500';
      case 'moderate':
        return 'text-yellow-500';
      case 'poor':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  const getTokenReductionColor = (reduction: number) => {
    if (reduction >= 50) {
      return 'text-green-500';
    }

    if (reduction >= 25) {
      return 'text-blue-500';
    }

    if (reduction >= 10) {
      return 'text-yellow-500';
    }

    return 'text-red-500';
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-bolt-elements-textPrimary">Prompt Optimization Test Suite</h2>
        <p className="text-sm text-bolt-elements-textSecondary mt-1">
          Test the new AI-optimized prompt system with intent detection and dynamic rule injection
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-bolt-elements-background-depth-2 p-1 rounded-lg">
        {[
          { id: 'single', label: 'Single Test', icon: 'i-ph:test-tube' },
          { id: 'provider', label: 'Provider Analysis', icon: 'i-ph:chart-bar' },
          { id: 'batch', label: 'Batch Test', icon: 'i-ph:list-bullets' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={classNames(
              'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'bg-purple-500 text-white'
                : 'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-3',
            )}
          >
            <div className={tab.icon} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex flex-col gap-4">
        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-bolt-elements-textPrimary mb-2">Test Scenario</label>
            <select
              value={selectedScenario.id}
              onChange={(e) => setSelectedScenario(TEST_SCENARIOS.find((s) => s.id === e.target.value)!)}
              className="w-full p-2 rounded-lg bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor text-bolt-elements-textPrimary"
            >
              {TEST_SCENARIOS.map((scenario) => (
                <option key={scenario.id} value={scenario.id}>
                  {scenario.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-bolt-elements-textPrimary mb-2">Provider</label>
            <select
              value={selectedProvider.name}
              onChange={(e) => setSelectedProvider(PROVIDERS.find((p) => p.name === e.target.value)!)}
              className="w-full p-2 rounded-lg bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor text-bolt-elements-textPrimary"
            >
              {PROVIDERS.map((provider) => (
                <option key={provider.name} value={provider.name}>
                  {provider.name} ({provider.category})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Scenario Preview */}
        <div className="p-3 bg-bolt-elements-background-depth-3 rounded-lg">
          <h4 className="text-sm font-medium text-bolt-elements-textPrimary mb-1">Test Message:</h4>
          <p className="text-sm text-bolt-elements-textSecondary italic">"{selectedScenario.message}"</p>
          <div className="flex gap-4 mt-2">
            <span className="text-xs text-bolt-elements-textTertiary">
              Expected Intent: {selectedScenario.expected.intent}
            </span>
            <span className="text-xs text-bolt-elements-textTertiary">
              Expected Complexity: {selectedScenario.expected.complexity}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {activeTab === 'single' && (
            <Button onClick={runSingleTest} disabled={loading} className="flex items-center gap-2">
              <div className="i-ph:play" />
              {loading ? 'Testing...' : 'Run Single Test'}
            </Button>
          )}
          {activeTab === 'provider' && (
            <Button onClick={analyzeProvider} disabled={loading} className="flex items-center gap-2">
              <div className="i-ph:chart-bar" />
              {loading ? 'Analyzing...' : 'Analyze Provider'}
            </Button>
          )}
          {activeTab === 'batch' && (
            <Button onClick={runBatchTest} disabled={loading} className="flex items-center gap-2">
              <div className="i-ph:list-bullets" />
              {loading ? 'Running Batch...' : 'Run Batch Test'}
            </Button>
          )}
        </div>

        {/* Results */}
        {activeTab === 'single' && testResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-bolt-elements-background-depth-2 rounded-lg p-4"
          >
            <h3 className="text-lg font-medium text-bolt-elements-textPrimary mb-4">Test Results</h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <div
                  className={classNames(
                    'text-2xl font-bold',
                    getTokenReductionColor(testResult.metadata.tokenReduction),
                  )}
                >
                  {testResult.metadata.tokenReduction}%
                </div>
                <div className="text-xs text-bolt-elements-textSecondary">Token Reduction</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-bolt-elements-textPrimary">
                  {testResult.metadata.tokenCount}
                </div>
                <div className="text-xs text-bolt-elements-textSecondary">Final Tokens</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-500">{testResult.metadata.verbosity}</div>
                <div className="text-xs text-bolt-elements-textSecondary">Verbosity</div>
              </div>
              <div className="text-center">
                <div
                  className={classNames(
                    'text-2xl font-bold',
                    testResult.performance ? getEfficiencyColor(testResult.performance.efficiency) : 'text-gray-500',
                  )}
                >
                  {testResult.performance?.efficiency || 'N/A'}
                </div>
                <div className="text-xs text-bolt-elements-textSecondary">Efficiency</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium text-bolt-elements-textPrimary mb-2">Metadata</h4>
                <div className="text-sm space-y-1">
                  <div>
                    Provider Category: <span className="text-purple-500">{testResult.metadata.providerCategory}</span>
                  </div>
                  <div>
                    Intent Category:{' '}
                    <span className="text-blue-500">{testResult.metadata.intentCategory || 'None'}</span>
                  </div>
                  <div>
                    Generation Time: <span className="text-green-500">{testResult.metadata.generationTime}ms</span>
                  </div>
                  <div>
                    Validation:{' '}
                    <span className={testResult.metadata.validationPassed ? 'text-green-500' : 'text-red-500'}>
                      {testResult.metadata.validationPassed ? 'Passed' : 'Failed'}
                    </span>
                  </div>
                </div>
              </div>

              {testResult.performance && (
                <div>
                  <h4 className="font-medium text-bolt-elements-textPrimary mb-2">Performance</h4>
                  <div className="text-sm">
                    <div>
                      Compared to Baseline:{' '}
                      <span className={getTokenReductionColor(testResult.performance.comparedToBaseline)}>
                        {testResult.performance.comparedToBaseline}%
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-bolt-elements-textSecondary">
                      {testResult.performance.recommendation}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'provider' && providerAnalysis && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-bolt-elements-background-depth-2 rounded-lg p-4"
          >
            <h3 className="text-lg font-medium text-bolt-elements-textPrimary mb-4">Provider Analysis</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-500">{providerAnalysis.recommendedVerbosity}</div>
                <div className="text-xs text-bolt-elements-textSecondary">Recommended Verbosity</div>
              </div>
              <div className="text-center">
                <div
                  className={classNames(
                    'text-2xl font-bold',
                    getTokenReductionColor(providerAnalysis.estimatedTokenReduction),
                  )}
                >
                  {providerAnalysis.estimatedTokenReduction}%
                </div>
                <div className="text-xs text-bolt-elements-textSecondary">Token Reduction</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-bolt-elements-textPrimary">{selectedProvider.category}</div>
                <div className="text-xs text-bolt-elements-textSecondary">Category</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium text-bolt-elements-textPrimary mb-2 text-green-500">Strengths</h4>
                <ul className="text-sm space-y-1">
                  {providerAnalysis.strengths.map((strength, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <div className="i-ph:check text-green-500" />
                      {strength}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-medium text-bolt-elements-textPrimary mb-2 text-orange-500">Limitations</h4>
                <ul className="text-sm space-y-1">
                  {providerAnalysis.limitations.map((limitation, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <div className="i-ph:warning text-orange-500" />
                      {limitation}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-4">
              <h4 className="font-medium text-bolt-elements-textPrimary mb-2">Recommendations</h4>
              <ul className="text-sm space-y-1">
                {providerAnalysis.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <div className="i-ph:lightbulb text-blue-500" />
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}

        {activeTab === 'batch' && batchResults && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-bolt-elements-background-depth-2 rounded-lg p-4"
          >
            <h3 className="text-lg font-medium text-bolt-elements-textPrimary mb-4">
              Batch Test Results ({batchResults.length} variations)
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-bolt-elements-borderColor">
                    <th className="text-left p-2">Provider</th>
                    <th className="text-left p-2">Verbosity</th>
                    <th className="text-left p-2">Tokens</th>
                    <th className="text-left p-2">Reduction</th>
                    <th className="text-left p-2">Intent</th>
                    <th className="text-left p-2">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {batchResults.map((result, index) => (
                    <tr key={index} className="border-b border-bolt-elements-borderColor/50">
                      <td className="p-2">{result.config.providerName}</td>
                      <td className="p-2">{result.metadata.verbosity}</td>
                      <td className="p-2">{result.metadata.tokenCount}</td>
                      <td className={classNames('p-2', getTokenReductionColor(result.metadata.tokenReduction))}>
                        {result.metadata.tokenReduction}%
                      </td>
                      <td className="p-2">{result.metadata.intentCategory}</td>
                      <td className="p-2">{result.metadata.generationTime}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 text-xs text-bolt-elements-textSecondary">
              Best performing:{' '}
              {
                batchResults.reduce((best, current) =>
                  current.metadata.tokenReduction > best.metadata.tokenReduction ? current : best,
                ).config.providerName
              }{' '}
              with {Math.max(...batchResults.map((r) => r.metadata.tokenReduction))}% reduction
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
