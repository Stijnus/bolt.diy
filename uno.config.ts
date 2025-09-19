import { globSync } from 'fast-glob';
import fs from 'node:fs/promises';
import { basename } from 'node:path';
import { defineConfig, presetIcons, presetUno, transformerDirectives } from 'unocss';

const iconPaths = globSync('./icons/*.svg');

const collectionName = 'bolt';

const customIconCollection = iconPaths.reduce(
  (acc, iconPath) => {
    const [iconName] = basename(iconPath).split('.');

    acc[collectionName] ??= {};
    acc[collectionName][iconName] = async () => fs.readFile(iconPath, 'utf8');

    return acc;
  },
  {} as Record<string, Record<string, () => Promise<string>>>,
);

const BASE_COLORS = {
  white: '#FFFFFF',
  gray: {
    50: '#FAFAFA',
    100: '#F5F5F5',
    200: '#E5E5E5',
    300: '#D4D4D4',
    400: '#A3A3A3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
    950: '#0A0A0A',
  },
  accent: {
    50: '#F8F5FF',
    100: '#F0EBFF',
    200: '#E1D6FF',
    300: '#CEBEFF',
    400: '#B69EFF',
    500: '#9C7DFF',
    600: '#8A5FFF',
    700: '#7645E8',
    800: '#6234BB',
    900: '#502D93',
    950: '#2D1959',
  },
  green: {
    50: '#F0FDF4',
    100: '#DCFCE7',
    200: '#BBF7D0',
    300: '#86EFAC',
    400: '#4ADE80',
    500: '#22C55E',
    600: '#16A34A',
    700: '#15803D',
    800: '#166534',
    900: '#14532D',
    950: '#052E16',
  },
  yellow: {
    50: '#FFFAEB',
    100: '#FEEFC7',
    200: '#FEDF89',
    300: '#FEC84B',
    400: '#FDB022',
    500: '#F79009',
    600: '#DC6803',
    700: '#B54708',
    800: '#93370D',
    900: '#792E0D',
  },
  blue: {
    50: '#EFF6FF',
    100: '#DBEAFE',
    200: '#BFDBFE',
    300: '#93C5FD',
    400: '#60A5FA',
    500: '#3B82F6',
    600: '#2563EB',
    700: '#1D4ED8',
    800: '#1E40AF',
    900: '#1E3A8A',
    950: '#172554',
  },
  red: {
    50: '#FEF2F2',
    100: '#FEE2E2',
    200: '#FECACA',
    300: '#FCA5A5',
    400: '#F87171',
    500: '#EF4444',
    600: '#DC2626',
    700: '#B91C1C',
    800: '#991B1B',
    900: '#7F1D1D',
    950: '#450A0A',
  },
};

const COLOR_PRIMITIVES = {
  ...BASE_COLORS,
  alpha: {
    white: generateAlphaPalette(BASE_COLORS.white),
    gray: generateAlphaPalette(BASE_COLORS.gray[900]),
    red: generateAlphaPalette(BASE_COLORS.red[500]),
    green: generateAlphaPalette(BASE_COLORS.green[500]),
    yellow: generateAlphaPalette(BASE_COLORS.yellow[500]),
    blue: generateAlphaPalette(BASE_COLORS.blue[500]),
    accent: generateAlphaPalette(BASE_COLORS.accent[500]),
  },
};

