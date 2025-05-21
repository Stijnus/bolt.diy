import React from 'react';
import type { SyncHistoryEntry } from '~/types/sync';
import { classNames } from '~/utils/classNames';

interface SyncHistoryItemProps {
  entry: SyncHistoryEntry;
}

// Utility function to format bytes into a readable string
const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

// Utility function to format duration from ms to a readable string
const formatDuration = (durationMs: number) => {
  if (durationMs < 1000) {
    return `${durationMs} ms`;
  }
  return `${(durationMs / 1000).toFixed(2)} s`;
};

export const SyncHistoryItem: React.FC<SyncHistoryItemProps> = ({ entry }) => {
  const { timestamp, status, statistics, error, files } = entry;

  const statusConfig = {
    success: { icon: 'i-ph:check-circle-duotone', color: 'text-green-500 dark:text-green-400', label: 'Success' },
    failed: { icon: 'i-ph:x-circle-duotone', color: 'text-red-500 dark:text-red-400', label: 'Failed' },
    partial: { icon: 'i-ph:warning-circle-duotone', color: 'text-yellow-500 dark:text-yellow-400', label: 'Partial' },
    unknown: { icon: 'i-ph:question-duotone', color: 'text-gray-500 dark:text-gray-400', label: 'Unknown' },
  };

  const currentStatus = statusConfig[status] || statusConfig.unknown;

  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700/50 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
          {new Date(timestamp).toLocaleString()}
        </span>
        <div className={classNames('flex items-center gap-1 text-xs font-semibold', currentStatus.color)}>
          <div className={classNames(currentStatus.icon, 'h-4 w-4')} />
          <span>{currentStatus.label}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-700 dark:text-gray-300">
        <div>
          <span className="font-medium">Files Synced:</span> {statistics.syncedFiles ?? files?.length ?? 0}
        </div>
        <div>
          <span className="font-medium">Total Size:</span> {formatBytes(statistics.totalSize)}
        </div>
        <div>
          <span className="font-medium">Duration:</span> {formatDuration(statistics.duration)}
        </div>
      </div>

      {error && (
        <div className="pt-1 mt-1 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs font-medium text-red-600 dark:text-red-400">Error:</p>
          <p className="text-xs text-red-500 dark:text-red-400 break-all">{error}</p>
        </div>
      )}
    </div>
  );
};
