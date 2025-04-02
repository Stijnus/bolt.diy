import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useSettings } from '~/lib/hooks/useSettings';
import { logStore } from '~/lib/stores/logs';
import { toast } from 'react-toastify';
import { Dialog, DialogDescription, DialogRoot, DialogTitle } from '~/components/ui/Dialog';
import { Button } from '~/components/ui/Button';
import { classNames } from '~/utils/classNames';
import { getEnvironmentInfo } from '~/lib/environment';
import { GitDiagnosticHelper } from './GitDiagnosticHelper';
import { UpdateProgressDisplay as SharedUpdateProgressDisplay } from '~/components/shared/UpdateProgressDisplay';
import type { UpdateStage } from '~/lib/hooks/useUpdateManager';

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

const UpdateTab = () => {
  const { isLatestBranch } = useSettings();
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGitMissing, setIsGitMissing] = useState(false);
  const [isGitChecked, setIsGitChecked] = useState(false);
  const environmentInfo = getEnvironmentInfo();

  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [updateProgress, setUpdateProgress] = useState<UpdateProgress | null>(null);
  const [currentBranch, setCurrentBranch] = useState<string>('main');
  const isPRBranch = currentBranch !== 'main' && currentBranch !== 'stable';

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

        const branchResponse = await fetch('/api/update?action=getBranch');

        if (!branchResponse.ok) {
          throw new Error('Branch check failed');
        }

        const branchData = await branchResponse.json();
        const branch = branchData as { branch?: string };

        if (branch.branch) {
          setCurrentBranch(branch.branch);
        }
      } catch (error) {
        console.error('Initialization error:', error);
      }
    };

    checkGitAndBranch();
  }, [environmentInfo.isCloud]);

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
        throw new Error(`Update check failed: ${response.statusText}`);
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
                    setShowUpdateDialog(true);
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
    setShowUpdateDialog(false);
    setIsChecking(true);
    setError(null);

    try {
      const branchToCheck = isLatestBranch ? 'main' : 'stable';
      const action = isPRBranch ? 'sync' : 'update';

      const response = await fetch('/api/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          branch: branchToCheck,
          currentBranch,
          action,
          autoUpdate: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`${isPRBranch ? 'Sync' : 'Update'} failed: ${response.statusText}`);
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
          const progress = parseProgressUpdate(line);

          if (progress) {
            setUpdateProgress(progress);

            if (progress.error) {
              setError(progress.error);
              toast.error(`${isPRBranch ? 'Sync' : 'Update'} failed: ${progress.error}`);
              logStore.logWarning(isPRBranch ? 'Sync Failed' : 'Update Failed', {
                type: 'update',
                message: progress.error,
              });
            }

            if (progress.stage === 'complete' && !progress.error) {
              toast.success(`${isPRBranch ? 'Sync' : 'Update'} completed successfully`);
              logStore.logInfo(isPRBranch ? 'Sync Completed' : 'Update Completed', {
                type: 'update',
                message: `${isPRBranch ? 'Sync' : 'Update'} completed successfully`,
              });
            }
          }
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(errorMessage);
      toast.error(`${isPRBranch ? 'Sync' : 'Update'} failed: ${errorMessage}`);
      logStore.logWarning(isPRBranch ? 'Sync Failed' : 'Update Failed', {
        type: 'update',
        message: errorMessage,
      });
    } finally {
      setIsChecking(false);
    }
  }, [isLatestBranch, currentBranch, isPRBranch]);

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
                <button
                  onClick={handleUpdate}
                  className={classNames(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm',
                    'bg-purple-500 text-white',
                    'hover:bg-purple-600',
                    'transition-colors duration-200',
                  )}
                >
                  <div className="i-ph:arrow-circle-up w-4 h-4" />
                  Update Now
                </button>
              )}
            </div>

            <div>
              {updateProgress ? (
                <>
                  <SharedUpdateProgressDisplay
                    updateState={{
                      updateAvailable: Boolean(updateProgress?.details?.updateReady) && !isPRBranch,
                      updateInProgress: !['complete', 'error'].includes(updateProgress.stage) || isChecking,
                      updateProgress: updateProgress.progress || 0,
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

                  {error && <div className="mt-4 p-4 bg-red-100 text-red-700 rounded">{error}</div>}
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
                      <button
                        onClick={checkForUpdates}
                        disabled={isChecking}
                        className={classNames(
                          'flex items-center justify-center gap-2 px-6 py-2 rounded-lg text-sm w-full sm:w-auto',
                          'bg-purple-500 text-white',
                          'hover:bg-purple-600',
                          'transition-colors duration-200',
                          'disabled:opacity-50 disabled:cursor-not-allowed',
                        )}
                      >
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
                      </button>

                      {isPRBranch && !details?.hasUncommittedChanges && (
                        <button
                          onClick={handleUpdate}
                          disabled={isChecking}
                          className={classNames(
                            'flex items-center justify-center gap-2 px-6 py-2 rounded-lg text-sm w-full sm:w-auto',
                            'bg-green-500 text-white',
                            'hover:bg-green-600',
                            'transition-colors duration-200',
                            'disabled:opacity-50 disabled:cursor-not-allowed',
                          )}
                        >
                          <div className="i-ph:arrows-clockwise w-4 h-4" />
                          Sync with Upstream
                        </button>
                      )}
                    </div>

                    <div className="mt-6 pt-4 border-t border-[#E5E5E5] dark:border-[#1A1A1A]">
                      <GitDiagnosticHelper />
                    </div>
                  </div>

                  {error && <div className="mt-4 p-4 bg-red-100 text-red-700 rounded">{error}</div>}
                </>
              )}
            </div>
          </motion.div>
        </>
      )}

      {/* Update dialog - only for non-PR branches */}
      {!isPRBranch && (
        <DialogRoot open={showUpdateDialog && !environmentInfo.isCloud} onOpenChange={setShowUpdateDialog}>
          <Dialog>
            <DialogTitle>Update Available</DialogTitle>
            <DialogDescription>
              <div className="mt-4">
                <p className="text-sm text-bolt-elements-textSecondary mb-4">
                  A new version is available from <span className="font-mono">stackblitz-labs/bolt.diy</span> (
                  {isLatestBranch ? 'main' : 'stable'} branch)
                </p>

                {details && details.compareUrl && (
                  <div className="mb-6">
                    <a
                      href={details.compareUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={classNames(
                        'flex items-center gap-2 px-4 py-2 rounded-lg text-sm',
                        'bg-[#F5F5F5] dark:bg-[#1A1A1A]',
                        'hover:bg-purple-500/10 hover:text-purple-500',
                        'dark:hover:bg-purple-500/20 dark:hover:text-purple-500',
                        'text-bolt-elements-textPrimary',
                        'transition-colors duration-200',
                        'w-fit',
                      )}
                    >
                      <div className="i-ph:github-logo w-4 h-4" />
                      View Changes on GitHub
                    </a>
                  </div>
                )}

                {details && details.commitMessages && details.commitMessages.length > 0 && (
                  <div className="mb-6">
                    <p className="font-medium mb-2">Commit Messages:</p>
                    <div className="bg-[#F5F5F5] dark:bg-[#1A1A1A] rounded-lg p-3 max-h-[200px] overflow-y-auto space-y-2">
                      {details.commitMessages.map((msg: string, index: number) => (
                        <div key={index} className="text-sm text-bolt-elements-textSecondary flex items-start gap-2">
                          <div className="i-ph:git-commit text-purple-500 w-4 h-4 mt-0.5 flex-shrink-0" />
                          <span>{msg}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {details && details.changedFiles && details.changedFiles.length > 0 && (
                  <div className="mb-6">
                    <p className="font-medium mb-2">Changed Files:</p>
                    <div className="bg-[#F5F5F5] dark:bg-[#1A1A1A] rounded-lg p-3 max-h-[200px] overflow-y-auto space-y-2">
                      {details.changedFiles.map((file: string, index: number) => {
                        const fileStr = String(file);
                        const isAdded = fileStr.startsWith('Added:');
                        const isModified = fileStr.startsWith('Modified:');
                        const isRemoved = fileStr.startsWith('Deleted:');
                        const filename = fileStr.split(': ')[1] || fileStr;

                        return (
                          <div key={index} className="text-sm text-bolt-elements-textSecondary flex items-start gap-2">
                            <div
                              className={classNames(
                                'w-4 h-4 mt-0.5 flex-shrink-0',
                                isAdded ? 'i-ph:plus-circle text-green-500' : '',
                                isModified ? 'i-ph:pencil-simple text-blue-500' : '',
                                isRemoved ? 'i-ph:minus-circle text-red-500' : '',
                                !isAdded && !isModified && !isRemoved ? 'i-ph:file text-gray-500' : '',
                              )}
                            />
                            <span className="font-mono">{filename}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </DialogDescription>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="secondary" onClick={() => setShowUpdateDialog(false)}>
                Cancel
              </Button>
              <Button variant="default" onClick={handleUpdate}>
                Update Now
              </Button>
            </div>
          </Dialog>
        </DialogRoot>
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
    </div>
  );
};

export default UpdateTab;
