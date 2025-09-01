import React, { memo, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { classNames } from '~/utils/classNames';
import { Button } from '~/components/ui/Button';

interface SmartModeDetectorProps {
  input: string;
  currentMode: 'build' | 'discuss';
  onModeSwitch: (mode: 'build' | 'discuss') => void;
  className?: string;
}

// Keywords that suggest planning/discussion mode
const DISCUSSION_KEYWORDS = [
  'planning',
  'strategy',
  'approach',
  'think',
  'consider',
  'design pattern',
  'best practice',
  'pros and cons',
  "what's the best way",
  'evaluate',
  'research',
  'investigate',
  'brainstorm',
];

// Keywords that suggest build mode
const BUILD_KEYWORDS = [
  'build',
  'make',
  'implement',
  'code',
  'write',
  'fix',
  'update',
  'modify',
  'generate',
  'component',
  'feature',
  'ui',
  'interface',
  'api',
  'database',
  'deploy',
];

// Question patterns that suggest discussion
const DISCUSSION_PATTERNS = [
  /^(what|how|why|when|where|which)\s+/i,
  /should\s+i/i,
  /what.*best/i,
  /how.*approach/i,
  /pros?\s+and\s+cons?/i,
  /compare.*with/i,
  /difference.*between/i,
];

function detectIntendedMode(input: string): 'build' | 'discuss' | null {
  if (!input || input.length < 10) {
    return null;
  }

  const lowerInput = input.toLowerCase();

  // Count discussion vs build keywords
  const discussionScore = DISCUSSION_KEYWORDS.reduce((score, keyword) => {
    return score + (lowerInput.includes(keyword) ? 1 : 0);
  }, 0);

  const buildScore = BUILD_KEYWORDS.reduce((score, keyword) => {
    return score + (lowerInput.includes(keyword) ? 1 : 0);
  }, 0);

  // Check for discussion patterns
  const hasDiscussionPattern = DISCUSSION_PATTERNS.some((pattern) => pattern.test(input));

  // Boost discussion score if patterns match
  const finalDiscussionScore = discussionScore + (hasDiscussionPattern ? 2 : 0);

  // Determine suggestion
  if (finalDiscussionScore > buildScore && finalDiscussionScore >= 2) {
    return 'discuss';
  } else if (buildScore > finalDiscussionScore && buildScore >= 2) {
    return 'build';
  }

  return null;
}

export const SmartModeDetector = memo(({ input, currentMode, onModeSwitch, className }: SmartModeDetectorProps) => {
  const [suggestedMode, setSuggestedMode] = useState<'build' | 'discuss' | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const detectedMode = detectIntendedMode(input);

    // Only suggest if detected mode differs from current mode
    if (detectedMode && detectedMode !== currentMode && !dismissed) {
      setSuggestedMode(detectedMode);
    } else {
      setSuggestedMode(null);
    }
  }, [input, currentMode, dismissed]);

  // Reset dismissed state when mode changes
  useEffect(() => {
    setDismissed(false);
  }, [currentMode]);

  const handleSwitch = () => {
    if (suggestedMode) {
      onModeSwitch(suggestedMode);
      setDismissed(true);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    setSuggestedMode(null);
  };

  const getSuggestionText = () => {
    if (suggestedMode === 'discuss') {
      return {
        title: '💡 Discussion mode suggested',
        description:
          'Your input seems like a planning or strategic question. Discussion mode is better for exploring ideas.',
        actionText: 'Switch to Discussion',
      };
    } else {
      return {
        title: '🚀 Build mode suggested',
        description: 'Your input looks like an implementation request. Build mode is optimized for creating code.',
        actionText: 'Switch to Build',
      };
    }
  };

  if (!suggestedMode) {
    return null;
  }

  const suggestion = getSuggestionText();

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className={classNames(
          'mb-4 p-4 rounded-xl border border-purple-500/30 bg-gradient-to-r from-purple-500/10 to-blue-500/10',
          'backdrop-blur-sm',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="text-sm font-medium text-bolt-elements-textPrimary">{suggestion.title}</h4>
            </div>
            <p className="text-xs text-bolt-elements-textSecondary leading-relaxed">{suggestion.description}</p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSwitch}
              className="text-xs px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border-purple-500/30"
            >
              {suggestion.actionText}
            </Button>
            <button
              onClick={handleDismiss}
              className="p-1 rounded-md hover:bg-bolt-elements-background-depth-3 transition-colors"
              title="Dismiss suggestion"
            >
              <i className="i-ph:x w-3 h-3 text-bolt-elements-textSecondary" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
});

SmartModeDetector.displayName = 'SmartModeDetector';