export default defineConfig({
  safelist: [...Object.keys(customIconCollection[collectionName] || {}).map((x) => `i-bolt:${x}`)],
  shortcuts: {
    'bolt-ease-cubic-bezier': 'ease-[cubic-bezier(0.4,0,0.2,1)]',
    'transition-theme': 'transition-[background-color,border-color,color] duration-150 bolt-ease-cubic-bezier',
    kdb: 'bg-bolt-elements-code-background text-bolt-elements-code-text py-1 px-1.5 rounded-md',
    'max-w-chat': 'max-w-[var(--chat-max-width)]',

    // Card shortcuts based on ProjectDashboard pattern
    'card-base': 'rounded-xl p-6 shadow-sm hover:shadow-lg transition-all duration-300',
    'card-blue': 'card-base bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 hover:shadow-blue-500/20',
    'card-purple': 'card-base bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 hover:shadow-purple-500/20',
    'card-green': 'card-base bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 hover:shadow-green-500/20',
    'card-neutral': 'card-base bg-gradient-to-r from-gray-500/5 to-gray-500/10 border border-gray-500/20 hover:shadow-gray-500/20',

    // Icon container shortcuts
    'icon-container-base': 'w-10 h-10 rounded-lg flex items-center justify-center',
    'icon-container-blue': 'icon-container-base bg-blue-500/20',
    'icon-container-purple': 'icon-container-base bg-purple-500/20',
    'icon-container-green': 'icon-container-base bg-green-500/20',
    'icon-container-neutral': 'icon-container-base bg-gray-500/20',
  },
  rules: [
    /**
     * This shorthand doesn't exist in Tailwind and we overwrite it to avoid
     * any conflicts with minified CSS classes.
     */
    ['b', {}],
  ],
  theme: {
    colors: {
      ...COLOR_PRIMITIVES,
      bolt: {
        elements: {
          borderColor: 'var(--bolt-elements-borderColor)',
          borderColorActive: 'var(--bolt-elements-borderColorActive)',
          focus: 'var(--bolt-elements-focus)',
          background: 'var(--bolt-elements-background)',
          'background-depth-1': 'var(--bolt-elements-bg-depth-1)',
          'background-depth-2': 'var(--bolt-elements-bg-depth-2)',
          'background-depth-3': 'var(--bolt-elements-bg-depth-3)',
          'background-depth-4': 'var(--bolt-elements-bg-depth-4)',
          textPrimary: 'var(--bolt-elements-textPrimary)',
          textSecondary: 'var(--bolt-elements-textSecondary)',
          textTertiary: 'var(--bolt-elements-textTertiary)',
          modal: {
            background: 'var(--bolt-elements-modal-background)',
            overlay: 'var(--bolt-elements-modal-overlay)',
          },
          input: {
            background: 'var(--bolt-elements-input-background)',
            border: 'var(--bolt-elements-input-border)',
            text: 'var(--bolt-elements-input-text)',
            placeholder: 'var(--bolt-elements-input-placeholder)',
          },
          code: {
            background: 'var(--bolt-elements-code-background)',
            text: 'var(--bolt-elements-code-text)',
          },
          button: {
            primary: {
              background: 'var(--bolt-elements-button-primary-background)',
              backgroundHover: 'var(--bolt-elements-button-primary-backgroundHover)',
              text: 'var(--bolt-elements-button-primary-text)',
            },
            secondary: {
              background: 'var(--bolt-elements-button-secondary-background)',
              backgroundHover: 'var(--bolt-elements-button-secondary-backgroundHover)',
              text: 'var(--bolt-elements-button-secondary-text)',
            },
            danger: {
              background: 'var(--bolt-elements-button-danger-background)',
              backgroundHover: 'var(--bolt-elements-button-danger-backgroundHover)',
              text: 'var(--bolt-elements-button-danger-text)',
              border: 'var(--bolt-elements-button-danger-border)',
            },
          },
          item: {
            contentDefault: 'var(--bolt-elements-item-contentDefault)',
            contentActive: 'var(--bolt-elements-item-contentActive)',
            contentAccent: 'var(--bolt-elements-item-contentAccent)',
            contentDanger: 'var(--bolt-elements-item-contentDanger)',
            backgroundDefault: 'var(--bolt-elements-item-backgroundDefault)',
            backgroundActive: 'var(--bolt-elements-item-backgroundActive)',
            backgroundAccent: 'var(--bolt-elements-item-backgroundAccent)',
            backgroundDanger: 'var(--bolt-elements-item-backgroundDanger)',
          },
          actions: {
            background: 'var(--bolt-elements-actions-background)',
            code: {
              background: 'var(--bolt-elements-actions-code-background)',
            },
          },
          artifacts: {
            background: 'var(--bolt-elements-artifacts-background)',
            backgroundHover: 'var(--bolt-elements-artifacts-backgroundHover)',
            borderColor: 'var(--bolt-elements-artifacts-borderColor)',
            inlineCode: {
              background: 'var(--bolt-elements-artifacts-inlineCode-background)',
              text: 'var(--bolt-elements-artifacts-inlineCode-text)',
            },
          },
          messages: {
            background: 'var(--bolt-elements-messages-background)',
            linkColor: 'var(--bolt-elements-messages-linkColor)',
            code: {
              background: 'var(--bolt-elements-messages-code-background)',
            },
            inlineCode: {
              background: 'var(--bolt-elements-messages-inlineCode-background)',
              text: 'var(--bolt-elements-messages-inlineCode-text)',
            },
          },
          icon: {
            success: 'var(--bolt-elements-icon-success)',
            error: 'var(--bolt-elements-icon-error)',
            primary: 'var(--bolt-elements-icon-primary)',
            secondary: 'var(--bolt-elements-icon-secondary)',
            tertiary: 'var(--bolt-elements-icon-tertiary)',
          },
          preview: {
            addressBar: {
              background: 'var(--bolt-elements-preview-addressBar-background)',
              backgroundHover: 'var(--bolt-elements-preview-addressBar-backgroundHover)',
              backgroundActive: 'var(--bolt-elements-preview-addressBar-backgroundActive)',
              text: 'var(--bolt-elements-preview-addressBar-text)',
              textActive: 'var(--bolt-elements-preview-addressBar-textActive)',
            },
          },
          terminals: {
            background: 'var(--bolt-elements-terminals-background)',
            buttonBackground: 'var(--bolt-elements-terminals-buttonBackground)',
          },
          dividerColor: 'var(--bolt-elements-dividerColor)',
          loader: {
            background: 'var(--bolt-elements-loader-background)',
            progress: 'var(--bolt-elements-loader-progress)',
          },
          prompt: {
            background: 'var(--bolt-elements-prompt-background)',
          },
          sidebar: {
            dropdownShadow: 'var(--bolt-elements-sidebar-dropdownShadow)',
            buttonBackgroundDefault: 'var(--bolt-elements-sidebar-buttonBackgroundDefault)',
            buttonBackgroundHover: 'var(--bolt-elements-sidebar-buttonBackgroundHover)',
            buttonText: 'var(--bolt-elements-sidebar-buttonText)',
          },
          cta: {
            background: 'var(--bolt-elements-cta-background)',
            text: 'var(--bolt-elements-cta-text)',
          },
          status: {
            success: {
              background: 'var(--bolt-elements-status-success-background)',
              text: 'var(--bolt-elements-status-success-text)',
              border: 'var(--bolt-elements-status-success-border)',
            },
            warning: {
              background: 'var(--bolt-elements-status-warning-background)',
              text: 'var(--bolt-elements-status-warning-text)',
              border: 'var(--bolt-elements-status-warning-border)',
            },
            error: {
              background: 'var(--bolt-elements-status-error-background)',
              text: 'var(--bolt-elements-status-error-text)',
              border: 'var(--bolt-elements-status-error-border)',
            },
            info: {
              background: 'var(--bolt-elements-status-info-background)',
              text: 'var(--bolt-elements-status-info-text)',
              border: 'var(--bolt-elements-status-info-border)',
            },
            neutral: {
              background: 'var(--bolt-elements-status-neutral-background)',
              text: 'var(--bolt-elements-status-neutral-text)',
              border: 'var(--bolt-elements-status-neutral-border)',
            },
          },
          card: {
            blue: {
              background: 'var(--bolt-elements-card-blue-background)',
              border: 'var(--bolt-elements-card-blue-border)',
              shadow: 'var(--bolt-elements-card-blue-shadow)',
              iconBackground: 'var(--bolt-elements-card-blue-icon-background)',
            },
            purple: {
              background: 'var(--bolt-elements-card-purple-background)',
              border: 'var(--bolt-elements-card-purple-border)',
              shadow: 'var(--bolt-elements-card-purple-shadow)',
              iconBackground: 'var(--bolt-elements-card-purple-icon-background)',
            },
            green: {
              background: 'var(--bolt-elements-card-green-background)',
              border: 'var(--bolt-elements-card-green-border)',
              shadow: 'var(--bolt-elements-card-green-shadow)',
              iconBackground: 'var(--bolt-elements-card-green-icon-background)',
            },
            neutral: {
              background: 'var(--bolt-elements-card-neutral-background)',
              border: 'var(--bolt-elements-card-neutral-border)',
              shadow: 'var(--bolt-elements-card-neutral-shadow)',
              iconBackground: 'var(--bolt-elements-card-neutral-icon-background)',
            },
            transition: 'var(--bolt-elements-card-transition)',
            hoverScale: 'var(--bolt-elements-card-hover-scale)',
            borderRadius: 'var(--bolt-elements-card-border-radius)',
          },
        },
      },
    },
  },
  transformers: [transformerDirectives()],
  presets: [
    presetUno({
      dark: {
        light: '[data-theme="light"]',
        dark: '[data-theme="dark"]',
      },
    }),
    presetIcons({
      warn: true,
      collections: {
        ...customIconCollection,
      },
      unit: 'em',
    }),
  ],
});

/**
 * Generates an alpha palette for a given hex color.
 *
 * @param hex - The hex color code (without alpha) to generate the palette from.
 * @returns An object where keys are opacity percentages and values are hex colors with alpha.
 *
 * Example:
 *
 * ```
 * {
 *   '1': '#FFFFFF03',
 *   '2': '#FFFFFF05',
 *   '3': '#FFFFFF08',
 * }
 * ```
 */
function generateAlphaPalette(hex: string) {
  return [1, 2, 3, 4, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].reduce(
    (acc, opacity) => {
      const alpha = Math.round((opacity / 100) * 255)
        .toString(16)
        .padStart(2, '0');

      acc[opacity] = `${hex}${alpha}`;

      return acc;
    },
    {} as Record<number, string>,
  );
}
