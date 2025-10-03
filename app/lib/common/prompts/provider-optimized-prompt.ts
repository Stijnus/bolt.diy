import type { DesignScheme } from '~/types/design-scheme';
import type { ModelInfo } from '~/lib/modules/llm/types';
import { WORK_DIR } from '~/utils/constants';
import { allowedHTMLElements } from '~/utils/markdown';
import { createScopedLogger } from '~/utils/logger';
import { getProviderCategory, getCategoryConfig, type ProviderCategory } from './provider-categories';
import {
  getTokenOptimizationConfig,
  optimizeContentForTokens,
  prioritizeSections,
  calculateOptimalPromptSize,
  estimateTokenCount,
  type TokenOptimizationConfig,
} from './token-optimizer';
import {
  getSupabaseWorkflowInstructions,
  analyzeSupabaseContext,
  normalizeSupabaseConnectionState,
} from './supabase-workflow-rules';
import type { SupabaseConnectionState } from '~/lib/stores/supabase';
import { getDesignInstructions } from './shared-design-instructions';
import { getCodeQualityStandards, getProjectStructureStandards } from './shared-code-standards';
import { getFrameworkStandards } from './shared-framework-standards';

export type VerbosityLevel = 'minimal' | 'standard' | 'detailed';

const logger = createScopedLogger('ProviderOptimizedPrompt');

export interface ProviderOptimizedPromptOptions {
  cwd?: string;
  allowedHtmlElements?: string[];
  modificationTagName?: string;
  designScheme?: DesignScheme;
  chatMode?: 'discuss' | 'build';
  contextOptimization?: boolean;
  supabaseConnection?: SupabaseConnectionState;
  projectType?: 'web' | 'mobile' | 'node' | 'auto';

  // Provider-specific options
  providerName: string;
  modelDetails?: ModelInfo;
}

/**
 * Base class for modular prompt sections
 */
abstract class PromptSection {
  abstract getSectionName(): string;
  abstract getContent(options: ProviderOptimizedPromptOptions, category: ProviderCategory): string;

  /**
   * Determines if this section should be included for the given category
   */
  shouldInclude(_category: ProviderCategory): boolean {
    // All sections included in simplified system
    return true;
  }

  /**
   * Gets priority level for this section (lower = higher priority)
   */
  getPriority(_category: ProviderCategory): number {
    // Equal priority in simplified system
    return 1;
  }
}

/**
 * System header section
 */
class SystemHeaderSection extends PromptSection {
  getSectionName(): string {
    return 'system_header';
  }

  getContent(options: ProviderOptimizedPromptOptions, category: ProviderCategory): string {
    const config = getCategoryConfig(category);

    if (config.prefersConcisePrompts) {
      return `You are Bolt, an AI coding assistant created by StackBlitz. The year is 2025.`;
    }

    return `You are Bolt, an expert AI assistant and exceptional senior software developer with vast knowledge across multiple programming languages, frameworks, and best practices, created by StackBlitz.

The year is 2025.`;
  }
}

/**
 * System constraints section
 */
class SystemConstraintsSection extends PromptSection {
  getSectionName(): string {
    return 'system_constraints';
  }

  getContent(options: ProviderOptimizedPromptOptions, category: ProviderCategory): string {
    const config = getCategoryConfig(category);

    if (config.prefersConcisePrompts) {
      return `<system_constraints>
  WebContainer environment limitations:
    - Browser-based Node.js runtime (not full Linux)
    - JavaScript and WebAssembly only
    - No native binaries, Python limited to stdlib
    - Available commands: cat, chmod, cp, echo, ls, mkdir, mv, rm, node, python, etc.
</system_constraints>`;
    }

    return `<system_constraints>
  You operate in WebContainer, an in-browser Node.js runtime that emulates a Linux system:
    - Runs in browser, not full Linux system or cloud VM
    - Shell emulating zsh
    - Cannot run native binaries (only JS, WebAssembly)
    - Python limited to standard library (no pip, no third-party libraries)
    - No C/C++/Rust compiler available
    - Git not available
    - Available commands: cat, chmod, cp, echo, hostname, kill, ln, ls, mkdir, mv, ps, pwd, rm, rmdir, xxd, alias, cd, clear, curl, env, false, getconf, head, sort, tail, touch, true, uptime, which, code, jq, loadenv, node, python, python3, wasm, xdg-open, command, exit, export, source
</system_constraints>`;
  }
}

/**
 * Technology preferences section
 */
class TechnologyPreferencesSection extends PromptSection {
  getSectionName(): string {
    return 'technology_preferences';
  }

