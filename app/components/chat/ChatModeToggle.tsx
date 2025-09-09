import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { classNames } from '~/utils/classNames';
import { TabsWithSlider } from '~/components/ui/TabsWithSlider';

interface ChatModeToggleProps {
  chatMode: 'discuss' | 'build';
  onModeChange: (mode: 'discuss' | 'build') => void;
  disabled?: boolean;
  className?: string;
}

export const ChatModeToggle = memo(({ chatMode, onModeChange, disabled = false, className }: ChatModeToggleProps) => {
  const modes = [
    {
      id: 'build',
      label: 'Build',
      icon: 'i-ph:code',
      description: 'Create and modify code using your selected prompt template',
      shortcut: 'B',
    },
    {
      id: 'discuss',
      label: 'Discuss',
      icon: 'i-ph:chat-circle-dots',
      description: 'Plan projects, ask questions, and get guidance with search grounding',
      shortcut: 'D',
    },
  ];

  const activeMode = modes.find((mode) => mode.id === chatMode);

  const handleModeChange = (modeId: string) => {
    if (!disabled) {
      onModeChange(modeId as 'discuss' | 'build');
    }
  };

  return (
    <div className={classNames('flex items-center', className)}>
      <TabsWithSlider
        tabs={modes}
        activeTab={chatMode}
        onChange={handleModeChange}
        className={classNames(
          'bg-bolt-elements-background-depth-3 rounded-lg border border-bolt-elements-borderColor shadow-sm',
          disabled ? 'opacity-50 cursor-not-allowed' : undefined,
        )}
        sliderClassName="shadow-sm"
        tabClassName={classNames(
          'bg-transparent text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-2 hover:text-bolt-elements-textPrimary border-transparent',
          disabled ? 'cursor-not-allowed hover:bg-transparent' : undefined,
        )}
        activeTabClassName="text-bolt-elements-item-contentAccent font-semibold"
      />

      {/* Mode info */}
      {activeMode && (
        <motion.div
          key={activeMode.id}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
          className="ml-3 hidden md:flex items-center gap-2 text-xs text-bolt-elements-textSecondary"
        >
          <div
            className={classNames(
              'w-1 h-1 rounded-full',
              activeMode.id === 'discuss' ? 'bg-green-500 animate-pulse' : 'bg-purple-500',
            )}
          />
          <span className="truncate max-w-[200px]">{activeMode.description}</span>
          {activeMode.id === 'discuss' && (
            <div className="flex items-center gap-1 ml-1 px-1.5 py-0.5 bg-green-500/10 text-green-400 text-xs rounded-full border border-green-500/20">
              <span className="i-ph:magnifying-glass text-xs" />
              <span>Search</span>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
});

ChatModeToggle.displayName = 'ChatModeToggle';
