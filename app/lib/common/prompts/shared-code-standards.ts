import type { ProviderCategory } from './provider-categories';
import { getCategoryConfig } from './provider-categories';

/**
 * Shared code quality and project structure standards
 * Used by both unified and provider-optimized prompts
 */

export function getCodeQualityStandards(category?: ProviderCategory): string {
  if (!category) {
    return getDetailedCodeQualityStandards();
  }

  const config = getCategoryConfig(category);

  if (category === 'coding-specialized') {
    return getEnhancedCodeQualityStandards();
  }

  if (config.prefersConcisePrompts) {
    return getConciseCodeQualityStandards();
  }

  return getDetailedCodeQualityStandards();
}

export function getProjectStructureStandards(category?: ProviderCategory): string {
  if (!category) {
    return getDetailedProjectStructureStandards();
  }

  const config = getCategoryConfig(category);

  if (config.prefersConcisePrompts) {
    return getConciseProjectStructureStandards();
  }

  return getDetailedProjectStructureStandards();
}

function getConciseCodeQualityStandards(): string {
  return `<code_quality_standards>
    Code Quality Requirements:
    - Write clean, readable, well-structured code
    - Use proper naming conventions
    - Add error handling and TypeScript types
    - Use modern JavaScript/TypeScript features
    - Keep functions focused (Single Responsibility)
    - Use meaningful variable names and constants
    - Write maintainable, testable code

    CRITICAL - Before Returning Code:
    - Verify all imports are correct and available
    - Check no undefined variables or functions
    - Validate package.json dependencies exist
    - Ensure code follows framework conventions
    - Confirm TypeScript types are valid
  </code_quality_standards>`;
}

function getDetailedCodeQualityStandards(): string {
  return `<code_quality_standards>
    CRITICAL Code Quality Requirements:
    - Write clean, readable, and well-structured code that follows modern best practices
    - Use consistent naming conventions (camelCase for variables/functions, PascalCase for components/classes)
    - Implement proper error handling with try-catch blocks and meaningful error messages
    - Add TypeScript types for all functions, props, and data structures where applicable
    - Use modern JavaScript/TypeScript features (arrow functions, destructuring, async/await, optional chaining)
    - Write self-documenting code with clear variable and function names
    - Add JSDoc comments for complex functions and public APIs
    - Follow the Single Responsibility Principle (SRP) - one function, one purpose
    - Avoid deep nesting and complex conditional logic
    - Use early returns to reduce nesting
    - Implement proper validation for user inputs and API responses
    - Use meaningful variable names that describe the data they contain
    - Avoid magic numbers and strings - use named constants
    - Prefer composition over inheritance
    - Write code that is easy to test and maintain

    CRITICAL - Code Validation Before Returning:
    1. Verify Imports: All import statements reference existing packages or local files
    2. Check Dependencies: package.json includes all used packages with correct versions
    3. Type Safety: No TypeScript errors, all types properly defined
    4. Framework Rules: Code follows framework-specific patterns (e.g., 'use client' in Next.js)
    5. No Undefined References: All variables, functions, and components are defined
    6. Error Handling: Proper try-catch blocks around async operations and API calls
    7. Environment Variables: Use correct format for framework (e.g., VITE_ prefix for Vite)

    Common Mistakes to Avoid:
    - Importing packages not listed in package.json
    - Using hooks without 'use client' in Next.js
    - Forgetting client directives in Astro for interactive components
    - Using Node.js-only APIs in client-side code
    - Missing error boundaries for React components
    - Incorrect path aliases or import extensions
  </code_quality_standards>`;
}

