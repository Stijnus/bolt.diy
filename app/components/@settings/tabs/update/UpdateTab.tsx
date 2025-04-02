import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useSettings } from '~/lib/hooks/useSettings';
import { logStore } from '~/lib/stores/logs';
import { toast } from 'react-toastify';
import { classNames } from '~/utils/classNames';
import { getEnvironmentInfo } from '~/lib/environment';
import { GitDiagnosticHelper } from './GitDiagnosticHelper';
import { UpdateProgressDisplay as SharedUpdateProgressDisplay } from '~/components/shared/UpdateProgressDisplay';
import type { UpdateStage } from '~/lib/hooks/useUpdateManager';
import { getEstimatedProgress, getTroubleshootingSteps } from '~/utils/update';
import { Button } from '~/components/ui/Button';

interface UpdateProgress {
  stage:
    | 'fetch'
    | 'pull'
    | 'install'
    | 'build'
    | 'complete'
    | 'sync'
    | 'checking'
    | 'downloading'
    | 'installing'
    | 'building'
    | 'restarting'
    | 'syncing'
    | 'idle';
  message: string;
  progress?: number;
  error?: string;
  details?: {
    changedFiles?: string[];
    additions?: number;
    deletions?: number;
    commitMessages?: string[];
    totalSize?: string;
    currentCommit?: string;
    remoteCommit?: string;
    updateReady?: boolean;
    changelog?: string;
    compareUrl?: string;
    currentBranch?: string;
    isPRBranch?: boolean;
    hasUncommittedChanges?: boolean;
  };
}

interface UpdateResponse {
  message?: string;
}

function isUpdateProgress(obj: any): obj is UpdateProgress {
  return obj && typeof obj === 'object' && 'stage' in obj && 'message' in obj;
}

function getUpdateDetails(progress: UpdateProgress | null): UpdateProgress['details'] | undefined {
  if (!progress || !isUpdateProgress(progress)) {
    return undefined;
  }

  return progress.details;
}

function parseProgressUpdate(progressStr: string): UpdateProgress | null {
  try {
    const jsonObjects = progressStr.split(/}\s*{/).map((str) => str.trim());
    const progress = JSON.parse(jsonObjects[0] + (jsonObjects.length > 1 ? '{' + jsonObjects[1] : ''));

    if (isUpdateProgress(progress)) {
      return progress;
    }
  } catch (error) {
    console.error('Error parsing progress update:', error);
  }

  return null;
}

function getUpdateStage(stage: UpdateProgress['stage']): UpdateStage {
  switch (stage) {
    case 'fetch':
    case 'checking':
    case 'pull':
    case 'downloading':
    case 'install':
    case 'installing':
    case 'build':
    case 'building':
    case 'complete':
    case 'restarting':
    case 'sync':
    case 'syncing':
      return getUpdateStageHelper(stage);
    case 'idle':
      return 'idle';
    default:
      return 'idle';
  }
}

function getUpdateStageHelper(stage: UpdateProgress['stage']): UpdateStage {
  switch (stage) {
    case 'fetch':
    case 'checking':
      return 'checking';
    case 'pull':
    case 'downloading':
      return 'downloading';
    case 'install':
    case 'installing':
      return 'installing';
    case 'build':
    case 'building':
      return 'building';
    case 'complete':
    case 'restarting':
      return 'restarting';
    case 'sync':
    case 'syncing':
      return 'syncing';
    default:
      return 'idle';
  }
}

