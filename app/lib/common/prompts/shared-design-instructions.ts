import type { DesignScheme } from '~/types/design-scheme';
import type { ProviderCategory } from './provider-categories';
import { getCategoryConfig } from './provider-categories';

/**
 * Shared design instruction generation for both unified and provider-optimized prompts
 * Reduces duplication and ensures consistency
 */

export function getDesignInstructions(
  options: {
    chatMode?: 'discuss' | 'build';
    designScheme?: DesignScheme;
  },
  category?: ProviderCategory,
): string {
  if (options.chatMode === 'discuss') {
    return ''; // No design instructions for discuss mode
  }

  // If no category provided, use standard detailed instructions
  if (!category) {
    return getDetailedDesignInstructions(options.designScheme);
  }

  const config = getCategoryConfig(category);

  if (config.prefersConcisePrompts) {
    return getConciseDesignInstructions();
  }

  return getDetailedDesignInstructions(options.designScheme);
}

function getConciseDesignInstructions(): string {
  return `<design_instructions>
  Design Standards:
  - Create professional, production-ready designs
  - Functionality first, then aesthetics
  - Use modern UI patterns and responsive layouts
  - Apply consistent color schemes and typography
  - Ensure accessibility (4.5:1 contrast ratio)
  - Use 8px grid system for spacing
  - Start simple, ensure it works correctly first
</design_instructions>`;
}

function getDetailedDesignInstructions(designScheme?: DesignScheme): string {
  return `<design_instructions>
  CRITICAL Design Standards:
  - Create professional, production-ready designs that work reliably and look polished
  - Designs must be fully functional with no placeholders unless explicitly requested
  - Prioritize functionality and usability over visual complexity
  - Use clean, modern design patterns that are proven and reliable
  - Every interactive element must have proper states (hover, active, disabled, loading)

  Design Principles:
  - Functionality First: Ensure features work correctly before adding visual polish
  - Start Simple: Build a solid foundation, then enhance incrementally
  - User-Focused: Prioritize intuitive UX over impressive visuals
  - Accessible by Default: 4.5:1 contrast, keyboard navigation, screen reader support
  - Responsive Design: Mobile-first approach, works on all screen sizes
  - Performance: Lightweight animations, optimized assets, fast load times

  Technical Requirements:
  - Clean color palette (3-5 colors + neutrals) with sufficient contrast
  - Minimum 4.5:1 contrast ratio for text (WCAG 2.1 AA)
  - Readable typography (16px+ body text, clear hierarchy)
  - Full responsiveness using modern CSS (flexbox, grid, container queries)
  - 8px grid system for consistent spacing
  - Subtle shadows and rounded corners (8-16px radius)
  - Smooth transitions (200-300ms) for micro-interactions

  Quality Checklist:
  - All interactive elements have visual feedback
  - Forms have proper validation and error messages
  - Loading states are clear and informative
  - Empty states are helpful and guide user action
  - Error states provide clear recovery paths
  - Mobile experience is fully functional, not just responsive

  User Design Scheme:
  ${
    designScheme
      ? `
  FONT: ${JSON.stringify(designScheme.font)}
  PALETTE: ${JSON.stringify(designScheme.palette)}
  FEATURES: ${JSON.stringify(designScheme.features)}`
      : 'None provided. Create a clean, professional palette and font selection appropriate for the use case.'
  }
</design_instructions>`;
}
