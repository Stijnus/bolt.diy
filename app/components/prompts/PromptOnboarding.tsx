import React, { memo, useState } from 'react';
import { motion } from 'framer-motion';
import { PromptSelector } from '~/components/ui/PromptSelector';
import { Button } from '~/components/ui/Button';
import { classNames } from '~/utils/classNames';
import { PromptLibrary } from '~/lib/common/prompt-library';

interface PromptOnboardingProps {
  onComplete: (selectedPromptId: string) => void;
  onSkip?: () => void;
  className?: string;
}

/**
 * Onboarding component for new users to select their preferred prompt template
 * Can be used in welcome screens, first-time setup, or settings
 */
export const PromptOnboarding = memo(({ onComplete, onSkip, className }: PromptOnboardingProps) => {
  const [selectedPrompt, setSelectedPrompt] = useState<string>('coding');

  const handleContinue = () => {
    onComplete(selectedPrompt);
  };

  const selectedPromptInfo = PromptLibrary.getPromptInfo(selectedPrompt);

  return (
    <motion.div
      className={classNames('max-w-6xl mx-auto p-6', className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="text-center mb-8">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <h1 className="text-4xl font-bold text-bolt-elements-textPrimary mb-4">Welcome to Bolt! 🚀</h1>
          <p className="text-xl text-bolt-elements-textSecondary max-w-2xl mx-auto">
            Let's personalize your experience by choosing the AI assistant that matches your workflow
          </p>
        </motion.div>
      </div>

      <PromptSelector selectedPromptId={selectedPrompt} onPromptSelect={setSelectedPrompt} showTitle={false} />

      {/* Action Buttons */}
      <motion.div
        className="flex items-center justify-center gap-4 mt-12"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        {onSkip && (
          <Button variant="secondary" onClick={onSkip} className="min-w-[120px]">
            Skip for now
          </Button>
        )}
        <Button
          onClick={handleContinue}
          disabled={!selectedPrompt}
          className="min-w-[160px] bg-purple-600 hover:bg-purple-700"
        >
          Continue with {selectedPromptInfo?.label || 'Selected'}
        </Button>
      </motion.div>

      {/* Selected Prompt Summary */}
      {selectedPromptInfo && (
        <motion.div
          className={classNames(
            'mt-8 p-6 rounded-xl border border-bolt-elements-borderColor',
            'bg-gradient-to-br from-purple-500/5 to-blue-500/5',
            'backdrop-blur-sm max-w-2xl mx-auto',
          )}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6 }}
        >
          <div className="text-center">
            <div className={classNames(selectedPromptInfo.icon, 'w-8 h-8 mx-auto text-purple-500 mb-3')} />
            <h3 className="font-semibold text-bolt-elements-textPrimary mb-2">
              You've selected: {selectedPromptInfo.label}
            </h3>
            <p className="text-sm text-bolt-elements-textSecondary">{selectedPromptInfo.description}</p>
            <div className="flex items-center justify-center gap-2 mt-3 text-xs text-bolt-elements-textTertiary">
              <span>💡 Don't worry, you can always change this later in Settings</span>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
});

PromptOnboarding.displayName = 'PromptOnboarding';
