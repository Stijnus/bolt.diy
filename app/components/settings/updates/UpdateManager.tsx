import React, { useCallback, useEffect, useState } from 'react';
import { useSettings } from '~/lib/hooks/useSettings';
import { toast } from 'react-toastify';
import { logStore } from '~/lib/stores/logs';

interface CommitInfo {
  sha: string;
  commit: {
    message: string;
  };
}

interface CommitResponse {
  sha: string;
}

interface PackageJson {
  version: string;
}

interface CommitData {
  commit: string;
  version?: string;
  changelog?: string[];
}

const GITHUB_URLS = {
  commitJson: async (branch: string): Promise<CommitData> => {
    try {
      const response = await fetch(`https://api.github.com/repos/stackblitz-labs/bolt.diy/commits/${branch}`);
      const data: CommitResponse = await response.json();

      const packageJsonResp = await fetch(
        `https://raw.githubusercontent.com/stackblitz-labs/bolt.diy/${branch}/package.json`,
      );
      const packageJson: PackageJson = await packageJsonResp.json();

      const changelogResp = await fetch(
        `https://api.github.com/repos/stackblitz-labs/bolt.diy/commits?sha=${branch}&per_page=10`,
      );
      const commits: CommitInfo[] = await changelogResp.json();
      const changelog = commits.map((commit) => commit.commit.message);

      return {
        commit: data.sha.slice(0, 7),
        version: packageJson.version,
        changelog,
      };
    } catch (error) {
      console.log('Failed to fetch commit info:', error);
      throw new Error('Failed to fetch commit info');
    }
  },
};

const versionData = {
  commit: __COMMIT_HASH,
  version: __APP_VERSION,
};

const categorizeChangelog = (messages: string[]) => {
  const categories = new Map<string, string[]>();

  messages.forEach((message) => {
    let category = 'Other';

    if (message.startsWith('feat:')) {
      category = 'Features';
    } else if (message.startsWith('fix:')) {
      category = 'Bug Fixes';
    } else if (message.startsWith('docs:')) {
      category = 'Documentation';
    } else if (message.startsWith('ci:')) {
      category = 'CI Improvements';
    } else if (message.startsWith('refactor:')) {
      category = 'Refactoring';
    } else if (message.startsWith('test:')) {
      category = 'Testing';
    } else if (message.startsWith('style:')) {
      category = 'Styling';
    } else if (message.startsWith('perf:')) {
      category = 'Performance';
    }

    if (!categories.has(category)) {
      categories.set(category, []);
    }

    categories.get(category)!.push(message);
  });

  // Sort categories in a specific order
  const order = [
    'Features',
    'Bug Fixes',
    'Documentation',
    'CI Improvements',
    'Refactoring',
    'Performance',
    'Testing',
    'Styling',
    'Other',
  ];

  return Array.from(categories.entries())
    .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
    .filter(([_, messages]) => messages.length > 0);
};

