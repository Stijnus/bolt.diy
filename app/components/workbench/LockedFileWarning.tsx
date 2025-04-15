import React from 'react';

interface LockedFileWarningProps {
  filePath: string;
}

export const LockedFileWarning: React.FC<LockedFileWarningProps> = ({ filePath }) => (
  <div className="flex items-center gap-3 p-3 mb-3 rounded-md bg-red-50 border border-red-200 dark:bg-[#2a1a1a] dark:border-red-400">
    <div className="i-ph:lock-duotone text-red-500 text-2xl shrink-0" />
    <div className="flex flex-col">
      <span className="font-semibold text-red-700 dark:text-red-300 text-base flex items-center gap-1">
        <span className="i-ph:warning-circle text-lg text-red-400" />
        File Locked
      </span>
      <span className="text-sm text-red-600 dark:text-red-200 mt-1">
        Error: The file <span className="font-mono bg-red-100 dark:bg-red-900 px-1 rounded text-xs">{filePath}</span> is
        locked and cannot be modified.
      </span>
    </div>
  </div>
);