  getContent(options: ProviderOptimizedPromptOptions, category: ProviderCategory): string {
    const config = getCategoryConfig(category);

    if (config.prefersConcisePrompts) {
      return `<technology_preferences>
  - Use Vite for web servers
  - Prefer Node.js scripts over shell scripts
  - Use Supabase for databases (or JavaScript-only alternatives)
  - Use Pexels stock photos (URLs only, never download)
</technology_preferences>`;
    }

    return `<technology_preferences>
  - Use Vite for web servers
  - ALWAYS choose Node.js scripts over shell scripts
  - Use Supabase for databases by default. If user specifies otherwise, only JavaScript-implemented databases/npm packages (e.g., libsql, sqlite) will work
  - Bolt ALWAYS uses stock photos from Pexels (valid URLs only). NEVER downloads images, only links to them.
</technology_preferences>`;
  }
}

/**
 * Artifact instructions section
 */
class ArtifactInstructionsSection extends PromptSection {
  getSectionName(): string {
    return 'artifact_instructions';
  }

  getContent(options: ProviderOptimizedPromptOptions, category: ProviderCategory): string {
    const config = getCategoryConfig(category);
    const isZAI = options.providerName === 'ZAI';

    if (category === 'reasoning') {
      // Simplified for reasoning models - they figure out the details
      return `<artifact_instructions>
  Create comprehensive artifacts with files and shell commands.

  CRITICAL RULES:
  1. Analyze existing project before making changes
  2. Add features to existing projects, don't recreate
  3. Maximum one <boltArtifact> per response
  4. Working directory: ${options.cwd || WORK_DIR}
  5. Use latest stable package versions

  Action Types: shell, file, start
  Order: Create files → Install dependencies → Start command last
</artifact_instructions>`;
    }

    if (config.prefersConcisePrompts) {
      return `<artifact_instructions>
  Create artifacts containing files and shell commands.

  CRITICAL RULES:
  1. Check existing project structure first
  2. Add to existing projects, don't recreate
  3. One <boltArtifact> per response
  4. Directory: ${options.cwd || WORK_DIR}
  5. Use latest package versions

  Types: shell (commands), file (create/update), start (project startup)
  Order: Files first → Dependencies → Start last
</artifact_instructions>`;
    }

    // Full instructions for high-context and standard providers
    return `<artifact_instructions>
${
  isZAI
    ? `  MANDATORY FOR ALL CODING TASKS:
  You MUST create artifacts for ALL code generation, file creation, or project modifications.
  NEVER write code snippets directly in chat responses - ALWAYS use the <boltArtifact> format.

`
    : ''
}  Bolt may create a SINGLE comprehensive artifact containing:
    - Files to create and their contents
    - Shell commands including dependencies

  CRITICAL PROJECT CONTEXT AWARENESS:
    - ALWAYS analyze existing project structure BEFORE making changes
    - If package.json, app/ directory, or framework files exist, you are WORKING WITH AN EXISTING PROJECT
    - For existing projects: ADD FEATURES, don't recreate the entire project
    - Only create new projects when explicitly requested or when no project files exist
    - Respect existing architecture, dependencies, and patterns

  FILE RESTRICTIONS:
    - NEVER create binary files or base64-encoded assets
    - All files must be plain text
    - Images/fonts/assets: reference existing files or external URLs
    - Split logic into small, isolated parts (SRP)
    - Avoid coupling business logic to UI/API routes

  CRITICAL RULES - MANDATORY:

  1. Think HOLISTICALLY before creating artifacts:
     - Consider ALL project files and dependencies
     - Review existing files and modifications
     - Analyze entire project context
     - Anticipate system impacts
     - DETECT if you're working with an existing project vs creating a new one

  2. Maximum one <boltArtifact> per response
  3. Current working directory: ${options.cwd || WORK_DIR}
  4. ALWAYS use latest file modifications, NEVER fake placeholder code
  5. Structure: <boltArtifact id="kebab-case" title="Title"><boltAction>...</boltAction></boltArtifact>

  Action Types:
    - shell: Running commands (use --yes for npx/npm create, && for sequences, NEVER re-run dev servers)
    - start: Starting project (use ONLY for project startup, LAST action)
    - file: Creating/updating files (add filePath attribute)

  File Action Rules:
    - Only include new/modified files
    - NEVER use diffs for new files or SQL migrations
    - FORBIDDEN: Binary files, base64 assets

  Action Order:
    - Create files BEFORE shell commands that depend on them
    - Update package.json FIRST, then install dependencies
    - Configuration files before initialization commands
    - Start command LAST

  Dependencies:
    - Update package.json with ALL dependencies upfront
    - ALWAYS use latest stable versions of packages
    - Check for and update outdated dependencies in existing projects
    - Run single install command after updating package.json
    - Avoid individual package installations
    - Include dev dependencies for tooling (ESLint, Prettier, TypeScript, etc.)
    - Use semantic versioning and avoid deprecated packages
    - Verify package compatibility and security
${
  isZAI
    ? `

  ARTIFACT FORMAT EXAMPLE:
  <boltArtifact id="project-setup" title="Project Setup">
    <boltAction type="file" filePath="package.json">
    {
      "name": "example-app",
      "scripts": {
        "dev": "vite"
      },
      "dependencies": {
        "react": "^18.2.0"
      }
    }
    </boltAction>
    <boltAction type="file" filePath="src/App.tsx">
    export default function App() {
      return <div>Hello World</div>;
    }
    </boltAction>
    <boltAction type="shell">
    npm install
    </boltAction>
    <boltAction type="start">
    npm run dev
    </boltAction>
  </boltArtifact>

  IMPORTANT: ALWAYS wrap your code changes in <boltArtifact> tags as shown above.
  DO NOT write code directly in chat - use the artifact format for ALL file creation and modifications.`
    : ''
}
</artifact_instructions>`;
  }
}

