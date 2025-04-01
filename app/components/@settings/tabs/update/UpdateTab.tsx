import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useSettings } from '~/lib/hooks/useSettings';
import { logStore } from '~/lib/stores/logs';
import { toast } from 'react-toastify';
import { Dialog, DialogDescription, DialogRoot, DialogTitle } from '~/components/ui/Dialog';
import { Button } from '~/components/ui/Button';
import { classNames } from '~/utils/classNames';
import { Markdown } from '~/components/chat/Markdown';
import { getEnvironmentInfo } from '~/lib/environment';
import { GitDiagnosticHelper } from './GitDiagnosticHelper';
import { UpdateProgressDisplay as SharedUpdateProgressDisplay } from '~/components/shared/UpdateProgressDisplay';

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

// Type guard to check if an object is of type UpdateProgress
function isUpdateProgress(obj: any): obj is UpdateProgress {
  return obj && typeof obj === 'object' && 'stage' in obj && 'message' in obj;
}

// Helper function to safely access details from UpdateProgress
function getUpdateDetails(progress: UpdateProgress | null): UpdateProgress['details'] | undefined {
  if (!progress || !isUpdateProgress(progress)) {
    return undefined;
  }

  return progress.details;
}

// Helper function to parse progress update from JSON string
function parseProgressUpdate(progressStr: string): UpdateProgress | null {
  try {
    // Split the string into individual JSON objects
    const jsonObjects = progressStr.split(/}\s*{/).map((str) => str.trim());

    // Process each JSON object
    for (const json of jsonObjects) {
      if (!json) {
        continue;
      }

      // Add back the curly braces if they were removed by split
      const completeJson = json.startsWith('{') ? json : `{${json}}`;

      try {
        const parsed = JSON.parse(completeJson);

        if (isUpdateProgress(parsed)) {
          return parsed;
        }
      } catch {
        // Skip invalid JSON objects
        continue;
      }
    }

    return null;
  } catch (error) {
    console.error('Failed to parse update progress:', error);
    console.error('Invalid JSON string:', progressStr);

    return null;
  }
}

const getUpdateStage = (stage: UpdateProgress['stage']) => {
  switch (stage) {
    case 'fetch':
      return 'checking';
    case 'pull':
      return 'downloading';
    case 'install':
    case 'build':
      return 'installing';
    case 'complete':
      return 'restarting';
    default:
      return 'idle';
  }
};