function getEnhancedCodeQualityStandards(): string {
  return `<code_quality_standards>
    CRITICAL Code Quality Requirements:
    - Write production-ready, maintainable, and well-structured code following industry best practices
    - Use consistent naming conventions (camelCase for variables/functions, PascalCase for components/classes)
    - Implement comprehensive error handling with try-catch blocks and meaningful error messages
    - Add TypeScript types for all functions, props, and data structures where applicable
    - Use modern JavaScript/TypeScript features (arrow functions, destructuring, async/await, optional chaining)
    - Write self-documenting code with clear variable and function names
    - Add JSDoc comments for complex functions and public APIs
    - Follow SOLID principles, especially Single Responsibility Principle (SRP)
    - Avoid deep nesting and complex conditional logic - use early returns
    - Implement proper validation for user inputs and API responses
    - Use meaningful variable names that describe the data they contain
    - Avoid magic numbers and strings - use named constants
    - Prefer composition over inheritance
    - Write code that is easy to test, debug, and maintain
    - Follow security best practices - never expose secrets or credentials
    - Optimize for performance and memory usage
    - Use appropriate design patterns for the problem domain
    - Ensure code is accessible and follows WCAG guidelines for UI components

    CRITICAL - Code Validation Before Returning:
    1. Verify Imports: All import statements reference existing packages or local files
    2. Check Dependencies: package.json includes all used packages with correct, compatible versions
    3. Type Safety: No TypeScript errors, all types properly defined and exported
    4. Framework Compliance: Code strictly follows framework-specific patterns and conventions
    5. No Undefined References: All variables, functions, components, and types are properly defined
    6. Error Handling: Comprehensive try-catch blocks with proper error propagation
    7. Environment Variables: Correct format and usage for the framework
    8. Security: No exposed secrets, proper input sanitization, CORS configured correctly
    9. Performance: No unnecessary re-renders, proper memoization, efficient algorithms
    10. Accessibility: Semantic HTML, ARIA labels, keyboard navigation support

    Common Mistakes to Prevent:
    - Importing packages not in package.json or using wrong package versions
    - Missing 'use client'/'use server' directives in Next.js
    - Forgetting client:* directives in Astro for interactive components
    - Using Node.js-only APIs (fs, path, etc.) in client-side code
    - Missing error boundaries and suspense boundaries in React
    - Incorrect path aliases, missing file extensions in TypeScript
    - Using deprecated APIs or packages
    - Mixing SSR/CSR patterns incorrectly
    - Memory leaks from uncleaned event listeners or subscriptions
  </code_quality_standards>`;
}

function getConciseProjectStructureStandards(): string {
  return `<project_structure_standards>
    Project Structure Requirements:
    - Organize by feature/domain, not file type
    - Use clear, descriptive folder and file names
    - Follow framework conventions (React: components/, hooks/, utils/)
    - Group related files in feature folders
    - Use index files for clean imports
    - Keep consistent naming patterns
  </project_structure_standards>`;
}

function getDetailedProjectStructureStandards(): string {
  return `<project_structure_standards>
    CRITICAL Project Structure Requirements:
    - Organize code by feature/domain, not by file type (feature-based folder structure)
    - Use clear, descriptive folder and file names that indicate their purpose
    - Create logical folder hierarchies that scale with project growth
    - Follow framework-specific conventions and best practices:
      * React/Next.js: components/, hooks/, utils/, types/, lib/, pages/ or app/
      * Node.js/Express: controllers/, middleware/, models/, routes/, utils/
      * General: src/, tests/, docs/, public/, config/
    - Group related files together in feature folders
    - Separate concerns clearly (UI components, business logic, utilities, types)
    - Use index files for clean imports and barrel exports
    - Place shared/common code in dedicated folders (shared/, common/, core/)
    - Keep configuration files in the root or config/ directory
    - Create dedicated folders for assets, styles, and static files
    - Use kebab-case for folder names and file names (except React components)
    - Follow naming patterns:
      * Components: PascalCase.tsx/jsx
      * Utilities: camelCase.ts/js
      * Types: camelCase.types.ts
      * Hooks: useCamelCase.ts
      * Constants: UPPER_SNAKE_CASE or camelCase.constants.ts
    - Maintain consistent depth levels - avoid overly nested structures
    - Create README.md files for complex features explaining their purpose and usage
  </project_structure_standards>`;
}
