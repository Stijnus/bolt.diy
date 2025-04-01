import { json, type ActionFunction } from '@remix-run/cloudflare';
import { isCloudEnvironment } from '~/lib/environment';
import { execCommand } from '~/lib/serverUtils';

/*
 * Only import Node.js modules if we're not in a cloud environment
 */

// We'll use dynamic imports for child_process to ensure compatibility with ESM
type ExecSyncFunction = (command: string, options?: { encoding?: string; timeout?: number; cwd?: string }) => string;

let execSync: ExecSyncFunction | null = null;

if (!isCloudEnvironment()) {
  try {
    // This will only work in Node.js environments, not in Cloudflare Workers
    const childProcess = await import('child_process');
    console.log('Successfully imported child_process');
    execSync = childProcess.execSync as ExecSyncFunction;
  } catch (error) {
    console.error('Error importing child_process:', error);
    console.warn('child_process module not available despite not being in cloud environment');
  }
}

interface UpdateRequestBody {
  branch?: string;
  autoUpdate?: boolean;
}

interface ExecCommandResult {
  stdout: string;
  stderr: string;
  error?: string;
}

// Helper function to execute Git commands with proper error handling
async function executeGitCommand(command: string, gitPath: string): Promise<ExecCommandResult> {
  console.log(`Executing Git command: ${command}`);

  if (execSync) {
    try {
      console.log('Using execSync directly');

      const stdout = execSync(`${gitPath} ${command}`, {
        encoding: 'utf8',
      });
      console.log('Direct execSync result:', stdout);

      return { stdout, stderr: '' };
    } catch (error: unknown) {
      console.error(`Error using direct execSync for command '${command}':`, error);

      return { stdout: '', stderr: String(error) };
    }
  } else {
    // Fall back to execCommand
    console.log('Falling back to execCommand');

    try {
      const result = await execCommand(`${gitPath} ${command}`);
      console.log('execCommand result:', result);

      return result;
    } catch (error: unknown) {
      console.error(`Error using execCommand for command '${command}':`, error);

      return { stdout: '', stderr: String(error) };
    }
  }
}