const UpdateTab = () => {
  const { isLatestBranch } = useSettings();
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGitMissing, setIsGitMissing] = useState(false);
  const [isGitChecked, setIsGitChecked] = useState(false);
  const environmentInfo = getEnvironmentInfo();

  useEffect(() => {
    console.log('Environment Info:', environmentInfo);
  }, [environmentInfo]);

  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [updateProgress, setUpdateProgress] = useState<UpdateProgress | null>(null);

  useEffect(() => {
    localStorage.removeItem('update_settings');
  }, []);

  // Check Git availability on component mount
  useEffect(() => {
    // Don't check in cloud environments
    if (environmentInfo.isCloud) {
      return;
    }

    const checkGitAvailability = async () => {
      try {
        // Use the more reliable Git diagnostic API instead of git-check
        const response = await fetch('/api/git-diagnostic');

        if (!response.ok) {
          throw new Error(`Failed to check Git availability: ${response.statusText}`);
        }

        const data = await response.json();

        // Validate the response format
        if (typeof data === 'object' && data !== null && 'gitInstalled' in data && data.gitInstalled !== undefined) {
          setIsGitMissing(!data.gitInstalled);
          setIsGitChecked(true);
        } else {
          console.error('Invalid response format from Git diagnostic endpoint');
          logStore.logWarning('Git Diagnostic Error', {
            type: 'git',
            message: 'Invalid response format from Git diagnostic endpoint',
          });
        }
      } catch (error) {
        console.error('Error checking Git availability:', error);
        logStore.logWarning('Git Diagnostic Error', {
          type: 'git',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
        });
      }
    };

    checkGitAvailability();
  }, [environmentInfo.isCloud]);

  const checkForUpdates = useCallback(async () => {
    // If we've already checked and Git is missing, don't try to check for updates
    if (isGitChecked && isGitMissing) {
      toast.error('Git is not available. Please install Git to enable updates.');
      return;
    }

    console.log('Starting update check...');
    setIsChecking(true);
    setError(null);
    setUpdateProgress({
      stage: 'fetch',
      message: 'Checking for updates...',
      progress: 0,
      details: {},
    });

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
            const progress = parseProgressUpdate(line);

            if (progress) {
              setUpdateProgress(progress);

              if (progress.error) {
                setError(progress.error);

                // Check if this is a Git not found error
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

              // If we're done, update the UI accordingly
              if (progress.stage === 'complete') {
                setIsChecking(false);

                if (!progress.error) {
                  // Update check completed
                  toast.success('Update check completed');

                  // Show update dialog only if there are changes and auto-update is disabled
                  if (progress.details?.changedFiles?.length && progress.details?.updateReady) {
                    setShowUpdateDialog(true);
                  }
                }
              }
            }
          } catch (error) {
            console.error('Error processing update progress:', error);

            // Continue processing other lines even if one fails
          }
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(errorMessage);
      logStore.logWarning('Update Check Failed', {
        type: 'update',
        message: errorMessage,
      });
      toast.error(`Update check failed: ${errorMessage}`);
    } finally {
      setIsChecking(false);
    }
  }, [isGitChecked, isGitMissing, isLatestBranch]);

  const handleUpdate = useCallback(async () => {
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
          const progress = parseProgressUpdate(line);

          if (progress) {
            setUpdateProgress(progress);

            if (progress.error) {
              setError(progress.error);
              toast.error(`Update failed: ${progress.error}`);
              logStore.logWarning('Update Failed', {
                type: 'update',
                message: progress.error,
              });
            }

            if (progress.stage === 'complete' && !progress.error) {
              toast.success('Update completed successfully');
              logStore.logInfo('Update Completed', {
                type: 'update',
                message: 'Update completed successfully',
              });
            }
          }
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(errorMessage);
      toast.error(`Update failed: ${errorMessage}`);
      logStore.logWarning('Update Failed', {
        type: 'update',
        message: errorMessage,
      });
    }
  }, [isLatestBranch]);

  // Helper function to get the appropriate status message based on update stage
  const getStatusMessage = useCallback((progress: UpdateProgress | null) => {
    if (!progress || !progress.stage) {
      return 'Checking for updates...';
    }

    switch (progress.stage) {
      case 'fetch':
        return 'Checking repository...';
      case 'pull':
        return 'Downloading updates...';
      case 'install':
        return 'Installing dependencies...';
      case 'build':
        return 'Building application...';
      default:
        return 'Checking for updates...';
    }
  }, []);

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

      {/* Environment notice for cloud deployments */}
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
            {environmentInfo.platform === 'Cloudflare' && (
              <div className="mt-4 p-4 bg-gray-100 dark:bg-[#1A1A1A] rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div className="i-ph:info text-purple-500 w-4 h-4" />
                  <span className="font-medium">Cloudflare Environment</span>
                </div>
                <p className="mb-2">
                  This application is running in a Cloudflare Workers environment, which has some limitations compared
                  to Node.js:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Git operations are not available</li>
                  <li>File system access is restricted</li>
                  <li>Updates are managed through Cloudflare deployments</li>
                </ul>
              </div>
            )}
          </div>
        </motion.div>
      ) : (
        <motion.div
          className="p-6 rounded-xl bg-white dark:bg-[#0A0A0A] border border-[#E5E5E5] dark:border-[#1A1A1A]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="i-ph:arrows-clockwise text-purple-500 w-5 h-5" />
              <h3 className="text-lg font-medium text-bolt-elements-textPrimary">Update Status</h3>
            </div>

            {/* Only show update buttons for local environments */}
            {!environmentInfo.isCloud && updateProgress?.details?.updateReady && (
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

          {/* Existing update progress and details display */}
          <div>
            {updateProgress ? (
              <>
                {/* Use the shared UpdateProgressDisplay component */}
                <SharedUpdateProgressDisplay
                  updateState={{
                    updateAvailable: Boolean(updateProgress?.details?.updateReady),
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
                {/* Custom idle state UI with enhanced visual design */}
                <div className="p-6 bg-white dark:bg-[#0A0A0A] border border-[#E5E5E5] dark:border-[#1A1A1A] rounded-lg">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="i-ph:info text-purple-500 w-5 h-5" />
                    <h3 className="text-base font-medium text-bolt-elements-textPrimary">Update Information</h3>
                  </div>

                  {/* Repository information */}
                  <div className="mb-4 p-4 bg-[#F5F5F5] dark:bg-[#1A1A1A] rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="i-ph:git-branch text-purple-500 w-4 h-4" />
                      <p className="font-medium">Repository Status</p>
                    </div>
                    <div className="space-y-2 text-sm text-bolt-elements-textSecondary">
                      <div className="flex items-center gap-2">
                        <div className="i-ph:git-fork text-blue-500 w-4 h-4" />
                        <span>
                          Repository: <span className="font-mono">stackblitz-labs/bolt.diy</span> (
                          {isLatestBranch ? 'main' : 'stable'} branch)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="i-ph:git-branch text-green-500 w-4 h-4" />
                        <span>
                          Current branch: <span className="font-medium">{isLatestBranch ? 'main' : 'stable'}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="i-ph:git-commit text-amber-500 w-4 h-4" />
                        <span>Updates are fetched from the {isLatestBranch ? 'main' : 'stable'} branch</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-sm text-bolt-elements-textSecondary">
                    <p>Your application is ready to check for updates.</p>
                    <p className="mt-1">Click the button below to check if a new version is available.</p>
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
                              {updateProgress ? getStatusMessage(updateProgress) : 'Checking for updates...'}
                            </span>
                          </span>
                        </>
                      ) : (
                        <>
                          <div className="i-ph:arrows-clockwise w-4 h-4" />
                          Check for Updates
                        </>
                      )}
                    </button>
                  </div>

                  {/* Add Git diagnostic helper when available */}
                  <div className="mt-6 pt-4 border-t border-[#E5E5E5] dark:border-[#1A1A1A]">
                    <GitDiagnosticHelper />
                  </div>
                </div>

                {error && <div className="mt-4 p-4 bg-red-100 text-red-700 rounded">{error}</div>}

                {/* Version information section */}
                {details && details.currentCommit && details.remoteCommit && (
                  <div className="mt-4 text-sm text-bolt-elements-textSecondary">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div>
                        <p>
                          Updates are fetched from: <span className="font-mono">stackblitz-labs/bolt.diy</span> (
                          {isLatestBranch ? 'main' : 'stable'} branch)
                        </p>
                        <p className="mt-1">
                          Current version: <span className="font-mono">{details.currentCommit.substring(0, 7)}</span>
                          <span className="mx-2">→</span>
                          Latest version: <span className="font-mono">{details.remoteCommit.substring(0, 7)}</span>
                        </p>
                      </div>
                      {details.compareUrl && (
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
                          <div className="i-ph:git-diff w-4 h-4" />
                          View Changes
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Changed files section */}
                {details && details.changedFiles && details.changedFiles.length > 0 && (
                  <div className="mt-6">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="i-ph:file-code text-purple-500 w-5 h-5" />
                      <p className="font-medium">Changed Files ({details.changedFiles.length})</p>
                    </div>
                    <div className="bg-[#F5F5F5] dark:bg-[#1A1A1A] rounded-lg p-4 overflow-auto max-h-[300px]">
                      <div className="space-y-2">
                        {details.changedFiles.map((file: string, index: number) => {
                          // Parse the file string to extract status and filename
                          const fileStr = String(file);
                          const isAdded = fileStr.startsWith('Added:');
                          const isModified = fileStr.startsWith('Modified:');
                          const isRemoved = fileStr.startsWith('Deleted:');
                          const filename = fileStr.split(': ')[1] || fileStr;

                          return (
                            <div
                              key={index}
                              className="flex items-center gap-2 text-sm text-bolt-elements-textSecondary"
                            >
                              <div
                                className={classNames(
                                  'w-4 h-4',
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
                  </div>
                )}

                {/* Total size section */}
                {details && details.totalSize && (
                  <div className="mt-3 text-sm text-bolt-elements-textSecondary flex items-center gap-2">
                    <div className="i-ph:hard-drives text-purple-500 w-4 h-4" />
                    Total size: {details.totalSize}
                  </div>
                )}

                {/* Changelog section */}
                {details && details.changelog && (
                  <div className="mb-6 mt-6">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="i-ph:scroll text-purple-500 w-5 h-5" />
                      <p className="font-medium">Changelog</p>
                    </div>
                    <div className="bg-[#F5F5F5] dark:bg-[#1A1A1A] rounded-lg p-4 overflow-auto max-h-[300px]">
                      <div className="prose dark:prose-invert prose-sm max-w-none">
                        <Markdown>{details.changelog}</Markdown>
                      </div>
                    </div>
                  </div>
                )}

                {/* Commit messages section */}
                {details && details.commitMessages && details.commitMessages.length > 0 && (
                  <div className="mt-4 mb-6">
                    <p className="font-medium mb-2">Changes in this Update:</p>
                    <div className="space-y-2">
                      {details.commitMessages.map((commit: string, index: number) => (
                        <div
                          key={index}
                          className="bg-[#F5F5F5] dark:bg-[#1A1A1A] p-3 rounded-lg text-sm text-bolt-elements-textSecondary"
                        >
                          {commit}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>
      )}

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

              {/* GitHub link section */}
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

              {/* Commit messages section */}
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

              {/* Changed files section */}
              {details && details.changedFiles && details.changedFiles.length > 0 && (
                <div className="mb-6">
                  <p className="font-medium mb-2">Changed Files:</p>
                  <div className="bg-[#F5F5F5] dark:bg-[#1A1A1A] rounded-lg p-3 max-h-[200px] overflow-y-auto space-y-2">
                    {details.changedFiles.map((file: string, index: number) => {
                      // Parse the file string to extract status and filename
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

              {/* Total size section */}
              {details && details.totalSize && (
                <div className="mb-6 flex items-center gap-2 text-sm text-bolt-elements-textSecondary">
                  <div className="i-ph:file-code text-purple-500 w-4 h-4" />
                  Files changed: {details.changedFiles?.length || 0}
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
