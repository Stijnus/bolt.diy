import { json, type ActionFunction, type LoaderFunction } from '@remix-run/cloudflare';
import { isCloudEnvironment } from '~/lib/environment';
import { execCommand } from '~/lib/serverUtils';

type ExecSyncFunction = (
  command: string,
  options?: {
    encoding?: string;
    timeout?: number;
    cwd?: string;
  },
) => string;

let execSync: ExecSyncFunction | null = null;

if (!isCloudEnvironment()) {
  try {
    const childProcess = await import('child_process');
    execSync = childProcess.execSync as ExecSyncFunction;
  } catch (error) {
    console.error('Error importing child_process:', error);
  }
}

interface UpdateRequestBody {
  branch?: string;
  currentBranch?: string;
  action?: 'updateCheck' | 'update' | 'syncCheck' | 'sync';
}

interface ExecCommandResult {
  stdout: string;
  stderr: string;
  error?: string;
}

async function detectGitPath(): Promise<string> {
  try {
    if (execSync) {
      try {
        const path = execSync('which git', { encoding: 'utf8' }).trim();
        return path || 'git';
      } catch {
        return 'git';
      }
    } else {
      const result = await execCommand('which git');
      return result.stdout.trim() || 'git';
    }
  } catch {
    return 'git';
  }
}

async function executeGitCommand(command: string): Promise<ExecCommandResult> {
  const gitPath = await detectGitPath();
  console.log(`Executing Git command: ${gitPath} ${command}`);

  if (execSync) {
    try {
      const stdout = execSync(`${gitPath} ${command}`, { encoding: 'utf8' });
      return { stdout, stderr: '' };
    } catch (error: any) {
      return {
        stdout: '',
        stderr: error.stderr?.toString() || error.message || 'Unknown error',
      };
    }
  } else {
    try {
      return await execCommand(`${gitPath} ${command}`);
    } catch (error: any) {
      return {
        stdout: '',
        stderr: error.stderr || error.message || 'Unknown error',
      };
    }
  }
}

async function executePnpmCommand(command: string): Promise<ExecCommandResult> {
  if (execSync) {
    try {
      const stdout = execSync(command, { encoding: 'utf8' });
      return { stdout, stderr: '' };
    } catch (error: any) {
      return {
        stdout: '',
        stderr: error.stderr?.toString() || error.message || 'Unknown error',
      };
    }
  } else {
    try {
      return await execCommand(command);
    } catch (error: any) {
      return {
        stdout: '',
        stderr: error.stderr || error.message || 'Unknown error',
      };
    }
  }
}

export const loader: LoaderFunction = () => {
  return json({ error: 'Method not allowed' }, { status: 405 });
};

