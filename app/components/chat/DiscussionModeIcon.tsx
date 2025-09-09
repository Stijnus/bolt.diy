import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { classNames } from '~/utils/classNames';
import { IconButton } from '~/components/ui/IconButton';
import WithTooltip from '~/components/ui/Tooltip';

interface DiscussionModeIconProps {
  chatMode: 'discuss' | 'build';
  onModeChange: (mode: 'discuss' | 'build') => void;
  disabled?: boolean;
  className?: string;
}

export const DiscussionModeIcon = memo(
  ({ chatMode, onModeChange, disabled = false, className }: DiscussionModeIconProps) => {
    const isDiscussMode = chatMode === 'discuss';

    const handleToggle = () => {
      if (!disabled) {
        onModeChange(isDiscussMode ? 'build' : 'discuss');
      }
    };

    return (
      <div className={className}>
        <WithTooltip
          tooltip={
            isDiscussMode
              ? 'Discussion mode active - Click to return to build mode'
              : 'Click to activate discussion mode for planning and guidance'
          }
        >
          <IconButton
            title={isDiscussMode ? 'Exit discussion mode' : 'Enter discussion mode'}
            className={classNames(
              'transition-all flex items-center gap-1 relative',
              disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
              isDiscussMode
                ? 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30'
                : 'bg-bolt-elements-item-backgroundDefault text-bolt-elements-item-contentDefault hover:bg-bolt-elements-item-backgroundAccent',
            )}
            onClick={handleToggle}
            disabled={disabled}
          >
            <>
              <motion.div
                animate={{
                  scale: isDiscussMode ? [1, 1.1, 1] : 1,
                  rotate: isDiscussMode ? [0, 5, -5, 0] : 0,
                }}
                transition={{
                  duration: isDiscussMode ? 0.6 : 0.2,
                  repeat: isDiscussMode ? Infinity : 0,
                  repeatDelay: 2,
                }}
                className="relative"
              >
                <div className="i-ph:chat-circle-dots text-xl" />
                {isDiscussMode && (
                  <motion.div
                    className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full"
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                )}
              </motion.div>
              {isDiscussMode && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  className="text-xs hidden sm:inline-block ml-1"
                >
                  Discuss
                </motion.span>
              )}
            </>
          </IconButton>
        </WithTooltip>
      </div>
    );
  },
);

DiscussionModeIcon.displayName = 'DiscussionModeIcon';