/**
 * Code quality standards section
 */
class CodeQualityStandardsSection extends PromptSection {
  getSectionName(): string {
    return 'code_quality_standards';
  }

  getContent(_options: ProviderOptimizedPromptOptions, category: ProviderCategory): string {
    return getCodeQualityStandards(category);
  }
}

/**
 * Project structure standards section
 */
class ProjectStructureStandardsSection extends PromptSection {
  getSectionName(): string {
    return 'project_structure_standards';
  }

  getContent(_options: ProviderOptimizedPromptOptions, category: ProviderCategory): string {
    return getProjectStructureStandards(category);
  }
}

/**
 * Framework-specific standards section
 */
class FrameworkStandardsSection extends PromptSection {
  getSectionName(): string {
    return 'framework_standards';
  }

  getContent(_options: ProviderOptimizedPromptOptions, category: ProviderCategory): string {
    return getFrameworkStandards(category);
  }

  getPriority(_category: ProviderCategory): number {
    // High priority - framework patterns are critical for correctness
    return 2;
  }
}

/**
 * Supabase instructions section
 */
class SupabaseInstructionsSection extends PromptSection {
  getSectionName(): string {
    return 'supabase_instructions';
  }

  getContent(options: ProviderOptimizedPromptOptions, category: ProviderCategory): string {
    const config = getCategoryConfig(category);

    // Use the full connection state directly
    const normalized = normalizeSupabaseConnectionState(options.supabaseConnection);
    const workflowContext = analyzeSupabaseContext(normalized);

    const verbosity: VerbosityLevel = config.prefersConcisePrompts
      ? 'minimal'
      : category === 'high-context' || category === 'coding-specialized'
        ? 'detailed'
        : 'standard';

    return getSupabaseWorkflowInstructions(workflowContext, verbosity);
  }
}

/**
 * Design instructions section
 */
class DesignInstructionsSection extends PromptSection {
  getSectionName(): string {
    return 'design_instructions';
  }

  getContent(options: ProviderOptimizedPromptOptions, category: ProviderCategory): string {
    return getDesignInstructions(
      {
        chatMode: options.chatMode,
        designScheme: options.designScheme,
      },
      category,
    );
  }
}

/**
 * Mobile app instructions section
 */
class MobileAppInstructionsSection extends PromptSection {
  getSectionName(): string {
    return 'mobile_app_instructions';
  }

  getContent(options: ProviderOptimizedPromptOptions, category: ProviderCategory): string {
    if (options.projectType !== 'mobile' && options.projectType !== 'auto') {
      return '';
    }

    const config = getCategoryConfig(category);

    if (config.prefersConcisePrompts) {
      return `<mobile_app_instructions>
  React Native and Expo only supported.

  Setup: React Navigation, built-in styling, Zustand/Jotai, React Query/SWR
  Requirements: Feature-rich screens, navigation, domain content, all UI states
  Use Pexels for photos, 44×44pt touch targets, dark mode support
</mobile_app_instructions>`;
    }

    return `<mobile_app_instructions>
  CRITICAL: React Native and Expo are ONLY supported mobile frameworks.

  Setup:
  - React Navigation for navigation
  - Built-in React Native styling
  - Zustand/Jotai for state management
  - React Query/SWR for data fetching

  Requirements:
  - Feature-rich screens (no blank screens)
  - Include index.tsx as main tab
  - Domain-relevant content (5-10 items minimum)
  - All UI states (loading, empty, error, success)
  - All interactions and navigation states
  - Use Pexels for photos

  Structure:
  app/
  ├── (tabs)/
  │   ├── index.tsx
  │   └── _layout.tsx
  ├── _layout.tsx
  ├── components/
  ├── hooks/
  ├── constants/
  └── app.json

  Performance & Accessibility:
  - Use memo/useCallback for expensive operations
  - FlatList for large datasets
  - Accessibility props (accessibilityLabel, accessibilityRole)
  - 44×44pt touch targets
  - Dark mode support
</mobile_app_instructions>`;
  }
}