export const action: ActionFunction = async ({ request }) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const body = (await request.json()) as UpdateRequestBody;
    const { branch = 'main', currentBranch = 'main', action: requestBodyAction = 'updateCheck' } = body;

    const isPRBranch = currentBranch !== 'main' && currentBranch !== 'stable';

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const versionResult = await executeGitCommand('--version');

          if (!versionResult.stdout.includes('git version')) {
            controller.enqueue(
              encoder.encode(
                JSON.stringify({
                  stage: 'complete',
                  error: 'Git is not available. Please install Git to enable updates.',
                  progress: 100,
                }) + '\n',
              ),
            );
            controller.close();

            return;
          }

          const repoCheckResult = await executeGitCommand('rev-parse --is-inside-work-tree');

          if (!repoCheckResult.stdout.includes('true')) {
            controller.enqueue(
              encoder.encode(
                JSON.stringify({
                  stage: 'complete',
                  error: 'Not in a Git repository. Please initialize Git first.',
                  progress: 100,
                }) + '\n',
              ),
            );
            controller.close();

            return;
          }

          const remotesResult = await executeGitCommand('remote');

          if (!remotesResult.stdout.trim()) {
            controller.enqueue(
              encoder.encode(
                JSON.stringify({
                  stage: 'complete',
                  error: 'No remote repository configured. Please add a remote repository.',
                  progress: 100,
                }) + '\n',
              ),
            );
            controller.close();

            return;
          }

          if (isPRBranch && (requestBodyAction === 'sync' || requestBodyAction === 'syncCheck')) {
            const statusResult = await executeGitCommand('status --porcelain');
            const hasUncommittedChanges = statusResult.stdout.trim() !== '';

            controller.enqueue(
              encoder.encode(
                JSON.stringify({
                  stage: 'fetch',
                  message: 'Checking branch status...',
                  progress: 20,
                  details: {
                    currentBranch,
                    isPRBranch: true,
                    hasUncommittedChanges,
                  },
                }) + '\n',
              ),
            );

            if (hasUncommittedChanges && requestBodyAction === 'sync') {
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    stage: 'complete',
                    error: 'You have uncommitted changes. Please commit or stash them before syncing.',
                    progress: 100,
                  }) + '\n',
                ),
              );
              controller.close();

              return;
            }
          }

          if (isPRBranch) {
            controller.enqueue(
              encoder.encode(
                JSON.stringify({
                  stage: 'fetch',
                  message: 'Checking upstream status...',
                  progress: 30,
                }) + '\n',
              ),
            );

            const currentCommitResult = await executeGitCommand('rev-parse HEAD');
            const currentCommit = currentCommitResult.stdout.trim();

            const remoteCommitResult = await executeGitCommand(`rev-parse origin/${currentBranch}`);
            const remoteCommit = remoteCommitResult.stdout.trim();

            if (!remoteCommit) {
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    stage: 'complete',
                    error: `Could not find branch origin/${currentBranch}`,
                    progress: 100,
                  }) + '\n',
                ),
              );
              controller.close();

              return;
            }

            const diffResult = await executeGitCommand(`diff --name-status HEAD..origin/${currentBranch}`);
            const changedFiles = diffResult.stdout
              .trim()
              .split('\n')
              .filter(Boolean)
              .map((line) => {
                const [status, file] = line.split('\t');
                const statusMap: Record<string, string> = {
                  M: 'Modified: ',
                  A: 'Added: ',
                  D: 'Deleted: ',
                };

                return (statusMap[status] || 'Changed: ') + (file || 'unknown');
              });

            const updateReady = changedFiles.length > 0;

            if (requestBodyAction === 'syncCheck') {
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    stage: 'complete',
                    message: 'Sync check complete',
                    progress: 100,
                    details: {
                      currentBranch,
                      isPRBranch: true,
                      changedFiles,
                      currentCommit,
                      remoteCommit,
                      updateReady,
                      compareUrl: `https://github.com/stackblitz-labs/bolt.diy/compare/${currentCommit}...${remoteCommit}`,
                    },
                  }) + '\n',
                ),
              );
              controller.close();

              return;
            }

            if (requestBodyAction === 'sync' && updateReady) {
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    stage: 'sync',
                    message: 'Syncing with upstream...',
                    progress: 50,
                  }) + '\n',
                ),
              );

              const resetResult = await executeGitCommand(`reset --hard origin/${currentBranch}`);

              if (resetResult.stderr) {
                throw new Error(resetResult.stderr);
              }

              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    stage: 'sync',
                    message: 'Branch synced successfully',
                    progress: 80,
                  }) + '\n',
                ),
              );

              const installResult = await executePnpmCommand('pnpm install');

              if (installResult.stderr) {
                console.warn('Dependency installation warnings:', installResult.stderr);
              }

              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    stage: 'complete',
                    message: 'Branch sync completed',
                    progress: 100,
                    details: {
                      currentBranch,
                      isPRBranch: true,
                    },
                  }) + '\n',
                ),
              );
            } else {
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    stage: 'complete',
                    message: 'Branch is already up to date',
                    progress: 100,
                    details: {
                      currentBranch,
                      isPRBranch: true,
                    },
                  }) + '\n',
                ),
              );
            }
          } else {
            controller.enqueue(
              encoder.encode(
                JSON.stringify({
                  stage: 'fetch',
                  message: 'Checking for updates...',
                  progress: 20,
                }) + '\n',
              ),
            );

            const fetchResult = await executeGitCommand(`fetch origin ${branch}`);

            if (fetchResult.stderr) {
              throw new Error(fetchResult.stderr);
            }

            controller.enqueue(
              encoder.encode(
                JSON.stringify({
                  stage: 'fetch',
                  message: 'Checking for changes...',
                  progress: 40,
                }) + '\n',
              ),
            );

            const currentCommitResult = await executeGitCommand('rev-parse HEAD');
            const currentCommit = currentCommitResult.stdout.trim();

            const remoteCommitResult = await executeGitCommand(`rev-parse origin/${branch}`);
            const remoteCommit = remoteCommitResult.stdout.trim();

            if (!remoteCommit) {
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    stage: 'complete',
                    error: `Could not find branch origin/${branch}`,
                    progress: 100,
                  }) + '\n',
                ),
              );
              controller.close();

              return;
            }

            const diffResult = await executeGitCommand(`diff --name-status HEAD..origin/${branch}`);
            const changedFiles = diffResult.stdout
              .trim()
              .split('\n')
              .filter(Boolean)
              .map((line) => {
                const [status, file] = line.split('\t');
                const statusMap: Record<string, string> = {
                  M: 'Modified: ',
                  A: 'Added: ',
                  D: 'Deleted: ',
                };

                return (statusMap[status] || 'Changed: ') + (file || 'unknown');
              });

            const diffStatsResult = await executeGitCommand(`diff --shortstat HEAD..origin/${branch}`);
            const diffStats = diffStatsResult.stdout;
            const additionsMatch = diffStats.match(/(\d+) insertion/);
            const deletionsMatch = diffStats.match(/(\d+) deletion/);
            const additions = additionsMatch ? additionsMatch[1] : '0';
            const deletions = deletionsMatch ? deletionsMatch[1] : '0';

            const commitMessagesResult = await executeGitCommand(`log --pretty=format:"%s" HEAD..origin/${branch}`);
            const commitMessages = commitMessagesResult.stdout.split('\n').filter(Boolean);

            let changelog = '';

            try {
              const changelogResult = await executeGitCommand(`git log --pretty=format:"%s" HEAD..origin/${branch}`);
              changelog = changelogResult.stdout.trim();
            } catch (error) {
              console.warn('Failed to fetch changelog:', error);
            }

            const updateReady = changedFiles.length > 0;

            if (requestBodyAction === 'updateCheck') {
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    stage: 'complete',
                    message: 'Update check complete',
                    progress: 100,
                    details: {
                      changedFiles,
                      additions: parseInt(additions),
                      deletions: parseInt(deletions),
                      commitMessages,
                      currentCommit,
                      remoteCommit,
                      updateReady,
                      changelog,
                      compareUrl: `https://github.com/stackblitz-labs/bolt.diy/compare/${currentCommit}...${remoteCommit}`,
                    },
                  }) + '\n',
                ),
              );
              controller.close();

              return;
            }

            if (requestBodyAction === 'update' && updateReady) {
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    stage: 'pull',
                    message: 'Pulling updates...',
                    progress: 50,
                  }) + '\n',
                ),
              );

              const pullResult = await executeGitCommand(`pull origin ${branch}`);

              if (pullResult.stderr) {
                throw new Error(pullResult.stderr);
              }

              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    stage: 'pull',
                    message: 'Updates pulled successfully',
                    progress: 70,
                  }) + '\n',
                ),
              );

              const installResult = await executePnpmCommand('pnpm install');

              if (installResult.stderr) {
                console.warn('Dependency installation warnings:', installResult.stderr);
              }

              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    stage: 'install',
                    message: 'Dependencies installed',
                    progress: 85,
                  }) + '\n',
                ),
              );

              const buildResult = await executePnpmCommand('pnpm run build');

              if (buildResult.stderr) {
                console.warn('Build warnings:', buildResult.stderr);
              }

              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    stage: 'build',
                    message: 'Application built successfully',
                    progress: 95,
                  }) + '\n',
                ),
              );

              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    stage: 'complete',
                    message: 'Update completed',
                    progress: 100,
                  }) + '\n',
                ),
              );
            } else {
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    stage: 'complete',
                    message: 'Already up to date',
                    progress: 100,
                  }) + '\n',
                ),
              );
            }
          }

          controller.close();
        } catch (error) {
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                stage: 'complete',
                message: 'Error during process',
                progress: 100,
                error: error instanceof Error ? error.message : 'Unknown error',
              }) + '\n',
            ),
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
      },
    });
  } catch (error) {
    console.error('Error in update API:', error);
    return json(
      {
        error: 'Error processing request',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
};