export const action: ActionFunction = async ({ request }) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  // If we're in a cloud environment, return a clear message
  if (isCloudEnvironment()) {
    return json(
      {
        error: 'Updates not available in cloud environments',
        details: 'This instance is running in a cloud environment where updates are managed through deployments.',
        environment: 'cloud',
      },
      { status: 400 },
    );
  }

  try {
    // Parse request body
    const body = (await request.json()) as UpdateRequestBody;
    const { branch = 'main', autoUpdate = false } = body;

    // Create a response stream for providing progress updates
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Use the direct Git path we know works on this system
          const gitPath = '/opt/homebrew/bin/git';

          // Check if Git is available by running the version command
          const versionResult = await executeGitCommand('--version', gitPath);

          if (!versionResult.stdout || !versionResult.stdout.includes('git version')) {
            controller.enqueue(
              encoder.encode(
                JSON.stringify({
                  stage: 'fetch',
                  error: 'Git is not available on this system. Please install Git to enable updates.',
                  progress: 100,
                }),
              ),
            );
            return;
          }

          // Check if we're in a Git repository
          const repoCheckResult = await executeGitCommand('rev-parse --is-inside-work-tree', gitPath);

          if (!repoCheckResult.stdout || !repoCheckResult.stdout.includes('true')) {
            controller.enqueue(
              encoder.encode(
                JSON.stringify({
                  stage: 'fetch',
                  error: 'This directory is not a Git repository.',
                  progress: 100,
                }),
              ),
            );
            return;
          }

          // Check for remotes
          const remotesResult = await executeGitCommand('remote', gitPath);

          if (!remotesResult.stdout || remotesResult.stdout.trim() === '') {
            controller.enqueue(
              encoder.encode(
                JSON.stringify({
                  stage: 'fetch',
                  error: 'No remotes configured for this Git repository.',
                  progress: 100,
                }),
              ),
            );
            return;
          }

          // Now we can proceed with the update
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                stage: 'fetch',
                message: 'Checking for updates...',
                progress: 10,
              }),
            ),
          );

          try {
            // Fetch the latest changes
            const fetchCommand = await executeGitCommand(`fetch origin ${branch}`, gitPath);

            if (fetchCommand.stderr && fetchCommand.stderr.trim()) {
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    stage: 'fetch',
                    error: `Error fetching updates: ${fetchCommand.stderr}`,
                    progress: 100,
                  }),
                ),
              );
              return;
            }

            controller.enqueue(
              encoder.encode(
                JSON.stringify({
                  stage: 'fetch',
                  message: 'Checking for changes...',
                  progress: 30,
                }),
              ),
            );

            // Get the current commit
            const currentCommitResult = await executeGitCommand('rev-parse HEAD', gitPath);
            const currentCommit = currentCommitResult.stdout.trim();

            // Get the remote commit
            const remoteCommitResult = await executeGitCommand(`rev-parse origin/${branch}`, gitPath);
            const remoteCommit = remoteCommitResult.stdout.trim();

            if (!remoteCommit) {
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    stage: 'fetch',
                    error: 'Could not determine remote commit. The branch may not exist.',
                    progress: 100,
                  }),
                ),
              );
              return;
            }

            // Get changed files
            const diffResult = await executeGitCommand(`diff --name-status HEAD..origin/${branch}`, gitPath);
            const diffOutput = diffResult.stdout;

            const changedFiles = diffOutput
              .trim()
              .split('\n')
              .filter((line) => line.trim().length > 0)
              .map((line) => {
                const [status, file] = line.split('\t');
                const statusMap: Record<string, string> = {
                  M: 'Modified: ',
                  A: 'Added: ',
                  D: 'Deleted: ',
                  R: 'Renamed: ',
                  C: 'Copied: ',
                };

                return (statusMap[status] || 'Changed: ') + (file || 'unknown');
              });

            // Get stats
            const diffStatsResult = await executeGitCommand(`diff --shortstat HEAD..origin/${branch}`, gitPath);
            const diffStats = diffStatsResult.stdout;

            const additionsMatch = diffStats.match(/(\d+) insertion/);
            const deletionsMatch = diffStats.match(/(\d+) deletion/);
            const additions = additionsMatch ? additionsMatch[1] : '0';
            const deletions = deletionsMatch ? deletionsMatch[1] : '0';

            // Get commit messages
            const commitMessagesResult = await executeGitCommand(
              `log --pretty=format:"%s" HEAD..origin/${branch}`,
              gitPath,
            );
            const commitMessages = commitMessagesResult.stdout;

            // Check for changelog file updates
            let changelog = '';

            try {
              const changelogDiffResult = await executeGitCommand(
                `diff --unified=0 HEAD..origin/${branch} -- CHANGELOG.md`,
                gitPath,
              );
              const changelogDiff = changelogDiffResult.stdout;

              if (changelogDiff) {
                // Extract only added lines from the changelog
                const changelogLines = changelogDiff
                  .split('\n')
                  .filter((line: string) => line.startsWith('+') && !line.startsWith('+++'))
                  .map((line: string) => line.substring(1))
                  .join('\n');

                changelog = changelogLines;
              }
            } catch {
              // CHANGELOG.md might not exist, which is fine
            }

            const updateReady = changedFiles.length > 0;

            // Complete fetch stage
            controller.enqueue(
              encoder.encode(
                JSON.stringify({
                  stage: 'fetch',
                  message: 'Update check complete',
                  progress: 100,
                  details: {
                    changedFiles,
                    additions: parseInt(additions),
                    deletions: parseInt(deletions),
                    commitMessages: commitMessages.split('\n').filter(Boolean),
                    currentCommit,
                    remoteCommit,
                    updateReady,
                    changelog,
                    compareUrl: `https://github.com/stackblitz-labs/bolt.diy/compare/${currentCommit}...${remoteCommit}`,
                  },
                }) + '\n',
              ),
            );

            // If auto-update is enabled, perform the update
            if (autoUpdate && updateReady) {
              // Pull changes
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    stage: 'pull',
                    message: 'Pulling updates...',
                    progress: 0,
                  }) + '\n',
                ),
              );

              await executeGitCommand(`pull origin ${branch}`, gitPath);

              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    stage: 'pull',
                    message: 'Updates pulled successfully',
                    progress: 100,
                  }) + '\n',
                ),
              );

              // Install dependencies
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    stage: 'install',
                    message: 'Installing dependencies...',
                    progress: 0,
                  }) + '\n',
                ),
              );

              // For npm/pnpm commands, we need to use execSync directly or execCommand
              if (execSync) {
                try {
                  console.log('Using execSync directly for install');
                  execSync('pnpm install', { encoding: 'utf8' });
                  console.log('Direct execSync result:');
                } catch (error: unknown) {
                  console.error('Error using direct execSync for install:', error);
                  throw error;
                }
              } else {
                // Fall back to execCommand
                console.log('Falling back to execCommand for install');
                await execCommand('pnpm install');
                console.log('execCommand result:');
              }

              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    stage: 'install',
                    message: 'Dependencies installed',
                    progress: 100,
                  }) + '\n',
                ),
              );

              // Build application
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    stage: 'build',
                    message: 'Building application...',
                    progress: 0,
                  }) + '\n',
                ),
              );

              // For npm/pnpm commands, we need to use execSync directly or execCommand
              if (execSync) {
                try {
                  console.log('Using execSync directly for build');
                  execSync('pnpm run build', { encoding: 'utf8' });
                  console.log('Direct execSync result:');
                } catch (error: unknown) {
                  console.error('Error using direct execSync for build:', error);
                  throw error;
                }
              } else {
                // Fall back to execCommand
                console.log('Falling back to execCommand for build');
                await execCommand('pnpm run build');
                console.log('execCommand result:');
              }

              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    stage: 'build',
                    message: 'Application built successfully',
                    progress: 100,
                  }) + '\n',
                ),
              );
            }

            // Complete
            controller.enqueue(
              encoder.encode(
                JSON.stringify({
                  stage: 'complete',
                  message: autoUpdate && updateReady ? 'Update completed' : 'Update check completed',
                  progress: 100,
                }) + '\n',
              ),
            );

            controller.close();
          } catch (error) {
            controller.enqueue(
              encoder.encode(
                JSON.stringify({
                  stage: 'complete',
                  message: 'Error during update',
                  progress: 100,
                  error: error instanceof Error ? error.message : 'Unknown error',
                }) + '\n',
              ),
            );
            controller.close();
          }
        } catch (error) {
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                stage: 'complete',
                message: 'Error during update',
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
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error in update API:', error);
    return json(
      {
        error: 'Error processing update request',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
};
