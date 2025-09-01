import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { PromptLibrary } from '~/lib/common/prompt-library';
import { PromptInfoCard } from './PromptInfoCard';
import { classNames } from '~/utils/classNames';

interface PromptSelectorProps {
  selectedPromptId?: string;
  onPromptSelect?: (promptId: string) => void;
  className?: string;
  title?: string;
  description?: string;
  layout?: 'grid' | 'list';
  showTitle?: boolean;
}

export const PromptSelector = memo(
  ({
    selectedPromptId,
    onPromptSelect,
    className,
    title = 'Choose Your AI Assistant',
    description = 'Select the prompt template that best matches your workflow and project requirements',
    layout = 'grid',
    showTitle = true,
  }: PromptSelectorProps) => {
    const prompts = PromptLibrary.getInfoList();

    return (
      <motion.div
        className={classNames('flex flex-col gap-6', className)}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {showTitle && (
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-bolt-elements-textPrimary mb-2">{title}</h2>
            <p className="text-bolt-elements-textSecondary">{description}</p>
          </div>
        )}

        <div
          className={classNames(
            layout === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr'
              : 'flex flex-col gap-4',
          )}
        >
          {prompts.map((prompt, index) => (
            <motion.div
              key={prompt.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={layout === 'grid' ? 'h-full' : ''}
            >
              <PromptInfoCard
                prompt={prompt}
                selected={selectedPromptId === prompt.id}
                onSelect={onPromptSelect}
                className={layout === 'grid' ? 'h-full' : ''}
              />
            </motion.div>
          ))}
        </div>

        {/* Additional Info */}
        <motion.div
          className={classNames(
            'mt-8 p-6 rounded-xl border border-bolt-elements-borderColor',
            'bg-gradient-to-br from-purple-500/5 to-blue-500/5',
            'backdrop-blur-sm',
          )}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-start gap-4">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500 flex-shrink-0">
              <div className="i-ph:lightbulb w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-bolt-elements-textPrimary mb-2">💡 Pro Tips for Prompt Selection</h3>
              <ul className="text-sm text-bolt-elements-textSecondary space-y-1">
                <li>
                  • <strong>New to Bolt?</strong> Start with "Full-Featured Coding" for the complete experience
                </li>
                <li>
                  • <strong>Planning a project?</strong> Use "Planning & Discussion" to explore ideas first
                </li>
                <li>
                  • <strong>Quick fixes?</strong> Choose "Lightweight & Fast" for speedy responses
                </li>
                <li>• You can switch between prompts anytime in Settings → Features</li>
              </ul>
            </div>
          </div>
        </motion.div>
      </motion.div>
    );
  },
);

PromptSelector.displayName = 'PromptSelector';