function ErrorDisplay({ error }: { error: string }) {
  const troubleshootingSteps = getTroubleshootingSteps(error);

  return (
    <div className="space-y-2">
      <p className="text-red-500">{error}</p>
      <div className="text-sm text-gray-500">
        <h4 className="font-medium">Troubleshooting Steps:</h4>
        <ul className="list-disc pl-4">
          {troubleshootingSteps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function useProgressEstimation() {
  const [estimatedProgress, setEstimatedProgress] = useState(0);

  const updateProgressEstimation = useCallback((stage: UpdateProgress['stage']) => {
    setEstimatedProgress(getEstimatedProgress(stage));
  }, []);

  return { estimatedProgress, updateProgressEstimation };
}

const UpdateTab = () => {
  const { isLatestBranch } = useSettings();
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGitMissing, setIsGitMissing] = useState(false);
  const [isGitChecked, setIsGitChecked] = useState(false);
  const environmentInfo = getEnvironmentInfo();

  const [updateProgress, setUpdateProgress] = useState<UpdateProgress | null>(null);
  const [currentBranch, setCurrentBranch] = useState<string>('main');
  const isPRBranch = currentBranch !== 'main' && currentBranch !== 'stable';

  const { estimatedProgress, updateProgressEstimation } = useProgressEstimation();

  useEffect(() => {
    localStorage.removeItem('update_settings');
  }, []);

  useEffect(() => {
    if (environmentInfo.isCloud) {
      return;
    }

    const checkGitAndBranch = async () => {
      try {
        const gitResponse = await fetch('/api/git-diagnostic');

        if (!gitResponse.ok) {
          throw new Error('Git check failed');
        }

        const gitData = await gitResponse.json();

        if (gitData && typeof gitData === 'object' && 'gitInstalled' in gitData) {
          setIsGitMissing(!gitData.gitInstalled);
          setIsGitChecked(true);
        }

        const branch = await getCurrentBranch();
        setCurrentBranch(branch);
      } catch (error) {
        console.error('Initialization error:', error);
      }
    };

    checkGitAndBranch();
  }, [environmentInfo.isCloud]);

  const runGitCommand = async (command: string): Promise<string> => {
    try {
      const { exec } = await import('child_process');
      return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
          if (error) {
            reject(new Error(`Git command failed: ${stderr}`));
            return;
          }

          resolve(stdout.trim());
        });
      });
    } catch (error) {
      console.error('Error running Git command:', error);
      throw error;
    }
  };

  const getCurrentBranch = async (): Promise<string> => {
    try {
      const branch = await runGitCommand('git rev-parse --abbrev-ref HEAD');
      return branch;
    } catch (error) {
      console.error('Error getting current branch:', error);
      throw new Error('Failed to determine current branch');
    }
  };

  const checkForUpdates = useCallback(async () => {
    if (isGitChecked && isGitMissing) {
      toast.error('Git is not available. Please install Git to enable updates.');
      return;
    }

    console.log('Starting update check...');
    setIsChecking(true);
    setError(null);
    setUpdateProgress({
      stage: 'fetch',
      message: isPRBranch ? 'Checking branch status...' : 'Checking for updates...',
      progress: 0,
      details: {},
    });

    try {
      const branchToCheck = isLatestBranch ? 'main' : 'stable';
      const action = isPRBranch ? 'syncCheck' : 'updateCheck';

      const response = await fetch('/api/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          branch: branchToCheck,
          currentBranch,
          action,
          autoUpdate: false,
        }),
      });

      if (!response.ok) {
        try {
          const errorData = (await response.json()) as UpdateResponse;
          throw new Error(errorData.message || 'Update failed');
        } catch {
          throw new Error('Update failed: ' + response.statusText);
        }
      }

      const reader = response.body?.getReader();

      if (!reader) {
        throw new Error('No response stream available');
      }

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n').filter(Boolean);

        for (const line of lines) {
          try {
            const progress = parseProgressUpdate(line);

            if (progress) {
              setUpdateProgress(progress);

              if (progress.error) {
                setError(progress.error);

                if (
                  progress.error.includes('Git command not found') ||
                  progress.error.includes('Git is not available')
                ) {
                  setIsGitMissing(true);
                  logStore.logWarning('Git Not Found', {
                    type: 'git',
                    message: progress.error,
                  });
                }
              }

              if (progress.stage === 'complete') {
                setIsChecking(false);

                if (!progress.error) {
                  toast.success(isPRBranch ? 'Sync check completed' : 'Update check completed');

                  if (progress.details?.updateReady && !isPRBranch) {
                    // setShowUpdateDialog(true);
                  }
                }
              }
            }
          } catch (error) {
            console.error('Error processing update progress:', error);
          }
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(errorMessage);
      logStore.logWarning(isPRBranch ? 'Sync Check Failed' : 'Update Check Failed', {
        type: 'update',
        message: errorMessage,
      });
      toast.error(`${isPRBranch ? 'Sync' : 'Update'} check failed: ${errorMessage}`);
    } finally {
      setIsChecking(false);
    }
  }, [isGitChecked, isGitMissing, isLatestBranch, currentBranch, isPRBranch]);

  const handleUpdate = useCallback(async () => {
    setIsChecking(true);
    setError(null);

    try {
      const response = await fetch('/api/update?action=update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          branch: currentBranch,
          force: true,
          testMode: true,
        }),
      });

      if (!response.ok) {
        try {
          const errorData = (await response.json()) as UpdateResponse;
          throw new Error(errorData.message || 'Update failed');
        } catch {
          throw new Error('Update failed: ' + response.statusText);
        }
      }

      const reader = response.body?.getReader();

      if (!reader) {
        throw new Error('Failed to read update stream');
      }

      const decoder = new TextDecoder();
      let progressStr = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        progressStr += decoder.decode(value);

        try {
          const progress = parseProgressUpdate(progressStr);

          if (progress) {
            setUpdateProgress(progress);
            updateProgressEstimation(progress.stage);

            if (progress.stage === 'complete' && !progress.error) {
              toast.success('Update completed successfully');
            } else if (progress.error) {
              toast.error(`Update failed: ${progress.error}`);
            }
          }
        } catch (parseError) {
          console.error('Error parsing progress:', parseError);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Update failed';
      setError(errorMessage);
      toast.error(`Update failed: ${errorMessage}`);
      console.error('Update error:', error);
    } finally {
      setIsChecking(false);
    }
  }, [currentBranch, updateProgressEstimation]);

  const getStatusMessage = useCallback(
    (progress: UpdateProgress | null) => {
      if (!progress || !progress.stage) {
        return isPRBranch ? 'Checking branch status...' : 'Checking for updates...';
      }

      switch (progress.stage) {
        case 'fetch':
        case 'checking':
          return isPRBranch ? 'Checking branch status...' : 'Checking repository...';
        case 'pull':
        case 'downloading':
          return 'Downloading updates...';
        case 'install':
        case 'installing':
          return 'Installing dependencies...';
        case 'build':
        case 'building':
          return 'Building application...';
        case 'sync':
        case 'syncing':
          return 'Syncing branch...';
        case 'restarting':
          return 'Restarting application...';
        case 'idle':
          return 'Idle...';
        default:
          return isPRBranch ? 'Checking branch status...' : 'Checking for updates...';
      }
    },
    [isPRBranch],
  );

  const details = getUpdateDetails(updateProgress);

  useEffect(() => {
    if (updateProgress) {
      updateProgressEstimation(updateProgress.stage);
    }
  }, [updateProgress, updateProgressEstimation]);

  const UpdateDetails = ({ details }: { details: UpdateProgress['details'] }) => (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {details?.changedFiles && (
          <div>
            <h4 className="font-medium flex items-center gap-2 mb-2">
              <div className="i-ph:file-text text-blue-500 w-5 h-5" />
              Changed Files ({details.changedFiles.length})
            </h4>
            <div className="max-h-[200px] overflow-y-auto">
              <ul className="space-y-1 text-sm">
                {details.changedFiles.map((file, i) => {
                  const fileStr = String(file);
                  const isAdded = fileStr.startsWith('Added:');
                  const isModified = fileStr.startsWith('Modified:');
                  const isRemoved = fileStr.startsWith('Deleted:');
                  const filename = fileStr.split(': ')[1] || fileStr;

                  return (
                    <li key={i} className="flex items-center gap-2">
                      <div
                        className={classNames(
                          'w-4 h-4',
                          isAdded ? 'i-ph:plus-circle text-green-500' : '',
                          isModified ? 'i-ph:pencil-simple text-blue-500' : '',
                          isRemoved ? 'i-ph:minus-circle text-red-500' : '',
                          !isAdded && !isModified && !isRemoved ? 'i-ph:file text-gray-500' : '',
                        )}
                      />
                      <span className="font-mono break-all">{filename}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}

        {details?.commitMessages && (
          <div>
            <h4 className="font-medium flex items-center gap-2 mb-2">
              <div className="i-ph:git-commit text-purple-500 w-5 h-5" />
              Commit Messages ({details.commitMessages.length})
            </h4>
            <div className="max-h-[200px] overflow-y-auto">
              <ul className="space-y-2 text-sm">
                {details.commitMessages.map((msg, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <div className="i-ph:git-commit text-purple-500 w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{msg}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {details?.compareUrl && (
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <a
            href={details.compareUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium 
              bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 
              text-blue-600 dark:text-blue-400 transition-colors"
          >
            <div className="i-ph:github-logo w-4 h-4" />
            View Changes on GitHub
          </a>
        </div>
      )}
    </motion.div>
  );

  const resetUpdateState = useCallback(() => {
    setIsChecking(false);
    setUpdateProgress(null);
    setError(null);
  }, []);

  const handleCancelUpdate = useCallback(() => {
    resetUpdateState();
    toast.info('Update check completed');
  }, [resetUpdateState]);

  // Enhanced branch info display
  const branchInfo = (
    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg mb-6">
      <div className="flex items-center gap-2">
        <div className="i-ph:git-branch w-5 h-5 text-gray-500 dark:text-gray-400" />
        <div className="text-sm">
          Current Branch: <span className="font-medium text-gray-900 dark:text-gray-100">{currentBranch}</span>
        </div>
        {isPRBranch && (
          <span className="ml-2 px-2 py-1 text-xs font-medium bg-yellow-100 dark:bg-yellow-800/20 text-yellow-800 dark:text-yellow-200 rounded-full">
            PR Branch
          </span>
        )}
      </div>
      {isPRBranch && (
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Updates are disabled on PR branches. Switch to main or stable branch to update.
        </p>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <motion.div
        className="flex items-center gap-3"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="i-ph:arrow-circle-up text-xl text-purple-500" />
        <div>
          <h3 className="text-lg font-medium text-bolt-elements-textPrimary">Updates</h3>
          <p className="text-sm text-bolt-elements-textSecondary">Check for and manage application updates</p>
        </div>
      </motion.div>

      {environmentInfo.isCloud ? (
        <motion.div
          className="p-6 rounded-xl bg-white dark:bg-[#0A0A0A] border border-[#E5E5E5] dark:border-[#1A1A1A]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="i-ph:cloud text-purple-500 w-5 h-5" />
            <h3 className="text-lg font-medium text-bolt-elements-textPrimary">Cloud Deployment</h3>
          </div>
          <div className="text-sm text-bolt-elements-textSecondary">
            <p>
              This instance is running on {environmentInfo.platform}, where updates are managed through automatic
              deployments.
            </p>
            <p className="mt-1">Manual updates are not available in this environment.</p>
          </div>
        </motion.div>
      ) : (
        <>
          {isPRBranch && (
            <motion.div
              className="p-4 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/40"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <div className="flex items-start gap-3">
                <div className="i-ph:git-pull-request text-yellow-500 w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-lg font-medium text-yellow-800 dark:text-yellow-200">Pull Request Branch</h3>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    You're currently on branch <span className="font-mono">{currentBranch}</span>. Full updates are only
                    available on main/stable branches.
                  </p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-2">
                    You can sync with the upstream branch to get the latest changes.
                  </p>
                  {details?.hasUncommittedChanges && (
                    <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                      <div className="i-ph:warning w-4 h-4 inline-block mr-1" />
                      You have uncommitted changes. Please commit or stash them before syncing.
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          <motion.div
            className="p-6 rounded-xl bg-white dark:bg-[#0A0A0A] border border-[#E5E5E5] dark:border-[#1A1A1A]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="i-ph:arrows-clockwise text-purple-500 w-5 h-5" />
                <h3 className="text-lg font-medium text-bolt-elements-textPrimary">
                  {isPRBranch ? 'Branch Sync Status' : 'Update Status'}
                </h3>
              </div>

              {!environmentInfo.isCloud && !isPRBranch && updateProgress?.details?.updateReady && (
                <Button variant="default" onClick={handleUpdate} disabled={isChecking}>
                  <div className="i-ph:arrow-circle-up w-4 h-4" />
                  Update Now
                </Button>
              )}
            </div>

            <div>
              {updateProgress ? (
                <>
                  <SharedUpdateProgressDisplay
                    updateState={{
                      updateAvailable: Boolean(updateProgress?.details?.updateReady) && !isPRBranch,
                      updateInProgress: !['complete', 'error'].includes(updateProgress.stage) || isChecking,
                      updateProgress: estimatedProgress,
                      updateStage: getUpdateStage(updateProgress.stage),
                      updateError: updateProgress.error || null,
                      currentVersion: updateProgress?.details?.currentCommit?.substring(0, 7) || '',
                      latestVersion: updateProgress?.details?.remoteCommit?.substring(0, 7) || '',
                      lastAcknowledgedVersion: '',
                    }}
                    onRetry={() => {
                      setError(null);
                      checkForUpdates();
                    }}
                    onCancel={() => {
                      if (updateProgress.stage !== 'complete') {
                        setUpdateProgress(null);
                      }
                    }}
                    showDetails={true}
                  />

                  {error && <ErrorDisplay error={error} />}
                  {updateProgress && ['complete', 'error'].includes(updateProgress.stage) && (
                    <UpdateDetails details={updateProgress.details} />
                  )}
                  {updateProgress && ['complete', 'error'].includes(updateProgress.stage) && (
                    <div className="mt-4 flex gap-2">
                      <Button
                        variant="secondary"
                        onClick={handleCancelUpdate}
                        disabled={isChecking}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-[var(--bolt-elements-button-secondary-background)] text-[var(--bolt-elements-button-secondary-text)] hover:bg-[var(--bolt-elements-button-secondary-backgroundHover)]"
                      >
                        <div className="i-ph:arrow-clockwise w-4 h-4" />
                        Check Again
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={resetUpdateState}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-[var(--bolt-elements-button-secondary-background)] text-[var(--bolt-elements-button-secondary-text)] hover:bg-[var(--bolt-elements-button-secondary-backgroundHover)]"
                      >
                        <div className="i-ph:arrow-left w-4 h-4" />
                        Go Back
                      </Button>
                      {!isPRBranch && updateProgress.details?.updateReady && (
                        <Button
                          variant="default"
                          onClick={handleUpdate}
                          disabled={isChecking}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-[var(--bolt-elements-button-primary-background)] text-[var(--bolt-elements-button-primary-text)] hover:bg-[var(--bolt-elements-button-primary-backgroundHover)]"
                        >
                          <div className="i-ph:arrow-down w-4 h-4" />
                          Update Now
                        </Button>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="p-6 bg-white dark:bg-[#0A0A0A] border border-[#E5E5E5] dark:border-[#1A1A1A] rounded-lg">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="i-ph:info text-purple-500 w-5 h-5" />
                      <h3 className="text-base font-medium text-bolt-elements-textPrimary">
                        {isPRBranch ? 'Branch Information' : 'Update Information'}
                      </h3>
                    </div>

                    <div className="mb-4 p-4 bg-[#F5F5F5] dark:bg-[#1A1A1A] rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="i-ph:git-branch text-purple-500 w-4 h-4" />
                        <p className="font-medium">Repository Status</p>
                      </div>
                      <div className="space-y-2 text-sm text-bolt-elements-textSecondary">
                        <div className="flex items-center gap-2">
                          <div className="i-ph:git-fork text-blue-500 w-4 h-4" />
                          <span>
                            Repository: <span className="font-mono">stackblitz-labs/bolt.diy</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="i-ph:git-branch text-green-500 w-4 h-4" />
                          <span>
                            Current branch: <span className="font-mono">{currentBranch}</span>
                          </span>
                        </div>
                        {!isPRBranch && (
                          <div className="flex items-center gap-2">
                            <div className="i-ph:git-commit text-amber-500 w-4 h-4" />
                            <span>Updates are fetched from the {isLatestBranch ? 'main' : 'stable'} branch</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-sm text-bolt-elements-textSecondary">
                      <p>
                        {isPRBranch
                          ? 'You can check if your branch can be synced with the upstream.'
                          : 'Your application is ready to check for updates.'}
                      </p>
                    </div>

                    <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-4">
                      <Button onClick={checkForUpdates} disabled={isChecking} variant="default">
                        {isChecking ? (
                          <>
                            <div className="i-ph:circle-notch animate-spin w-4 h-4" />
                            <span className="relative">
                              <span className="opacity-0">Checking for Updates</span>
                              <span className="absolute left-0 top-0 w-full text-center">
                                {updateProgress
                                  ? getStatusMessage(updateProgress)
                                  : isPRBranch
                                    ? 'Checking branch status...'
                                    : 'Checking for updates...'}
                              </span>
                            </span>
                          </>
                        ) : (
                          <>
                            <div className="i-ph:arrows-clockwise w-4 h-4" />
                            {isPRBranch ? 'Check Sync Status' : 'Check for Updates'}
                          </>
                        )}
                      </Button>

                      {isPRBranch && !details?.hasUncommittedChanges && (
                        <Button onClick={handleUpdate} disabled={isChecking} variant="default">
                          <div className="i-ph:arrows-clockwise w-4 h-4" />
                          Sync with Upstream
                        </Button>
                      )}
                    </div>

                    <div className="mt-6 pt-4 border-t border-[#E5E5E5] dark:border-[#1A1A1A]">
                      <GitDiagnosticHelper />
                    </div>
                  </div>

                  {error && <ErrorDisplay error={error} />}
                </>
              )}
            </div>
          </motion.div>
        </>
      )}

      {/* Git missing notification */}
      {isGitMissing && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-900/40">
          <div className="flex items-start gap-3">
            <div className="i-ph:warning text-red-500 w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-red-800 dark:text-red-200">Git Not Available</h4>
              <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                Git is required for updates but was not found on your system. Please install Git to enable update
                functionality.
              </p>
              <div className="mt-3 flex gap-2">
                <a
                  href="https://git-scm.com/downloads"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 text-xs rounded-lg bg-purple-100 dark:bg-purple-800/30 text-purple-800 dark:text-purple-200 hover:bg-purple-200 dark:hover:bg-purple-800/50 transition-colors"
                >
                  Download Git
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
      {branchInfo}
    </div>
  );
};

export default UpdateTab;
