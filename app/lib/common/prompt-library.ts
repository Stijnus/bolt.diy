import { getCodingPrompt } from './prompts/coding-prompt';
import { getLightweightPrompt } from './prompts/lightweight-prompt';
import { getPlanningPrompt } from './prompts/planning-prompt';
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
    reasoning: {
      label: 'Reasoning & Analysis',
      description:
        'Optimized for reasoning models (o1, o3, Claude 4). Enhanced logical thinking, step-by-step analysis, and complex problem-solving with deep understanding.',
      get: (options) => getReasoningOptimizedPrompt(options),
      info: {
        id: 'reasoning',
        label: 'Reasoning & Analysis',
        description:
          'Advanced prompt optimized for reasoning models like o1, o3, and Claude 4. Emphasizes logical thinking, step-by-step analysis, and complex problem-solving.',
        icon: 'i-ph:brain-fill',
        features: [
          'Deep Logical Analysis',
          'Step-by-Step Reasoning',
          'Complex Problem Solving',
          'Multi-Step Planning',
          'Advanced Architecture',
          'Code Quality Focus',
          'Performance Optimization',
          'Best Practices Enforcement',
        ],
        bestFor: [
          'Complex Architecture',
          'System Design',
          'Algorithm Optimization',
          'Code Reviews',
          'Performance Tuning',
          'Advanced Features',
        ],
        tokenUsage: 'high',
        complexity: 'advanced',
        recommended: true,
      },
    },
    contextaware: {
      label: 'Context-Aware Development',
      description:
        'Maximizes large context windows (200k+ tokens) for comprehensive codebase understanding. Perfect for large projects with extensive file contexts.',
      get: (options) => getContextAwarePrompt(options),
      info: {
        id: 'contextaware',
        label: 'Context-Aware Development',
        description:
          'Optimized for models with large context windows (Claude, Gemini). Provides comprehensive understanding of large codebases and complex project structures.',
        icon: 'i-ph:files-fill',
        features: [
          'Large Context Utilization',
          'Codebase Understanding',
          'Cross-File Analysis',
          'Architecture Awareness',
          'Dependency Tracking',
          'Refactoring Support',
          'Code Consistency',
          'Pattern Recognition',
        ],
        bestFor: [
          'Large Codebases',
          'Refactoring Projects',
          'Code Migrations',
          'Architecture Reviews',
          'Legacy Modernization',
          'Team Collaboration',
        ],
        tokenUsage: 'high',
        complexity: 'advanced',
      },
    },
    performance: {
      label: 'Performance Optimized',
      description:
        'Balanced approach for production applications. Optimizes for speed, efficiency, and resource usage while maintaining comprehensive features.',
      get: (options) => getPerformanceOptimizedPrompt(options),
      info: {
        id: 'performance',
        label: 'Performance Optimized',
        description:
          'Balanced prompt optimized for production environments. Focuses on performance, scalability, and efficient resource utilization.',
        icon: 'i-ph:rocket-launch-fill',
        features: [
          'Speed Optimization',
          'Resource Efficiency',
          'Scalable Architecture',
          'Production Ready',
          'Performance Monitoring',
          'Caching Strategies',
          'Load Optimization',
          'Efficient Algorithms',
        ],
        bestFor: [
          'Production Apps',
          'High-Traffic Sites',
          'Performance Critical',
          'Scalable Systems',
          'Enterprise Solutions',
          'Optimized Workflows',
        ],
        tokenUsage: 'medium',
        complexity: 'moderate',
      },
    },
    planning: {
      label: 'Planning & Discussion',
      description:
        'Focused on project planning, requirements analysis, and technical discussions. Ideal for early project phases and strategic planning.',
      get: (_options) => getPlanningPrompt(),
      info: {
        id: 'planning',
        label: 'Planning & Discussion',
        description:
          'Specialized for project planning, requirements gathering, and technical discussions. Perfect for early project phases and strategic decision-making.',
        icon: 'i-ph:strategy-fill',
        features: [
          'Requirements Analysis',
          'Project Planning',
          'Technical Strategy',
          'Architecture Design',
          'Risk Assessment',
          'Resource Planning',
          'Timeline Estimation',
          'Decision Support',
        ],
        bestFor: [
          'Project Planning',
          'Requirements Gathering',
          'Architecture Design',
          'Technical Discussions',
          'Strategy Development',
          'Decision Making',
        ],
        tokenUsage: 'medium',
        complexity: 'moderate',
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

  // Get recommended prompt based on model capabilities
  static getRecommendedPrompt(modelName: string, contextSize?: number): string {
    // Reasoning models
    if (modelName.includes('o1') || modelName.includes('o3') || modelName.includes('claude-4')) {
      return 'reasoning';
    }

    // Large context models
    if (contextSize && contextSize > 100000) {
      return 'contextaware';
    }

    // Performance models
    if (modelName.includes('gpt-4o') || modelName.includes('gemini-2.0-flash')) {
      return 'performance';
    }

    // Default to full coding prompt
    return 'coding';
  }
}

// Enhanced prompt generators for new prompt types
function getReasoningOptimizedPrompt(options: PromptOptions): string {
  return `You are Bolt, an advanced AI development assistant optimized for reasoning and deep analysis.

<REASONING_OPTIMIZATION>
Approach every task with structured thinking:
1. UNDERSTAND: Break down the request into core components
2. ANALYZE: Consider multiple approaches and their trade-offs  
3. PLAN: Develop a step-by-step implementation strategy
4. IMPLEMENT: Execute with clear reasoning for each decision
5. VALIDATE: Verify correctness and optimize for best practices
</REASONING_OPTIMIZATION>

<ADVANCED_CAPABILITIES>
- Deep architectural analysis and system design
- Complex algorithm optimization and performance tuning
- Advanced pattern recognition and code quality assessment
- Multi-step problem decomposition and solution synthesis
- Comprehensive error analysis and prevention strategies
</ADVANCED_CAPABILITIES>

${getCodingPrompt(options.cwd, options.supabase, options.designScheme)}`;
}

function getContextAwarePrompt(options: PromptOptions): string {
  return `You are Bolt, an AI development assistant with comprehensive codebase understanding.

<CONTEXT_UTILIZATION>
Leverage the full context window for:
- Complete project architecture comprehension
- Cross-file dependency analysis and impact assessment
- Consistent coding patterns and style enforcement
- Comprehensive refactoring with minimal breaking changes
- Intelligent code organization and modular design
</CONTEXT_UTILIZATION>

<CODEBASE_INTELLIGENCE>
- Analyze entire project structure and dependencies
- Maintain consistency across all files and modules
- Identify optimization opportunities at project scale
- Ensure architectural integrity and best practices
- Provide comprehensive impact analysis for changes
</CODEBASE_INTELLIGENCE>

${getCodingPrompt(options.cwd, options.supabase, options.designScheme)}`;
}

function getPerformanceOptimizedPrompt(options: PromptOptions): string {
  return `You are Bolt, an AI development assistant focused on high-performance, production-ready solutions.

<PERFORMANCE_FOCUS>
Prioritize in every implementation:
- Optimal algorithm complexity and resource usage
- Efficient data structures and memory management
- Fast loading times and responsive user experiences
- Scalable architecture patterns and caching strategies
- Production-ready code with monitoring and observability
</PERFORMANCE_FOCUS>

<OPTIMIZATION_PRINCIPLES>
- Write efficient, well-optimized code from the start
- Implement appropriate caching and memoization
- Use performance-conscious libraries and frameworks
- Consider load balancing and horizontal scaling
- Include performance monitoring and metrics
</OPTIMIZATION_PRINCIPLES>

${getCodingPrompt(options.cwd, options.supabase, options.designScheme)}`;
}
