import type { ProviderCategory } from './provider-categories';
import { getCategoryConfig } from './provider-categories';

/**
 * Framework-specific best practices and common patterns
 * Provides guidance for popular frameworks to prevent common errors
 */

export function getFrameworkStandards(category?: ProviderCategory): string {
  if (!category) {
    return getDetailedFrameworkStandards();
  }

  const config = getCategoryConfig(category);

  if (config.prefersConcisePrompts) {
    return getConciseFrameworkStandards();
  }

  return getDetailedFrameworkStandards();
}

function getConciseFrameworkStandards(): string {
  return `<framework_standards>
  Framework-Specific Best Practices:

  Astro:
  - Use .astro components for pages and layouts
  - Client directives: client:load, client:idle, client:visible
  - Import framework components in frontmatter
  - SSG by default, add export const prerender = false for SSR

  Next.js:
  - Use 'use client' directive for client components (hooks, events)
  - Use 'use server' for server actions
  - App router: app/ directory structure
  - Server components by default, client when needed

  Remix:
  - Export loader for data fetching (server-side)
  - Export action for mutations
  - Use useLoaderData() and useActionData()
  - All routes are server-rendered by default

  Vite + React:
  - Fast HMR - avoid full page reloads
  - Use import.meta.env for environment variables
  - Explicit file extensions in imports for TypeScript

  SvelteKit:
  - Use +page.svelte for pages
  - +page.server.ts for server-side logic
  - load functions for data fetching
  - Form actions for mutations

  Common WebContainer Rules:
  - No native binaries, Python stdlib only
  - Use JavaScript-based tools (no pip, cargo, etc.)
  - Vite preferred over Webpack for speed
</framework_standards>`;
}

function getDetailedFrameworkStandards(): string {
  return `<framework_standards>
  CRITICAL Framework-Specific Best Practices:

  === ASTRO ===
  File Structure:
  - .astro files for pages, layouts, and components
  - src/pages/ for routes (file-based routing)
  - src/layouts/ for shared layouts
  - src/components/ for reusable components

  Component Hydration:
  - Components are static (SSG) by default - zero JS
  - Use client directives to hydrate: client:load, client:idle, client:visible, client:media, client:only
  - Example: <ReactComponent client:load /> for interactive React components

  Imports and Frontmatter:
  - Import statements go in frontmatter (---)
  - Framework components (React, Vue, Svelte) can be mixed
  - Use Astro.props for component props

  Common Astro Patterns:
  - export const prerender = false for SSR pages (SSG by default)
  - Use Astro.glob() for content collections
  - getStaticPaths() for dynamic routes

  === NEXT.JS (App Router) ===
  Critical Directives:
  - 'use client' at top of file for client components (required for hooks, event handlers, browser APIs)
  - 'use server' for server actions (form submissions, mutations)
  - Server components by default - no 'use client' needed

  Directory Structure:
  - app/ directory for routes
  - app/layout.tsx for root layout
  - app/page.tsx for homepage
  - app/[slug]/ for dynamic routes

  Common Patterns:
  - async components for server-side data fetching
  - Use fetch() with cache options for data
  - Server actions for mutations (no API routes needed)
  - Metadata API for SEO

  CRITICAL: Always add 'use client' when using:
  - useState, useEffect, useContext, or any hooks
  - onClick, onChange, or event handlers
  - Browser APIs (window, document, localStorage)

  === REMIX ===
  Route Exports:
  - export loader for data fetching (runs server-side)
  - export action for mutations (POST, PUT, DELETE)
  - export default for component
  - export meta for SEO metadata

  Data Hooks:
  - useLoaderData() to access loader data
  - useActionData() to access action results
  - useNavigation() for loading states

  Forms:
  - Use <Form> component for progressive enhancement
  - Forms work without JS, enhanced with JS
  - action prop for custom action routes

  === VITE + REACT ===
  Environment Variables:
  - Use import.meta.env.VITE_* for env vars
  - Prefix with VITE_ to expose to client

  Fast Refresh:
  - Avoid default exports for components (named exports work better)
  - Keep state close to components
  - Minimize side effects in module scope

  Imports:
  - Use explicit extensions for TypeScript (.ts, .tsx)
  - Alias paths with @ (configured in vite.config.ts)

  === SVELTEKIT ===
  File Conventions:
  - +page.svelte for page components
  - +page.ts for page data loading (universal)
  - +page.server.ts for server-side only logic
  - +layout.svelte for nested layouts

  Load Functions:
  - export load in +page.ts for data fetching
  - Return { props } from load function
  - Use $app/stores for page data

  Form Actions:
  - Define in +page.server.ts
  - Use <form method="POST"> with action attribute
  - Progressive enhancement built-in

  === WEBCONTAINER LIMITATIONS ===
  Environment Constraints:
  - Browser-based Node.js runtime
  - NO native binaries (no Python packages via pip, no Rust/C++ compilation)
  - Python limited to standard library only
  - Use JavaScript-based alternatives (e.g., libsql instead of postgres)

  Framework Compatibility:
  - Vite-based frameworks: ✅ Excellent
  - Webpack: ⚠️ Slower, use Vite when possible
  - Native modules: ❌ Won't work
  - Edge/serverless patterns: ✅ Preferred

  === VALIDATION CHECKLIST ===
  Before returning code, verify:
  1. Correct client/server directive for framework
  2. Proper import paths and extensions
  3. Framework-specific file naming conventions
  4. Data fetching matches framework patterns
  5. No native dependencies or binaries
  6. Environment variables use correct format
</framework_standards>`;
}
