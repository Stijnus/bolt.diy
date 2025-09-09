import React, { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { classNames } from '~/utils/classNames';
import { Button } from '~/components/ui/Button';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { ProviderInfo } from '~/types/model';

interface DiscussionModeRecommendationProps {
  chatMode: 'discuss' | 'build';
  currentModel: string;
  currentProvider: ProviderInfo;
  modelList: ModelInfo[];
  providerList: ProviderInfo[];
  onRecommendationAccept: (provider: ProviderInfo, model: string) => void;
  onDismiss: () => void;
  className?: string;
}

// Preferred models for discussion mode in order of preference
const DISCUSSION_MODE_PREFERRED_MODELS = [
  { provider: 'Google', model: 'gemini-1.5-flash-002', label: 'Gemini 1.5 Flash (Latest)' },
  { provider: 'Google', model: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
  { provider: 'Google', model: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash (Experimental)' },
];

function findBestDiscussionModel(modelList: ModelInfo[], providerList: ProviderInfo[]) {
  for (const preferred of DISCUSSION_MODE_PREFERRED_MODELS) {
    const provider = providerList.find((p) => p.name === preferred.provider);
    const model = modelList.find((m) => m.name === preferred.model && m.provider === preferred.provider);

    if (provider && model) {
      return { provider, model };
    }
  }

  return null;
}

function isCurrentModelOptimalForDiscussion(currentModel: string, currentProvider: ProviderInfo): boolean {
  return DISCUSSION_MODE_PREFERRED_MODELS.some(
    (preferred) => preferred.model === currentModel && preferred.provider === currentProvider.name,
  );
}

export const DiscussionModeRecommendation = memo(
  ({
    chatMode,
    currentModel,
    currentProvider,
    modelList,
    providerList,
    onRecommendationAccept,
    onDismiss,
    className,
  }: DiscussionModeRecommendationProps) => {
    // Only show recommendation in discussion mode
    if (chatMode !== 'discuss') {
      return null;
    }

    // Don't show if current model is already optimal
    if (isCurrentModelOptimalForDiscussion(currentModel, currentProvider)) {
      return null;
    }

    const recommendation = findBestDiscussionModel(modelList, providerList);

    // Don't show if no preferred model is available
    if (!recommendation) {
      return null;
    }

    const handleAccept = () => {
      onRecommendationAccept(recommendation.provider, recommendation.model.name);
    };

    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className={classNames(
            'mb-4 p-4 rounded-xl border border-green-500/30 bg-gradient-to-r from-green-500/10 to-blue-500/10',
            'backdrop-blur-sm',
            className,
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-sm font-medium text-bolt-elements-textPrimary">
                  💡 Recommended model for discussion mode
                </h4>
              </div>
              <p className="text-xs text-bolt-elements-textSecondary leading-relaxed mb-2">
                <strong>{recommendation.model.label}</strong> is optimized for discussion mode with search grounding
                capabilities and faster response times for planning and guidance.
              </p>
              <p className="text-xs text-bolt-elements-textTertiary">
                Current: {currentProvider.name} -{' '}
                {modelList.find((m) => m.name === currentModel)?.label || currentModel}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleAccept}
                className="text-xs px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 border-green-500/30"
              >
                Switch to {recommendation.model.label}
              </Button>
              <button
                onClick={onDismiss}
                className="p-1 rounded-md hover:bg-bolt-elements-background-depth-3 transition-colors"
                title="Dismiss recommendation"
              >
                <i className="i-ph:x w-3 h-3 text-bolt-elements-textSecondary" />
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  },
);

DiscussionModeRecommendation.displayName = 'DiscussionModeRecommendation';
