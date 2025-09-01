import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { classNames } from '~/utils/classNames';
import { Card, CardContent } from '~/components/ui/Card';
import { Badge } from '~/components/ui/Badge';

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

interface PromptInfoCardProps {
  prompt: PromptInfo;
  selected?: boolean;
  onSelect?: (promptId: string) => void;
  className?: string;
}

const tokenUsageConfig = {
  low: {
    label: 'Lightweight',
    color: 'success',
    icon: 'i-ph:feather',
    description: 'Optimized for speed and minimal token usage',
  },
  medium: {
    label: 'Balanced',
    color: 'info',
    icon: 'i-ph:scale',
    description: 'Good balance of features and performance',
  },
  high: {
    label: 'Full-Featured',
    color: 'warning',
    icon: 'i-ph:rocket-launch',
    description: 'Complete feature set with advanced capabilities',
  },
} as const;

const complexityConfig = {
  simple: {
    label: 'Simple',
    color: 'success',
    icon: 'i-ph:check-circle',
  },
  moderate: {
    label: 'Moderate',
    color: 'info',
    icon: 'i-ph:gear',
  },
  advanced: {
    label: 'Advanced',
    color: 'primary',
    icon: 'i-ph:brain',
  },
} as const;

export const PromptInfoCard = memo(({ prompt, selected = false, onSelect, className }: PromptInfoCardProps) => {
  const tokenConfig = tokenUsageConfig[prompt.tokenUsage];
  const complexConfig = complexityConfig[prompt.complexity];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={className}
    >
      <Card
        className={classNames(
          'group cursor-pointer transition-all duration-200 hover:shadow-md',
          'border-bolt-elements-borderColor hover:border-purple-500/40',
          selected
            ? 'ring-2 ring-purple-500/30 border-purple-500/60 bg-purple-500/5'
            : 'hover:bg-bolt-elements-background-depth-2',
          'relative overflow-hidden h-full flex flex-col',
        )}
        onClick={() => onSelect?.(prompt.id)}
      >
        {prompt.recommended && (
          <div className="absolute top-12 right-4 z-10">
            <Badge variant="primary" size="sm" className="text-xs font-medium">
              Recommended
            </Badge>
          </div>
        )}

        <CardContent className="p-6 flex-1 flex flex-col">
          {/* Header with Icon */}
          <div className="flex items-center gap-4 mb-4">
            <div
              className={classNames(
                'p-3 rounded-xl flex-shrink-0 transition-all duration-200',
                'bg-bolt-elements-background-depth-3',
                'group-hover:bg-purple-500/10',
                selected ? 'bg-purple-500/20' : '',
              )}
            >
              <div
                className={classNames(
                  prompt.icon,
                  'w-6 h-6 transition-colors duration-200',
                  'text-bolt-elements-textSecondary',
                  'group-hover:text-purple-500',
                  selected ? 'text-purple-500' : '',
                )}
              />
            </div>

            <div className="flex-1 min-w-0">
              <h3
                className={classNames(
                  'text-lg font-semibold transition-colors duration-200 truncate',
                  'text-bolt-elements-textPrimary',
                  'group-hover:text-purple-500',
                  selected ? 'text-purple-500' : '',
                )}
              >
                {prompt.label}
              </h3>
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-bolt-elements-textSecondary mb-4 leading-relaxed flex-shrink-0">
            {prompt.description}
          </p>

          {/* Badges */}
          <div className="flex items-center gap-2 mb-4 flex-shrink-0">
            <Badge variant={tokenConfig.color as any} size="sm" className="text-xs flex items-center gap-1">
              <div className={classNames(tokenConfig.icon, 'w-3 h-3')} />
              {tokenConfig.label}
            </Badge>
            <Badge variant={complexConfig.color as any} size="sm" className="text-xs flex items-center gap-1">
              <div className={classNames(complexConfig.icon, 'w-3 h-3')} />
              {complexConfig.label}
            </Badge>
          </div>

          {/* Features */}
          <div className="mb-4 flex-1">
            <h4 className="text-xs font-medium text-bolt-elements-textSecondary uppercase tracking-wide mb-2">
              Key Features
            </h4>
            <div className="grid grid-cols-1 gap-1">
              {prompt.features.slice(0, 4).map((feature, index) => (
                <div key={index} className="flex items-center gap-2 text-xs text-bolt-elements-textSecondary">
                  <div className="i-ph:check w-3 h-3 text-green-500 flex-shrink-0" />
                  <span className="truncate">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Best For */}
          <div className="flex-shrink-0">
            <h4 className="text-xs font-medium text-bolt-elements-textSecondary uppercase tracking-wide mb-2">
              Best For
            </h4>
            <div className="flex flex-wrap gap-1">
              {prompt.bestFor.slice(0, 3).map((item, index) => (
                <Badge key={index} variant="subtle" size="sm" className="text-xs font-normal">
                  {item}
                </Badge>
              ))}
              {prompt.bestFor.length > 3 && (
                <Badge variant="subtle" size="sm" className="text-xs font-normal">
                  +{prompt.bestFor.length - 3} more
                </Badge>
              )}
            </div>
          </div>

          {/* Selection Indicator */}
          {selected && (
            <motion.div
              className="absolute inset-0 pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <div className="absolute top-4 left-4">
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
});

PromptInfoCard.displayName = 'PromptInfoCard';