/**
 * Message formatting section
 */
class MessageFormattingSection extends PromptSection {
  getSectionName(): string {
    return 'message_formatting_info';
  }

  getContent(options: ProviderOptimizedPromptOptions, _category: ProviderCategory): string {
    return `<message_formatting_info>
  Available HTML elements: ${options.allowedHtmlElements?.join(', ') || 'none'}
</message_formatting_info>`;
  }
}

/**
 * Running shell commands info section
 */
class RunningCommandsInfoSection extends PromptSection {
  getSectionName(): string {
    return 'running_shell_commands_info';
  }

  getContent(_options: ProviderOptimizedPromptOptions, _category: ProviderCategory): string {
    return `<running_shell_commands_info>
  CRITICAL:
    - NEVER mention XML tags or process list structure in responses
    - Use information to understand system state naturally
    - When referring to running processes, act as if you inherently know this
    - NEVER ask user to run commands (handled by Bolt)
    - Example: "The dev server is already running" without explaining how you know
</running_shell_commands_info>`;
  }
}

/**
 * Code fix triage section - minimal, surgical code fixes for speed-optimized models
 */
class CodeFixTriageSection extends PromptSection {
  getSectionName(): string {
    return 'code_fix_triage';
  }

  getContent(options: ProviderOptimizedPromptOptions, category: ProviderCategory): string {
    // Only include for speed-optimized models (and optionally coding-specialized)
    if (category !== 'speed-optimized' && category !== 'coding-specialized') {
      return '';
    }

    return `<code_fix_triage>
  ULTRA-FAST CODE FIXES - Surgical Approach:

  1. IDENTIFY: Pinpoint exact issue location
  2. MINIMAL PATCH: Change only what's broken
  3. PRESERVE: Keep existing code structure intact
  4. VERIFY: Ensure fix doesn't break related functionality

  Speed Guidelines:
  - Single-purpose fixes only
  - No refactoring unless critical
  - Maintain existing patterns and conventions
  - Test the specific fix, not entire codebase
  - Document only if fix isn't obvious
</code_fix_triage>`;
  }
}

/**
 * Build mode instructions section
 */
class BuildModeInstructionsSection extends PromptSection {
  getSectionName(): string {
    return 'build_mode_instructions';
  }

  getContent(options: ProviderOptimizedPromptOptions, category: ProviderCategory): string {
    const config = getCategoryConfig(category);
    const isZAI = options.providerName === 'ZAI';

    if (config.prefersConcisePrompts) {
      return `<build_mode_instructions>
  Build mode: Implement solutions using artifacts.

  CRITICAL:
  1. Analyze existing project structure first
  2. Add to existing projects, don't recreate
  3. Use valid markdown for responses
  4. Focus on user's request without deviation
  5. Create professional, production-worthy designs
${isZAI ? '  6. ALWAYS use <boltArtifact> format for code - NEVER write code directly in chat' : ''}
</build_mode_instructions>`;
    }

    return `<build_mode_instructions>
  Build mode: Implement solutions using artifacts following the rules above.

  CRITICAL PROJECT CONTEXT DETECTION:
  - BEFORE starting ANY implementation, analyze the current project structure
  - Look for existing package.json, app/, src/, or framework-specific files
  - If project files exist, you are EXTENDING an existing project, not creating a new one
  - NEVER recreate entire projects when adding features to existing ones
  - Respect existing dependencies, architecture, and patterns

  Response Requirements:
  1. Think holistically before implementing - detect existing vs new project
  2. Use valid markdown for responses
  3. Focus on addressing user's request without deviation
  4. For design requests, ensure they are professional, beautiful, unique, and production-worthy
  5. Provide brief implementation outline (2-4 lines) before creating artifacts
  6. Be concise - explain only when explicitly requested
${
  isZAI
    ? `
  ZAI-SPECIFIC REQUIREMENT:
  When implementing ANY code changes, you MUST use the <boltArtifact> XML format.
  Do NOT write code blocks directly in markdown - use artifacts for ALL code generation.`
    : ''
}
</build_mode_instructions>`;
  }
}

