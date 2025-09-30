import type { DesignScheme } from '~/types/design-scheme';
import type { VerbosityLevel } from './mode-specific-builders';

export interface DesignContext {
  isNewProject: boolean;
  requiresResponsive: boolean;
  hasExistingDesignSystem: boolean;
  targetComplexity: 'simple' | 'moderate' | 'complex';
}

/**
 * Compressed design standards with context-aware optimization
 */
export function getCompressedDesignInstructions(
  verbosity: VerbosityLevel = 'standard',
  designScheme?: DesignScheme,
  context?: DesignContext,
): string {
  switch (verbosity) {
    case 'minimal':
      return getMinimalDesignInstructions(context);
    case 'detailed':
      return getDetailedDesignInstructions(designScheme, context);
    default:
      return getStandardDesignInstructions(designScheme, context);
  }
}

/**
 * Ultra-minimal design instructions (30-50 tokens)
 */
function getMinimalDesignInstructions(context?: DesignContext): string {
  const base = 'Create polished, professional designs. Modern UI patterns. Accessibility: 4.5:1 contrast.';

  if (context?.targetComplexity === 'simple') {
    return `${base} Clean layouts, consistent spacing.`;
  }

  if (context?.targetComplexity === 'complex') {
    return `${base} Advanced animations, design system patterns.`;
  }

  return `${base} Responsive layouts, 8px grid.`;
}

/**
 * Standard design instructions (100-150 tokens)
 */
function getStandardDesignInstructions(designScheme?: DesignScheme, _context?: DesignContext): string {
  const customScheme = designScheme ? getDesignSchemeString(designScheme, 'compact') : '';

  return `<design_instructions>
Design Standards:
- Create polished, professional designs rivaling Apple/Stripe quality
- Modern UI patterns with responsive layouts
- Consistent color schemes and typography
- Accessibility: 4.5:1 contrast ratio, WCAG 2.1 AA
- 8px grid system for spacing
- Purposeful micro-interactions and animations
${customScheme}
</design_instructions>`;
}

/**
 * Detailed design instructions (full version ~300-400 tokens)
 */
function getDetailedDesignInstructions(designScheme?: DesignScheme, context?: DesignContext): string {
  const customScheme = designScheme
    ? getDesignSchemeString(designScheme, 'detailed')
    : 'None provided. Create a bespoke palette, font selection, and feature set that aligns with the brand identity.';

  const complexityGuidance = getComplexityGuidance(context?.targetComplexity || 'moderate');

  return `<design_instructions>
CRITICAL Design Standards:
- Create breathtaking, immersive designs that feel like bespoke masterpieces, rivaling the polish of Apple, Stripe, or luxury brands
- Designs must be production-ready, fully featured, with no placeholders unless explicitly requested
- Avoid generic or templated aesthetics; every design must have a unique, brand-specific visual signature
- Headers must be dynamic, immersive, and storytelling-driven using layered visuals and motion
- Incorporate purposeful, lightweight animations for scroll reveals and micro-interactions

Design Principles:
- Achieve Apple-level refinement with meticulous attention to detail
- Deliver fully functional interactive components with intuitive feedback states
- Use custom illustrations or symbolic visuals instead of generic stock imagery
- Ensure designs feel alive and modern with dynamic elements like gradients and glows
- Before finalizing, ask: "Would this design make Apple or Stripe designers pause and take notice?"

Technical Requirements:
- Curated color palette (3-5 evocative colors + neutrals)
- Minimum 4.5:1 contrast ratio for accessibility
- Expressive, readable fonts (18px+ body, 40px+ headlines)
- Full responsiveness across all screen sizes
- WCAG 2.1 AA guidelines compliance
- 8px grid system for consistent spacing
- Subtle shadows, gradients, and rounded corners (16px radius)

${complexityGuidance}

User Design Scheme:
${customScheme}
</design_instructions>`;
}

/**
 * Generates complexity-specific guidance
 */
function getComplexityGuidance(complexity: 'simple' | 'moderate' | 'complex'): string {
  switch (complexity) {
    case 'simple':
      return `Simplicity Focus:
- Clean, minimal layouts with plenty of white space
- Limited color palette (2-3 colors max)
- Standard UI patterns and components
- Subtle animations and transitions`;

    case 'complex':
      return `Advanced Design Features:
- Complex layouts with advanced grid systems
- Rich interactions and state management
- Advanced animations and micro-interactions
- Custom design system components
- Advanced accessibility features`;

    default:
      return `Balanced Approach:
- Modern layouts with purposeful complexity
- Thoughtful use of color and typography
- Smooth animations and hover states
- Responsive design patterns`;
  }
}

/**
 * Formats design scheme for different verbosity levels
 */
function getDesignSchemeString(designScheme: DesignScheme, format: 'compact' | 'detailed'): string {
  if (format === 'compact') {
    return `Custom Scheme: ${designScheme.font ? `Font: ${JSON.stringify(designScheme.font)}` : ''} ${designScheme.palette ? `Colors: ${JSON.stringify(designScheme.palette)}` : ''}`.trim();
  }

  return `
FONT: ${JSON.stringify(designScheme.font)}
PALETTE: ${JSON.stringify(designScheme.palette)}
FEATURES: ${JSON.stringify(designScheme.features)}`;
}

/**
 * Context-specific design rules for different UI scenarios
 */
