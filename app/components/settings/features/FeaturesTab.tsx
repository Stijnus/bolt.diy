import React from 'react';
import { Switch } from '~/components/ui/Switch';
import { PromptLibrary } from '~/lib/common/prompt-library';
import { useSettings } from '~/lib/hooks/useSettings';

export default function FeaturesTab() {
  const {
    debug,
    enableDebugMode,
    isLocalModel,
    enableLocalModels,
    enableEventLogs,
    eventLogs,
    isLatestBranch,
    enableLatestBranch,
    promptId,
    setPromptId,
    enableUpdates,
    updatesEnabled,
  } = useSettings();

  const [showPullRequests, setShowPullRequests] = React.useState(false);

  return (
    <div className="p-4 bg-bolt-elements-bg-depth-2 border border-bolt-elements-borderColor rounded-lg mb-4">
      <div className="mb-6">
        <h3 className="text-lg font-medium text-bolt-elements-textPrimary mb-4">Optional Features</h3>
        <div className="space-y-4">
          {/* Debug Feature */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-bolt-elements-textPrimary">Debug Features</span>
              <p className="text-sm text-bolt-elements-textSecondary">
                Enable debug mode to access advanced debugging tools
              </p>
            </div>
            <Switch className="ml-auto" checked={debug} onCheckedChange={enableDebugMode} />
          </div>

          {/* Event Logs Feature */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-bolt-elements-textPrimary">Event Logs</span>
              <p className="text-sm text-bolt-elements-textSecondary">
                View detailed system event logs and diagnostics
              </p>
            </div>
            <Switch className="ml-auto" checked={eventLogs} onCheckedChange={enableEventLogs} />
          </div>

          {/* Updates Feature */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-bolt-elements-textPrimary">Updates</span>
              <p className="text-sm text-bolt-elements-textSecondary">
                Enable the updates tab to manage application updates
              </p>
            </div>
            <Switch className="ml-auto" checked={updatesEnabled} onCheckedChange={enableUpdates} />
          </div>

          {/* Update Branch Selection - only show if updates are enabled */}
          {updatesEnabled && (
            <div className="flex items-center justify-between pl-6 border-l-2 border-bolt-elements-borderColor">
              <div>
                <span className="text-bolt-elements-textPrimary">Use Main Branch</span>
                <p className="text-sm text-bolt-elements-textSecondary">
                  Check for updates against the main branch instead of stable
                </p>
              </div>
              <Switch className="ml-auto" checked={isLatestBranch} onCheckedChange={enableLatestBranch} />
            </div>
          )}
        </div>
      </div>

      <div className="mb-6 border-t border-bolt-elements-borderColor pt-4">
        <h3 className="text-lg font-medium text-bolt-elements-textPrimary mb-4">Experimental Features</h3>
        <p className="text-sm text-bolt-elements-textSecondary mb-4">
          Disclaimer: Experimental features may be unstable and are subject to change.
        </p>

        <div className="flex items-center justify-between mb-2">
          <span className="text-bolt-elements-textPrimary">Experimental Providers</span>
          <Switch className="ml-auto" checked={isLocalModel} onCheckedChange={enableLocalModels} />
        </div>
        <div className="flex items-start justify-between pt-4 mb-2 gap-2">
          <div className="flex-1 max-w-[200px]">
            <span className="text-bolt-elements-textPrimary">Prompt Library</span>
            <p className="text-sm text-bolt-elements-textSecondary mb-4">
              Choose a prompt from the library to use as the system prompt.
            </p>
          </div>
          <select
            value={promptId}
            onChange={(e) => setPromptId(e.target.value)}
            className="flex-1 p-2 ml-auto rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-prompt-background text-bolt-elements-textPrimary focus:outline-none focus:ring-2 focus:ring-bolt-elements-focus transition-all text-sm min-w-[100px]"
          >
            {PromptLibrary.getList().map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="text-bolt-elements-textPrimary">DEV MODE : Pull Requests</span>
            <p className="text-sm text-bolt-elements-textSecondary">View and manage pull requests</p>
          </div>
          <Switch className="ml-auto" checked={showPullRequests} onCheckedChange={setShowPullRequests} />
        </div>
        {showPullRequests && (
          <div className="mt-4 bg-bolt-elements-surface rounded-lg p-4">
            <p className="text-bolt-elements-textSecondary">Pull Request feature is coming soon.</p>
          </div>
        )}
      </div>
    </div>
  );
}