const parseCommitMessage = (message: string) => {
  const prMatch = message.match(/#(\d+)/);
  const prNumber = prMatch ? prMatch[1] : null;

  // Remove the type prefix (feat:, fix:, etc.)
  let cleanMessage = message.replace(/^[a-z]+:\s*/i, '');

  // Remove the PR number if it exists
  cleanMessage = cleanMessage.replace(/#\d+/g, '').trim();

  // Split into title and description if there's a newline or bullet point
  const parts = cleanMessage.split(/[\n\r]|\s+\*\s+/);
  const title = parts[0].trim();
  const description = parts
    .slice(1)
    .map((p) => p.trim())
    .filter((p) => p && !p.includes('Co-authored-by:'))
    .join('\n');

  return { title, description, prNumber };
};

export default function UpdateManager() {
  const { isLatestBranch, autoUpdateEnabled, setAutoUpdateEnabled } = useSettings();
  const [updateMessage, setUpdateMessage] = useState<string>('');
  const [changelog, setChangelog] = useState<string[]>([]);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [hasUserRespondedToUpdate, setHasUserRespondedToUpdate] = useState(false);
  const [updateFailed, setUpdateFailed] = useState(false);

  const executeUpdate = async () => {
    try {
      const response = await fetch('/api/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { error?: string };
        throw new Error(errorData.error || 'Update failed');
      }

      const data = (await response.json()) as Record<string, any>;
      logStore.logSystem('Update completed successfully. Please restart the application.', data);
      toast.success('Update completed! Please restart the application.');
      setUpdateFailed(false);
    } catch (error) {
      console.error('Update failed:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logStore.logSystem('Update failed: ' + errorMessage);
      toast.error('Update failed: ' + errorMessage);
      setUpdateFailed(true);
      throw error;
    }
  };

  const handleCheckForUpdate = useCallback(async () => {
    if (isCheckingUpdate || (updateFailed && autoUpdateEnabled)) {
      return;
    }

    try {
      setIsCheckingUpdate(true);
      logStore.logSystem('Checking for updates...');
      setUpdateMessage('Checking for updates...');

      const branchToCheck = isLatestBranch ? 'main' : 'stable';
      console.log(`[Debug] Checking for updates against ${branchToCheck} branch`);

      const latestCommitResp = await GITHUB_URLS.commitJson(branchToCheck);
      const remoteCommitHash = latestCommitResp.commit;
      const currentCommitHash = versionData.commit.slice(0, 7);

      if (remoteCommitHash !== currentCommitHash) {
        setChangelog(latestCommitResp.changelog || []);
        setUpdateMessage(
          `Update available from ${branchToCheck} branch!\n` +
            `Current: ${currentCommitHash}\n` +
            `Latest: ${remoteCommitHash}`,
        );
        setUpdateAvailable(true);
        logStore.logSystem(`Update available: ${currentCommitHash} → ${remoteCommitHash}`);

        if (autoUpdateEnabled && !hasUserRespondedToUpdate && !updateFailed) {
          const changelogText = latestCommitResp.changelog?.join('\n') || 'No changelog available';
          logStore.logSystem('Changelog:\n' + changelogText);

          const userWantsUpdate = confirm(
            `An update is available.\n\nChangelog:\n${changelogText}\n\nDo you want to update now?`,
          );
          setHasUserRespondedToUpdate(true);

          if (userWantsUpdate) {
            try {
              await executeUpdate();
            } catch (error) {
              console.error('Update failed:', error);
              toast.warn(
                'Automatic updates have been disabled due to an error. Please check the error and try updating manually.',
                { autoClose: 8000 },
              );
            }
          } else {
            logStore.logSystem('Update cancelled by user');
          }
        } else if (!hasUserRespondedToUpdate && !updateFailed) {
          toast.warn('Update available! Check updates tab for details.', { autoClose: 5000 });
          setHasUserRespondedToUpdate(true);
        }
      } else {
        setUpdateMessage(`You are on the latest version from the ${branchToCheck} branch`);
        setChangelog([]);
        setUpdateAvailable(false);
        logStore.logSystem(`System is up to date (${currentCommitHash})`);
      }
    } catch (error) {
      setUpdateMessage('Failed to check for updates');
      logStore.logSystem('Update check failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
      console.error('[Debug] Failed to check for updates:', error);
      setUpdateFailed(true);
    } finally {
      setIsCheckingUpdate(false);
    }
  }, [isCheckingUpdate, isLatestBranch, autoUpdateEnabled, hasUserRespondedToUpdate, updateFailed]);

  useEffect(() => {
    let updateInterval: NodeJS.Timeout | null = null;

    const checkUpdates = async () => {
      if (autoUpdateEnabled && !updateFailed) {
        setHasUserRespondedToUpdate(false);
        await handleCheckForUpdate();
      }
    };

    // Initial check
    checkUpdates();

    // Set up interval for auto-updates
    if (autoUpdateEnabled && !updateFailed) {
      updateInterval = setInterval(checkUpdates, 3600000); // Check every hour
    }

    return () => {
      if (updateInterval) {
        clearInterval(updateInterval);
      }
    };
  }, [autoUpdateEnabled, handleCheckForUpdate, updateFailed]);

  return (
    <div className="space-y-6">
      {/* Update Settings */}
      <div className="p-4 bg-bolt-elements-bg-depth-2 border border-bolt-elements-borderColor rounded-lg">
        <h3 className="text-lg font-medium text-bolt-elements-textPrimary mb-4">Update Settings</h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-bolt-elements-textPrimary">Update Mode</span>
              <p className="text-sm text-bolt-elements-textSecondary">
                Choose how you want to handle application updates
              </p>
            </div>
            <select
              value={autoUpdateEnabled ? 'automatic' : 'manual'}
              onChange={(e) => {
                setAutoUpdateEnabled(e.target.value === 'automatic');
                setHasUserRespondedToUpdate(false);
                setUpdateFailed(false); // Reset update failed state when changing mode
              }}
              className="p-2 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-bg-depth-3 text-bolt-elements-textPrimary"
            >
              <option value="automatic">Automatic</option>
              <option value="manual">Manual</option>
            </select>
          </div>
        </div>
      </div>

      {/* Version Information and Update Status */}
      <div className="p-4 bg-bolt-elements-bg-depth-2 border border-bolt-elements-borderColor rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-bolt-elements-textPrimary">Version Information</h3>
          <button
            onClick={() => {
              setHasUserRespondedToUpdate(false);
              setUpdateFailed(false); // Reset update failed state when manually checking
              handleCheckForUpdate();
            }}
            disabled={isCheckingUpdate}
            className="px-4 py-2 bg-bolt-elements-bg-depth-3 text-bolt-elements-textPrimary rounded hover:bg-bolt-elements-bg-depth-4 transition-colors disabled:opacity-50"
          >
            {isCheckingUpdate ? 'Checking...' : 'Check for Updates'}
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <span className="text-bolt-elements-textSecondary">Current Version:</span>
            <code className="px-2 py-1 bg-bolt-elements-bg-depth-3 rounded text-bolt-elements-textPrimary">
              {versionData.commit.slice(0, 7)} (v{versionData.version})
            </code>
            <span className="text-xs text-bolt-elements-textSecondary">({isLatestBranch ? 'nightly' : 'stable'})</span>
          </div>

          {updateFailed && autoUpdateEnabled && (
            <div className="p-3 rounded bg-red-500/10 text-red-600">
              <p>Automatic updates are paused due to an error. Please try updating manually.</p>
            </div>
          )}

          {updateMessage && (
            <div className={`p-3 rounded ${updateAvailable ? 'bg-yellow-500/10' : 'bg-bolt-elements-bg-depth-3'}`}>
              <p className="text-bolt-elements-textPrimary whitespace-pre-line">{updateMessage}</p>
              {updateAvailable && !autoUpdateEnabled && (
                <div className="mt-4 p-4 bg-bolt-elements-bg-depth-3 rounded">
                  <h4 className="font-medium mb-2">Manual Update Instructions:</h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm">
                    <li>Open a terminal in your project directory</li>
                    <li>
                      Run: <code className="bg-bolt-elements-bg-depth-4 px-2 py-1 rounded">git pull upstream main</code>
                    </li>
                    <li>
                      Install dependencies:{' '}
                      <code className="bg-bolt-elements-bg-depth-4 px-2 py-1 rounded">pnpm install</code>
                    </li>
                    <li>Restart the application</li>
                  </ol>
                </div>
              )}
            </div>
          )}

          {changelog.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-3">
                <h4 className="text-md font-medium text-bolt-elements-textPrimary">Changelog</h4>
                <span className="px-2 py-0.5 text-xs rounded-full bg-bolt-elements-bg-depth-3 text-bolt-elements-textSecondary">
                  {changelog.length} changes
                </span>
              </div>
              <div className="bg-bolt-elements-bg-depth-3 rounded-lg border border-bolt-elements-borderColor">
                <div className="max-h-[400px] overflow-y-auto">
                  {categorizeChangelog(changelog).map(([category, messages]) => (
                    <div key={category} className="border-b last:border-b-0 border-bolt-elements-borderColor">
                      <div className="p-3 bg-bolt-elements-bg-depth-4">
                        <h5 className="text-sm font-medium text-bolt-elements-textPrimary">
                          {category}
                          <span className="ml-2 text-xs text-bolt-elements-textSecondary">({messages.length})</span>
                        </h5>
                      </div>
                      <div className="divide-y divide-bolt-elements-borderColor">
                        {messages.map((message, index) => {
                          const { title, description, prNumber } = parseCommitMessage(message);
                          return (
                            <div key={index} className="p-3 hover:bg-bolt-elements-bg-depth-4 transition-colors">
                              <div className="flex items-start gap-3">
                                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-bolt-elements-textSecondary" />
                                <div className="space-y-1 flex-1">
                                  <p className="text-sm font-medium text-bolt-elements-textPrimary">
                                    {title}
                                    {prNumber && (
                                      <span className="ml-2 text-xs text-bolt-elements-textSecondary">#{prNumber}</span>
                                    )}
                                  </p>
                                  {description && (
                                    <p className="text-xs text-bolt-elements-textSecondary">{description}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
