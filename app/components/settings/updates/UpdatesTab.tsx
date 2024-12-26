import React from 'react';
import UpdateManager from './UpdateManager';
import { logStore, type LogEntry } from '~/lib/stores/logs';

export default function UpdatesTab() {
  const logs = logStore.getLogs();
  const updateLogs = logs.filter(
    (log: LogEntry) => log.message.toLowerCase().includes('update') || log.message.toLowerCase().includes('version'),
  );

  return (
    <div className="space-y-6">
      {/* Manual Update Section */}
      <div className="p-4 bg-bolt-elements-bg-depth-2 border border-bolt-elements-borderColor rounded-lg">
        <h3 className="text-lg font-medium text-bolt-elements-textPrimary mb-4">Manual Update</h3>
        <div className="bg-bolt-elements-bg-depth-3 rounded-lg p-4">
          <UpdateManager />
        </div>
      </div>

      {/* Update Logs */}
      <div className="p-4 bg-bolt-elements-bg-depth-2 border border-bolt-elements-borderColor rounded-lg">
        <h3 className="text-lg font-medium text-bolt-elements-textPrimary mb-4">Update History</h3>
        <div className="bg-bolt-elements-bg-depth-3 rounded-lg p-4 max-h-96 overflow-y-auto">
          {updateLogs.length > 0 ? (
            <div className="space-y-2">
              {updateLogs.map((log: LogEntry) => (
                <div
                  key={log.id}
                  className="text-sm text-bolt-elements-textSecondary border-l-2 border-bolt-elements-borderColor pl-3 py-1"
                >
                  <span className="text-xs text-bolt-elements-textTertiary">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                  <p className="whitespace-pre-line">{log.message}</p>
                  {log.details && (
                    <pre className="mt-1 text-xs text-bolt-elements-textTertiary overflow-x-auto">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-bolt-elements-textSecondary text-sm">No update history available</p>
          )}
        </div>
      </div>
    </div>
  );
}
