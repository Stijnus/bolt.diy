import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSettings } from '~/lib/hooks/useSettings';
import { logStore } from '~/lib/stores/logs';
import { toast } from 'react-toastify';
import { Dialog, DialogRoot, DialogTitle, DialogDescription, DialogButton } from '~/components/ui/Dialog';
import { classNames } from '~/utils/classNames';
import { Markdown } from '~/components/chat/Markdown';
import { getEnvironmentInfo } from '~/lib/environment';
import { GitDiagnosticHelper } from './GitDiagnosticHelper';

interface UpdateProgress {
  stage: 'fetch' | 'pull' | 'install' | 'build' | 'complete';
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
  };
}

interface UpdateSettings {
  autoUpdate: boolean;
  notifyInApp: boolean;
  checkInterval: number;
}

const ProgressBar = ({ progress }: { progress: number }) => (
  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
    <motion.div
      className="h-full bg-blue-500"
      initial={{ width: 0 }}
      animate={{ width: `${progress}%` }}
      transition={{ duration: 0.3 }}
    />
  </div>
);

const UpdateProgressDisplay = ({ progress }: { progress: UpdateProgress }) => (
  <div className="mt-4 space-y-2">
    <div className="flex justify-between items-center">
      <span className="text-sm font-medium">{progress.message}</span>
      <span className="text-sm text-gray-500">{progress.progress}%</span>
    </div>
    <ProgressBar progress={progress.progress || 0} />
    {progress.details && (
      <div className="mt-2 text-sm text-gray-600">
        {progress.details.changedFiles && progress.details.changedFiles.length > 0 && (
          <div className="mt-4">
            <div className="font-medium mb-2">Changed Files:</div>
            <div className="space-y-2">
              {/* Group files by type */}
              {['Modified', 'Added', 'Deleted'].map((type) => {
                const filesOfType = progress.details?.changedFiles?.filter((file) => file.startsWith(type)) || [];

                if (filesOfType.length === 0) {
                  return null;
                }

                return (
                  <div key={type} className="space-y-1">
                    <div
                      className={classNames('text-sm font-medium', {
                        'text-blue-500': type === 'Modified',
                        'text-green-500': type === 'Added',
                        'text-red-500': type === 'Deleted',
                      })}
                    >
                      {type} ({filesOfType.length})
                    </div>
                    <div className="pl-4 space-y-1">
                      {filesOfType.map((file, index) => {
                        const fileName = file.split(': ')[1];
                        return (
                          <div key={index} className="text-sm text-bolt-elements-textSecondary flex items-center gap-2">
                            <div
                              className={classNames('w-4 h-4', {
                                'i-ph:pencil-simple': type === 'Modified',
                                'i-ph:plus': type === 'Added',
                                'i-ph:trash': type === 'Deleted',
                                'text-blue-500': type === 'Modified',
                                'text-green-500': type === 'Added',
                                'text-red-500': type === 'Deleted',
                              })}
                            />
                            <span className="font-mono text-xs">{fileName}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {progress.details.totalSize && <div className="mt-1">Total size: {progress.details.totalSize}</div>}
        {progress.details.additions !== undefined && progress.details.deletions !== undefined && (
          <div className="mt-1">
            Changes: <span className="text-green-600">+{progress.details.additions}</span>{' '}
            <span className="text-red-600">-{progress.details.deletions}</span>
          </div>
        )}
        {progress.details.currentCommit && progress.details.remoteCommit && (
          <div className="mt-1">
            Updating from {progress.details.currentCommit} to {progress.details.remoteCommit}
          </div>
        )}
      </div>
    )}
  </div>
);

const UpdateTab = () => {
  const { isLatestBranch } = useSettings();
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGitMissing, setIsGitMissing] = useState(false);
  const [isGitChecked, setIsGitChecked] = useState(false);
  const environmentInfo = getEnvironmentInfo();
  const [updateSettings, setUpdateSettings] = useState<UpdateSettings>(() => {
    const stored = localStorage.getItem('update_settings');
    return stored
      ? JSON.parse(stored)
      : {
          autoUpdate: false,
          notifyInApp: true,
          checkInterval: 24,
        };
  });
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [updateProgress, setUpdateProgress] = useState<UpdateProgress | null>(null);
  const [showDiagnosticHelper, setShowDiagnosticHelper] = useState(false);

  useEffect(() => {
    localStorage.setItem('update_settings', JSON.stringify(updateSettings));
  }, [updateSettings]);

  // Check Git availability on component mount
  useEffect(() => {
    // Don't check in cloud environments
    if (environmentInfo.isCloud) {
      return;
    }

    const checkGitAvailability = async () => {
      try {
        const response = await fetch('/api/git-check');

        if (!response.ok) {
          throw new Error('Failed to check Git availability');
        }

        const data = await response.json();

        // Validate the response format
        if (
          typeof data === 'object' &&
          data !== null &&
          'isAvailable' in data &&
          typeof data.isAvailable === 'boolean'
        ) {
          setIsGitMissing(!data.isAvailable);
          setIsGitChecked(true);
        } else {
          console.error('Invalid response format from Git check endpoint');
        }
      } catch (error) {
        console.error('Error checking Git availability:', error);

        // We don't set isGitMissing here as we're not sure
      }
    };

    checkGitAvailability();
  }, [environmentInfo.isCloud]);

  const checkForUpdates = async () => {
    // If we've already checked and Git is missing, don't try to check for updates
    if (isGitChecked && isGitMissing) {
      return;
    }

    console.log('Starting update check...');
    setIsChecking(true);
    setError(null);
    setUpdateProgress(null);

    try {
      const branchToCheck = isLatestBranch ? 'main' : 'stable';

      // Start the update check with streaming progress
      const response = await fetch('/api/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          branch: branchToCheck,
          autoUpdate: updateSettings.autoUpdate,
        }),
      });

      if (!response.ok) {
        throw new Error(`Update check failed: ${response.statusText}`);
      }

      const reader = response.body?.getReader();

      if (!reader) {
        throw new Error('No response stream available');
      }

      // Read the stream
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        // Convert the chunk to text and parse the JSON
        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n').filter(Boolean);

        for (const line of lines) {
          try {
            const progress = JSON.parse(line) as UpdateProgress;
            setUpdateProgress(progress);

            if (progress.error) {
              setError(progress.error);

              // Check if this is a Git not found error
              if (progress.error.includes('Git command not found') || progress.error.includes('Git is not available')) {
                setIsGitMissing(true);
              }
            }

            // If we're done, update the UI accordingly
            if (progress.stage === 'complete') {
              setIsChecking(false);

              if (!progress.error) {
                // Update check completed
                toast.success('Update check completed');

                // Show update dialog only if there are changes and auto-update is disabled
                if (progress.details?.changedFiles?.length && progress.details.updateReady) {
                  setShowUpdateDialog(true);
                }
              }
            }
          } catch (e) {
            console.error('Error parsing progress update:', e);
          }
        }
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
      logStore.logWarning('Update Check Failed', {
        type: 'update',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setIsChecking(false);
    }
  };

  const handleUpdate = async () => {
    setShowUpdateDialog(false);

    try {
      const branchToCheck = isLatestBranch ? 'main' : 'stable';

      // Start the update with autoUpdate set to true to force the update
      const response = await fetch('/api/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          branch: branchToCheck,
          autoUpdate: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Update failed: ${response.statusText}`);
      }

      // Handle the update progress stream
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
            const progress = JSON.parse(line) as UpdateProgress;
            setUpdateProgress(progress);

            if (progress.error) {
              setError(progress.error);
              toast.error('Update failed');
            }

            if (progress.stage === 'complete' && !progress.error) {
              toast.success('Update completed successfully');
            }
          } catch (e) {
            console.error('Error parsing update progress:', e);
          }
        }
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
      toast.error('Update failed');
    }
  };

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

      {/* Environment notice for cloud deployments */}
      {environmentInfo.isCloud && (
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
            <p className="mt-2">Manual updates are not available in this environment.</p>
          </div>
        </motion.div>
      )}

      {/* Update Settings Card - only show for local environments */}
      {!environmentInfo.isCloud && (
        <motion.div
          className="p-6 rounded-xl bg-white dark:bg-[#0A0A0A] border border-[#E5E5E5] dark:border-[#1A1A1A]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="i-ph:gear text-purple-500 w-5 h-5" />
            <h3 className="text-lg font-medium text-bolt-elements-textPrimary">Update Settings</h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-bolt-elements-textPrimary">Automatic Updates</span>
                <p className="text-xs text-bolt-elements-textSecondary">
                  Automatically check and apply updates when available
                </p>
              </div>
              <button
                onClick={() => setUpdateSettings((prev) => ({ ...prev, autoUpdate: !prev.autoUpdate }))}
                className={classNames(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  updateSettings.autoUpdate ? 'bg-purple-500' : 'bg-gray-200 dark:bg-gray-700',
                )}
              >
                <span
                  className={classNames(
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    updateSettings.autoUpdate ? 'translate-x-6' : 'translate-x-1',
                  )}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-bolt-elements-textPrimary">In-App Notifications</span>
                <p className="text-xs text-bolt-elements-textSecondary">
                  Show notifications when updates are available
                </p>
              </div>
              <button
                onClick={() => setUpdateSettings((prev) => ({ ...prev, notifyInApp: !prev.notifyInApp }))}
                className={classNames(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  updateSettings.notifyInApp ? 'bg-purple-500' : 'bg-gray-200 dark:bg-gray-700',
                )}
              >
                <span
                  className={classNames(
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    updateSettings.notifyInApp ? 'translate-x-6' : 'translate-x-1',
                  )}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-bolt-elements-textPrimary">Check Interval</span>
                <p className="text-xs text-bolt-elements-textSecondary">How often to check for updates</p>
              </div>
              <select
                value={updateSettings.checkInterval}
                onChange={(e) => setUpdateSettings((prev) => ({ ...prev, checkInterval: Number(e.target.value) }))}
                className={classNames(
                  'px-3 py-2 rounded-lg text-sm',
                  'bg-[#F5F5F5] dark:bg-[#1A1A1A]',
                  'border border-[#E5E5E5] dark:border-[#1A1A1A]',
                  'text-bolt-elements-textPrimary',
                  'hover:bg-[#E5E5E5] dark:hover:bg-[#2A2A2A]',
                  'transition-colors duration-200',
                )}
              >
                <option value="6">6 hours</option>
                <option value="12">12 hours</option>
                <option value="24">24 hours</option>
                <option value="48">48 hours</option>
              </select>
            </div>
          </div>
        </motion.div>
      )}

      {/* Git Diagnostic Helper - show when Git is missing or manually triggered */}
      {!environmentInfo.isCloud && (isGitMissing || showDiagnosticHelper) && isGitChecked && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <GitDiagnosticHelper />
        </motion.div>
      )}

      {/* Update Status Card - modified for cloud environments */}
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
              {environmentInfo.isCloud ? 'Version Information' : 'Update Status'}
            </h3>
          </div>

          {/* Only show update buttons for local environments */}
          {!environmentInfo.isCloud && (
            <div className="flex items-center gap-2">
              {updateProgress?.details?.updateReady && !updateSettings.autoUpdate && (
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
              <button
                onClick={() => {
                  setError(null);
                  checkForUpdates();
                }}
                className={classNames(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm',
                  'bg-[#F5F5F5] dark:bg-[#1A1A1A]',
                  'hover:bg-purple-500/10 hover:text-purple-500',
                  'dark:hover:bg-purple-500/20 dark:hover:text-purple-500',
                  'text-bolt-elements-textPrimary',
                  'transition-colors duration-200',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
                disabled={isChecking || environmentInfo.isCloud || isGitMissing}
              >
                {isChecking ? (
                  <div className="flex items-center gap-2">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="i-ph:arrows-clockwise w-4 h-4"
                    />
                    Checking...
                  </div>
                ) : (
                  <>
                    <div className="i-ph:arrows-clockwise w-4 h-4" />
                    Check for Updates
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Show appropriate content based on environment */}
        {environmentInfo.isCloud ? (
          <div className="text-sm text-bolt-elements-textSecondary">
            <p>
              Updates for {environmentInfo.platform} deployments are managed automatically through the CI/CD pipeline.
            </p>
            <p className="mt-2">
              When new code is pushed to the repository, a new deployment will be triggered automatically.
            </p>
            <div className="mt-4 p-4 bg-gray-100 dark:bg-[#1A1A1A] rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="i-ph:info text-purple-500 w-4 h-4" />
                <span className="font-medium">Manual Update Instructions</span>
              </div>
              <p className="mb-2">If you need to update this environment manually, follow these steps:</p>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Push changes to the connected repository</li>
                <li>Trigger a new deployment from your {environmentInfo.platform} dashboard</li>
                <li>Wait for the deployment to complete</li>
              </ol>
            </div>
          </div>
        ) : (
          <>
            {/* Existing update progress and details display */}
            {updateProgress && <UpdateProgressDisplay progress={updateProgress} />}

            {error && <div className="mt-4 p-4 bg-red-100 text-red-700 rounded">{error}</div>}

            {/* Show update source information */}
            {updateProgress?.details?.currentCommit && updateProgress?.details?.remoteCommit && (
              <div className="mt-4 text-sm text-bolt-elements-textSecondary">
                <div className="flex items-center justify-between">
                  <div>
                    <p>
                      Updates are fetched from: <span className="font-mono">stackblitz-labs/bolt.diy</span> (
                      {isLatestBranch ? 'main' : 'stable'} branch)
                    </p>
                    <p className="mt-1">
                      Current version: <span className="font-mono">{updateProgress.details.currentCommit}</span>
                      <span className="mx-2">→</span>
                      Latest version: <span className="font-mono">{updateProgress.details.remoteCommit}</span>
                    </p>
                  </div>
                  {updateProgress?.details?.compareUrl && (
                    <a
                      href={updateProgress.details.compareUrl}
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
                  )}
                </div>
                {updateProgress?.details?.additions !== undefined &&
                  updateProgress?.details?.deletions !== undefined && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="i-ph:git-diff text-purple-500 w-4 h-4" />
                      Changes: <span className="text-green-600">+{updateProgress.details.additions}</span>{' '}
                      <span className="text-red-600">-{updateProgress.details.deletions}</span>
                    </div>
                  )}
              </div>
            )}

            {/* Changelog */}
            {updateProgress?.details?.changelog && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <div className="i-ph:scroll text-purple-500 w-5 h-5" />
                  <p className="font-medium">Changelog</p>
                </div>
                <div className="bg-[#F5F5F5] dark:bg-[#1A1A1A] rounded-lg p-4 overflow-auto max-h-[300px]">
                  <div className="prose dark:prose-invert prose-sm max-w-none">
                    <Markdown>{updateProgress.details.changelog}</Markdown>
                  </div>
                </div>
              </div>
            )}

            {/* Commit messages */}
            {updateProgress?.details?.commitMessages && updateProgress.details.commitMessages.length > 0 && (
              <div className="mt-4 mb-6">
                <p className="font-medium mb-2">Changes in this Update:</p>
                <div className="bg-[#F5F5F5] dark:bg-[#1A1A1A] rounded-lg p-4 overflow-auto max-h-[400px]">
                  <div className="prose dark:prose-invert prose-sm max-w-none">
                    {updateProgress.details.commitMessages.map((section, index) => (
                      <Markdown key={index}>{section}</Markdown>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </motion.div>

      {/* Update dialog - only for local environments */}
      <DialogRoot open={showUpdateDialog && !environmentInfo.isCloud} onOpenChange={setShowUpdateDialog}>
        <Dialog>
          <DialogTitle>Update Available</DialogTitle>
          <DialogDescription>
            <div className="mt-4">
              <p className="text-sm text-bolt-elements-textSecondary mb-4">
                A new version is available from <span className="font-mono">stackblitz-labs/bolt.diy</span> (
                {isLatestBranch ? 'main' : 'stable'} branch)
              </p>

              {updateProgress?.details?.compareUrl && (
                <div className="mb-6">
                  <a
                    href={updateProgress.details.compareUrl}
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

              {updateProgress?.details?.commitMessages && updateProgress.details.commitMessages.length > 0 && (
                <div className="mb-6">
                  <p className="font-medium mb-2">Commit Messages:</p>
                  <div className="bg-[#F5F5F5] dark:bg-[#1A1A1A] rounded-lg p-3 space-y-2">
                    {updateProgress.details.commitMessages.map((msg, index) => (
                      <div key={index} className="text-sm text-bolt-elements-textSecondary flex items-start gap-2">
                        <div className="i-ph:git-commit text-purple-500 w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>{msg}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {updateProgress?.details?.totalSize && (
                <div className="flex items-center gap-4 text-sm text-bolt-elements-textSecondary">
                  <div className="flex items-center gap-2">
                    <div className="i-ph:file text-purple-500 w-4 h-4" />
                    Total size: {updateProgress.details.totalSize}
                  </div>
                  {updateProgress?.details?.additions !== undefined &&
                    updateProgress?.details?.deletions !== undefined && (
                      <div className="flex items-center gap-2">
                        <div className="i-ph:git-diff text-purple-500 w-4 h-4" />
                        Changes: <span className="text-green-600">+{updateProgress.details.additions}</span>{' '}
                        <span className="text-red-600">-{updateProgress.details.deletions}</span>
                      </div>
                    )}
                </div>
              )}
            </div>
          </DialogDescription>
          <div className="flex justify-end gap-2 mt-6">
            <DialogButton type="secondary" onClick={() => setShowUpdateDialog(false)}>
              Cancel
            </DialogButton>
            <DialogButton type="primary" onClick={handleUpdate}>
              Update Now
            </DialogButton>
          </div>
        </Dialog>
      </DialogRoot>

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
                <button
                  onClick={() => setShowDiagnosticHelper(true)}
                  className="px-3 py-1.5 text-xs rounded-lg bg-red-100 dark:bg-red-800/30 text-red-800 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-800/50 transition-colors"
                >
                  Run Git Diagnostics
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UpdateTab;