export function getContextualDesignRules(
  context: 'dashboard' | 'landing' | 'form' | 'mobile' | 'component',
  verbosity: VerbosityLevel = 'standard',
): string {
  const rules = CONTEXTUAL_DESIGN_RULES[context];

  switch (verbosity) {
    case 'minimal':
      return rules.minimal;
    case 'detailed':
      return rules.detailed;
    default:
      return rules.standard;
  }
}

/**
 * Context-specific design rules
 */
const CONTEXTUAL_DESIGN_RULES = {
  dashboard: {
    minimal: 'Dashboard: Clear hierarchy, data visualization, responsive grid.',
    standard:
      'Dashboard Design: Clear information hierarchy, effective data visualization, responsive grid layout, consistent spacing, intuitive navigation.',
    detailed: `Dashboard Design Requirements:
- Clear information hierarchy with primary/secondary data distinction
- Effective data visualization with charts, graphs, and metrics
- Responsive grid layout that adapts to different screen sizes
- Consistent spacing using 8px grid system
- Intuitive navigation with breadcrumbs and clear sections
- Loading states and error handling for data
- Dark/light mode support for extended use`,
  },

  landing: {
    minimal: 'Landing: Hero section, clear CTA, mobile-first, fast loading.',
    standard:
      'Landing Page: Compelling hero section, clear call-to-action, mobile-first design, fast loading, social proof elements.',
    detailed: `Landing Page Requirements:
- Compelling hero section with clear value proposition
- Strong, prominent call-to-action buttons
- Mobile-first responsive design
- Fast loading with optimized images and assets
- Social proof elements (testimonials, logos, stats)
- Progressive disclosure of information
- Conversion optimization with A/B testing considerations
- SEO-friendly structure and meta tags`,
  },

  form: {
    minimal: 'Forms: Clear labels, validation, accessible, logical flow.',
    standard:
      'Form Design: Clear labels and placeholders, real-time validation, accessible inputs, logical field grouping and flow.',
    detailed: `Form Design Requirements:
- Clear, descriptive labels and helpful placeholders
- Real-time validation with meaningful error messages
- Accessible inputs with proper ARIA labels
- Logical field grouping and progressive disclosure
- Clear visual hierarchy and spacing
- Mobile-optimized input types and keyboards
- Loading states for submission
- Success states and confirmation messages
- Auto-save capabilities for long forms`,
  },

  mobile: {
    minimal: 'Mobile: Touch targets 44px+, thumb-friendly, offline states.',
    standard:
      'Mobile Design: Touch targets 44px minimum, thumb-friendly navigation, native patterns, offline states, gesture support.',
    detailed: `Mobile Design Requirements:
- Touch targets minimum 44×44pt for accessibility
- Thumb-friendly navigation and interaction zones
- Native platform patterns and conventions
- Offline states and error handling
- Gesture support for common actions
- Optimized typography for mobile reading
- Battery and performance considerations
- Progressive Web App capabilities
- Safe area handling for notched devices`,
  },

  component: {
    minimal: 'Components: Reusable, consistent, documented, tested.',
    standard:
      'Component Design: Reusable design tokens, consistent API, comprehensive states, accessibility built-in, documentation.',
    detailed: `Component Design Requirements:
- Reusable design tokens and variables
- Consistent API and prop patterns
- Comprehensive states (default, hover, active, disabled, loading, error)
- Accessibility built-in with proper ARIA attributes
- Responsive behavior and breakpoint handling
- Theme support and customization options
- Comprehensive documentation with examples
- Unit and visual regression testing
- Performance optimization and lazy loading`,
  },
};

/**
 * Design system shortcuts for common patterns
 */
export const DESIGN_SHORTCUTS = {
  spacing: '<spacing: 8px-grid>',
  colors: '<colors: 3-5-palette + neutrals>',
  typography: '<type: 18px+ body, 40px+ heads>',
  accessibility: '<a11y: 4.5:1-contrast, WCAG-AA>',
  responsive: '<responsive: mobile-first, breakpoints>',
  animations: '<motion: micro-interactions, purposeful>',
  quality: '<quality: Apple-level, production-ready>',
} as const;

/**
 * Gets shorthand design rules for ultra-compressed prompts
 */
export function getShorthandDesignRules(shortcuts: (keyof typeof DESIGN_SHORTCUTS)[]): string {
  return shortcuts.map((shortcut) => DESIGN_SHORTCUTS[shortcut]).join(' ');
}

/**
 * Token count estimates for design instructions
 */
export const DESIGN_TOKEN_ESTIMATES = {
  minimal: 50 as const,
  standard: 130 as const,
  detailed: 380 as const,
  with_scheme: (base: number) => base + 30,
  contextual: (base: number, context: string) => base + (context === 'detailed' ? 60 : 20),
};

/**
 * Calculates estimated tokens for design instructions
 */
export function estimateDesignTokens(
  verbosity: VerbosityLevel = 'standard',
  hasDesignScheme = false,
  hasContext = false,
): number {
  let tokens: number = DESIGN_TOKEN_ESTIMATES[verbosity];

  if (hasDesignScheme) {
    tokens = DESIGN_TOKEN_ESTIMATES.with_scheme(tokens);
  }

  if (hasContext) {
    tokens = DESIGN_TOKEN_ESTIMATES.contextual(tokens, verbosity);
  }

  return tokens;
}
