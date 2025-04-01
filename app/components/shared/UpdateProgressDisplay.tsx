/**
 * Component for displaying update progress with visual states
 */

import { useState, useEffect } from 'react';
import { Progress } from '~/components/ui/Progress';
import { Button } from '~/components/ui/Button';
import { Badge } from '~/components/ui/Badge';
import { Card } from '~/components/ui/Card';
import WithTooltip from '~/components/ui/Tooltip';
import { ScrollArea } from '~/components/ui/ScrollArea';
import type { UpdateState, UpdateStage } from '~/lib/hooks/useUpdateManager';
import { classNames } from '~/utils/classNames';

interface UpdateProgressDisplayProps {
  updateState: Partial<UpdateState>;
  onRetry?: () => void;
  onCancel?: () => void;
  showDetails?: boolean;
}

/**
 * Component that displays update progress with visual feedback based on the current update stage
 * Shows appropriate icons and messages for different stages of the update process
 * Allows users to retry or cancel updates
 */

export function UpdateProgressDisplay({
  updateState,
  onRetry,
  onCancel,
  showDetails = true,
}: UpdateProgressDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [animateProgress, setAnimateProgress] = useState(false);

  // Don't render anything if no update is in progress and no error
  if (!updateState.updateInProgress && !updateState.updateError) {
    return null;
  }

  // Reset state for clean render
  const {
    updateInProgress = false,
    updateProgress = 0,
    updateStage = 'idle',
    updateError = null,
    currentVersion = '',
    latestVersion = '',
  } = updateState;

  // Trigger progress animation when progress changes
  useEffect(() => {
    if (updateInProgress) {
      setAnimateProgress(true);

      const timer = setTimeout(() => setAnimateProgress(false), 700);

      return () => clearTimeout(timer);
    }

    return undefined;
  }, [updateProgress, updateInProgress]);

  // Get appropriate icon and message based on update stage
  const getStageInfo = (stage: UpdateStage) => {
    switch (stage) {
      case 'checking':
        return {
          icon: 'i-ph-spinner animate-spin',
          message: 'Checking for updates...',
          description: 'Looking for the latest version',
          color: 'text-blue-500',
          bgColor: 'bg-blue-50 dark:bg-blue-950/30',
          progressColor: 'bg-blue-500',
        };
      case 'downloading':
        return {
          icon: 'i-ph-cloud-arrow-down',
          message: 'Downloading updates...',
          description: `Downloading version ${latestVersion}`,
          color: 'text-indigo-500',
          bgColor: 'bg-indigo-50 dark:bg-indigo-950/30',
          progressColor: 'bg-indigo-500',
        };
      case 'installing':
        return {
          icon: 'i-ph-package',
          message: 'Installing updates...',
          description: 'Applying changes to your system',
          color: 'text-purple-500',
          bgColor: 'bg-purple-50 dark:bg-purple-950/30',
          progressColor: 'bg-purple-500',
        };
      case 'restarting':
        return {
          icon: 'i-ph-arrow-clockwise animate-spin',
          message: 'Restarting application...',
          description: 'Almost there!',
          color: 'text-green-500',
          bgColor: 'bg-green-50 dark:bg-green-950/30',
          progressColor: 'bg-green-500',
        };
      default:
        return {
          icon: 'i-ph-info',
          message: 'Update in progress...',
          description: 'Please wait',
          color: 'text-gray-500',
          bgColor: 'bg-gray-50 dark:bg-gray-800/30',
          progressColor: 'bg-gray-500',
        };
    }
  };

  // Handle copy error to clipboard
  const copyErrorToClipboard = () => {
    if (updateError && navigator.clipboard) {
      navigator.clipboard.writeText(updateError);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Render error state
  if (updateError) {
    return (
      <Card className="border-destructive/20 shadow-sm overflow-hidden animate-in fade-in duration-300">
        <div className="bg-destructive/10 p-4">
          <div className="flex items-center gap-3">
            <div className="i-ph-warning-circle text-xl text-destructive" />
            <h3 className="font-medium text-destructive">Update Error</h3>
            <Badge variant="destructive" className="ml-auto">
              Failed
            </Badge>
          </div>
        </div>
        <div className="p-4">
          <ScrollArea className="max-h-32 mb-3">
            <p className="text-sm text-destructive/90 whitespace-pre-wrap font-mono text-xs bg-black/5 p-2 rounded">
              {updateError}
            </p>
          </ScrollArea>
          <div className="flex gap-2 justify-end">
            {onRetry && (
              <WithTooltip tooltip="Try updating again">
                <Button size="sm" onClick={onRetry} variant="destructive">
                  <span className="i-ph-arrow-clockwise mr-1" />
                  Retry
                </Button>
              </WithTooltip>
            )}
            <WithTooltip tooltip={copied ? 'Copied!' : 'Copy error details'}>
              <Button size="sm" variant="outline" onClick={copyErrorToClipboard}>
                <span className={copied ? 'i-ph-check mr-1' : 'i-ph-clipboard mr-1'} />
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </WithTooltip>
          </div>
        </div>
      </Card>
    );
  }

  // Get stage information
  const { icon, message, description, color, bgColor, progressColor } = getStageInfo(updateStage);

  // Render update progress
  return (
    <Card className="border-primary/20 shadow-sm overflow-hidden animate-in fade-in duration-300">
      <div className={`${bgColor} p-4`}>
        <div className="flex items-center gap-3">
          <div className={`${icon} text-xl ${color}`} />
          <div>
            <h3 className={`font-medium ${color}`}>{message}</h3>
            <p className="text-xs text-gray-500">{description}</p>
          </div>
          {currentVersion && latestVersion && (
            <div className="ml-auto flex gap-2 items-center">
              <Badge variant="outline" className="text-xs">
                <span className="i-ph-tag mr-1 opacity-70" />
                {currentVersion}
              </Badge>
              <span className="i-ph-arrow-right text-gray-400" />
              <Badge variant="default" className="text-xs bg-primary/80">
                <span className="i-ph-star mr-1 opacity-70" />
                {latestVersion}
              </Badge>
            </div>
          )}
        </div>
      </div>
      {showDetails && (
        <div className="p-4 pt-3">
          <div className="relative">
            <Progress
              value={updateProgress}
              className={classNames(`h-2 ${animateProgress ? 'animate-pulse' : ''}`, {
                [progressColor]: true,
              })}
            />
            {updateProgress > 0 && updateProgress < 100 && (
              <div
                className="absolute -top-1 -translate-x-1/2 left-0 transition-all duration-300 ease-out"
                style={{ left: `${updateProgress}%` }}
              >
                <div className={`w-1 h-4 rounded-full ${progressColor}`} />
              </div>
            )}
          </div>
          <div className="mt-2 flex justify-between items-center">
            <p className="text-xs text-gray-500">
              {updateProgress < 100 ? (
                <>
                  <span className={color}>{updateProgress}%</span> complete
                </>
              ) : (
                <span className="text-green-500 flex items-center">
                  <span className="i-ph-check-circle mr-1" />
                  Completed!
                </span>
              )}
            </p>
            {onCancel && updateInProgress && updateProgress < 100 && (
              <WithTooltip tooltip="Cancel the update process">
                <Button size="sm" variant="ghost" onClick={onCancel} className="h-7 px-2">
                  <span className="i-ph-x mr-1" />
                  Cancel
                </Button>
              </WithTooltip>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
