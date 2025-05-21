import React from 'react';
import type { SyncHistoryEntry } from '~/types/sync';
import { SyncHistoryItem } from './SyncHistoryItem';

interface SyncHistoryListProps {
  history: SyncHistoryEntry[];
}

export const SyncHistoryList: React.FC<SyncHistoryListProps> = ({ history }) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="i-ph:clock-counter-clockwise-duotone h-4 w-4 text-gray-500 dark:text-gray-400" />
        <h3 className="text-sm font-medium text-gray-900 dark:text-white">Sync History</h3>
      </div>

      {history.length === 0 ? (
        <p className="text-xs text-gray-500 dark:text-gray-400 italic text-center py-4">
          No sync history available.
        </p>
      ) : (
        <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
          {history.map((entry) => (
            <SyncHistoryItem key={entry.id || entry.timestamp} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
};