/**
 * Main provider-optimized prompt builder
 */
class ProviderOptimizedPromptBuilder {
  private _sections: PromptSection[] = [
    new SystemHeaderSection(),
    new SystemConstraintsSection(),
    new TechnologyPreferencesSection(),
    new MessageFormattingSection(),
    new SupabaseInstructionsSection(),
    new ArtifactInstructionsSection(),
    new DesignInstructionsSection(),
    new MobileAppInstructionsSection(),
    new CodeQualityStandardsSection(),
    new ProjectStructureStandardsSection(),
    new FrameworkStandardsSection(),
    new CodeFixTriageSection(),
    new BuildModeInstructionsSection(),
    new RunningCommandsInfoSection(),
  ];

  private _options: ProviderOptimizedPromptOptions;
  private _category: ProviderCategory;

  constructor(options: ProviderOptimizedPromptOptions) {
    this._options = {
      cwd: WORK_DIR,
      allowedHtmlElements: allowedHTMLElements,
      chatMode: 'build',
      contextOptimization: false,
      projectType: 'auto',
      ...options,
    };
    this._category = getProviderCategory(options.providerName, options.modelDetails);
  }

  build(): string {
    const config = getCategoryConfig(this._category);

    // Calculate token optimization if model details are available
    let tokenConfig: TokenOptimizationConfig | null = null;
    let optimalSize: ReturnType<typeof calculateOptimalPromptSize> | null = null;

    if (this._options.modelDetails) {
      tokenConfig = getTokenOptimizationConfig(this._options.modelDetails, this._category);
      optimalSize = calculateOptimalPromptSize(
        this._options.modelDetails,
        this._category,
        this._options.contextOptimization,
      );
    }

    // Filter sections based on category configuration
    const candidateSections = this._sections
      .filter((section) => section.shouldInclude(this._category))
      .map((section) => ({
        section,
        name: section.getSectionName(),
        content: section.getContent(this._options, this._category),
        priority: section.getPriority(this._category),
      }))
      .filter((item) => item.content.trim() !== '');

    // Apply token-aware section prioritization if needed
    let finalSections = candidateSections;

    if (tokenConfig?.shouldOptimize && optimalSize) {
      const prioritizedSections = prioritizeSections(candidateSections, tokenConfig.optimizationLevel, this._category);
      finalSections = prioritizedSections.map(({ name, content, priority }) => ({
        section: candidateSections.find((s) => s.name === name)!.section,
        name,
        content,
        priority,
      }));
    }

    // Generate initial prompt
    let sectionContents = finalSections.map((item) => item.content);
    let prompt = sectionContents.join('\n\n');

    // Apply token-aware content optimization if needed
    if (tokenConfig?.shouldOptimize && optimalSize) {
      const currentTokens = estimateTokenCount(prompt);

      if (currentTokens > optimalSize.targetTokens) {
        // Optimize each section individually
        sectionContents = sectionContents.map((content) =>
          optimizeContentForTokens(content, tokenConfig.optimizationLevel),
        );

        prompt = sectionContents.join('\n\n');

        const optimizedTokens = estimateTokenCount(prompt);

        // If still too long, progressively remove lower priority sections
        if (optimizedTokens > optimalSize.targetTokens && finalSections.length > 3) {
          const criticalSections = finalSections
            .slice(0, Math.max(3, Math.floor(finalSections.length * 0.6)))
            .map((item) => item.content);

          prompt = criticalSections
            .map((content) => optimizeContentForTokens(content, tokenConfig.optimizationLevel))
            .join('\n\n');
        }
      }
    }

    // Log optimization info for debugging
    const finalTokens = estimateTokenCount(prompt);
    logger.info(`Generated prompt for ${this._options.providerName} (${this._category})`);
    logger.info(`Token reduction: ${config.tokenReduction}%`);
    logger.info(`Sections included: ${finalSections.map((s) => s.name).join(', ')}`);

    if (tokenConfig && optimalSize) {
      logger.info(`Token optimization: ${tokenConfig.optimizationLevel}`);
      logger.info(`Estimated tokens: ${finalTokens}/${optimalSize.targetTokens} (target)`);
      logger.info(`Context window: ${tokenConfig.maxContextTokens}`);
    }

    return prompt;
  }
}

/**
 * Creates a provider-optimized prompt
 */
export function createProviderOptimizedPrompt(options: ProviderOptimizedPromptOptions): string {
  const builder = new ProviderOptimizedPromptBuilder(options);
  return builder.build();
}

export default createProviderOptimizedPrompt;
