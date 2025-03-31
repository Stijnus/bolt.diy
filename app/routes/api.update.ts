import { json, type ActionFunction } from '@remix-run/cloudflare';
import { isCloudEnvironment } from '~/lib/environment';
import { execCommand } from '~/lib/serverUtils';

/*
 * Only import Node.js modules if we're not in a cloud environment
 */

// We'll use dynamic imports for child_process to ensure compatibility with ESM
let execSync: any = null;

if (!isCloudEnvironment()) {
  try {
    // This will only work in Node.js environments, not in Cloudflare Workers
    const childProcess = await import('child_process');
    console.log('Successfully imported child_process');
    execSync = childProcess.execSync;
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

          // Check if Git is available by running the direct command
          try {
            console.log('Attempting to run Git with path:', gitPath);

            let stdout = '';

            // Try using execSync directly if available
            if (execSync) {
              try {
                console.log('Using execSync directly');
                stdout = execSync(`${gitPath} --version`, { encoding: 'utf8' });
                console.log('Direct execSync result:', stdout);
              } catch (error: unknown) {
                console.error('Error using direct execSync:', error);
                throw error;
              }
            } else {
              // Fall back to execCommand
              console.log('Falling back to execCommand');

              const result = await execCommand(`${gitPath} --version`);
              stdout = result.stdout || '';
              console.log('execCommand result:', result);
            }

            console.log('Git version stdout:', stdout);

            if (!stdout || !stdout.includes('git version')) {
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
            let repoCheckResult: ExecCommandResult;

            if (execSync) {
              try {
                console.log('Using execSync directly for repo check');

                const result = execSync(`${gitPath} rev-parse --is-inside-work-tree`, { encoding: 'utf8' });
                repoCheckResult = { stdout: result, stderr: '' };
                console.log('Direct execSync result:', result);
              } catch (error: unknown) {
                console.error('Error using direct execSync for repo check:', error);
                repoCheckResult = { stdout: '', stderr: String(error) };
              }
            } else {
              // Fall back to execCommand
              console.log('Falling back to execCommand for repo check');
              repoCheckResult = await execCommand(`${gitPath} rev-parse --is-inside-work-tree`);
              console.log('execCommand result:', repoCheckResult);
            }

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
            let remotesResult: ExecCommandResult;

            if (execSync) {
              try {
                console.log('Using execSync directly for remotes check');

                const result = execSync(`${gitPath} remote`, { encoding: 'utf8' });
                remotesResult = { stdout: result, stderr: '' };
                console.log('Direct execSync result:', result);
              } catch (error: unknown) {
                console.error('Error using direct execSync for remotes check:', error);
                remotesResult = { stdout: '', stderr: String(error) };
              }
            } else {
              // Fall back to execCommand
              console.log('Falling back to execCommand for remotes check');
              remotesResult = await execCommand(`${gitPath} remote`);
              console.log('execCommand result:', remotesResult);
            }

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
              let fetchCommand: ExecCommandResult;

              if (execSync) {
                try {
                  console.log('Using execSync directly for fetch');

                  const result = execSync(`${gitPath} fetch origin ${branch}`, { encoding: 'utf8' });
                  fetchCommand = { stdout: result, stderr: '' };
                  console.log('Direct execSync result:', result);
                } catch (error: unknown) {
                  console.error('Error using direct execSync for fetch:', error);
                  fetchCommand = { stdout: '', stderr: String(error) };
                }
              } else {
                // Fall back to execCommand
                console.log('Falling back to execCommand for fetch');
                fetchCommand = await execCommand(`${gitPath} fetch origin ${branch}`);
                console.log('execCommand result:', fetchCommand);
              }

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
              let currentCommit: string;

              if (execSync) {
                try {
                  console.log('Using execSync directly for current commit');

                  const result = execSync(`${gitPath} rev-parse HEAD`, { encoding: 'utf8' });
                  currentCommit = result.trim();
                  console.log('Direct execSync result:', result);
                } catch (error: unknown) {
                  console.error('Error using direct execSync for current commit:', error);
                  currentCommit = '';
                }
              } else {
                // Fall back to execCommand
                console.log('Falling back to execCommand for current commit');

                const result = await execCommand(`${gitPath} rev-parse HEAD`);
                currentCommit = result.stdout.trim();
                console.log('execCommand result:', result);
              }

              // Get the remote commit
              let remoteCommit: string;

              if (execSync) {
                try {
                  console.log('Using execSync directly for remote commit');

                  const result = execSync(`${gitPath} rev-parse origin/${branch}`, { encoding: 'utf8' });
                  remoteCommit = result.trim();
                  console.log('Direct execSync result:', result);
                } catch (error: unknown) {
                  console.error('Error using direct execSync for remote commit:', error);
                  remoteCommit = '';
                }
              } else {
                // Fall back to execCommand
                console.log('Falling back to execCommand for remote commit');

                const result = await execCommand(`${gitPath} rev-parse origin/${branch}`);
                remoteCommit = result.stdout.trim();
                console.log('execCommand result:', result);
              }

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
              let diffOutput: string;

              if (execSync) {
                try {
                  console.log('Using execSync directly for diff');

                  const result = execSync(`${gitPath} diff --name-status HEAD..origin/${branch}`, { encoding: 'utf8' });
                  diffOutput = result;
                  console.log('Direct execSync result:', result);
                } catch (error: unknown) {
                  console.error('Error using direct execSync for diff:', error);
                  diffOutput = '';
                }
              } else {
                // Fall back to execCommand
                console.log('Falling back to execCommand for diff');

                const result = await execCommand(`${gitPath} diff --name-status HEAD..origin/${branch}`);
                diffOutput = result.stdout;
                console.log('execCommand result:', result);
              }

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
              let diffStats: string;

              if (execSync) {
                try {
                  console.log('Using execSync directly for diff stats');

                  const result = execSync(`${gitPath} diff --shortstat HEAD..origin/${branch}`, { encoding: 'utf8' });
                  diffStats = result;
                  console.log('Direct execSync result:', result);
                } catch (error: unknown) {
                  console.error('Error using direct execSync for diff stats:', error);
                  diffStats = '';
                }
              } else {
                // Fall back to execCommand
                console.log('Falling back to execCommand for diff stats');

                const result = await execCommand(`${gitPath} diff --shortstat HEAD..origin/${branch}`);
                diffStats = result.stdout;
                console.log('execCommand result:', result);
              }

              const additionsMatch = diffStats.match(/(\d+) insertion/);
              const deletionsMatch = diffStats.match(/(\d+) deletion/);
              const additions = additionsMatch ? additionsMatch[1] : '0';
              const deletions = deletionsMatch ? deletionsMatch[1] : '0';

              // Get commit messages
              let commitMessages: string;

              if (execSync) {
                try {
                  console.log('Using execSync directly for commit messages');

                  const result = execSync(`${gitPath} log --pretty=format:"%s" HEAD..origin/${branch}`, {
                    encoding: 'utf8',
                  });
                  commitMessages = result;
                  console.log('Direct execSync result:', result);
                } catch (error: unknown) {
                  console.error('Error using direct execSync for commit messages:', error);
                  commitMessages = '';
                }
              } else {
                // Fall back to execCommand
                console.log('Falling back to execCommand for commit messages');

                const result = await execCommand(`${gitPath} log --pretty=format:"%s" HEAD..origin/${branch}`);
                commitMessages = result.stdout;
                console.log('execCommand result:', result);
              }

              // Check for changelog file updates
              let changelog = '';

              try {
                let changelogDiff: string;

                if (execSync) {
                  try {
                    console.log('Using execSync directly for changelog diff');

                    const result = execSync(`${gitPath} diff --unified=0 HEAD..origin/${branch} -- CHANGELOG.md`, {
                      encoding: 'utf8',
                    });
                    changelogDiff = result;
                    console.log('Direct execSync result:', result);
                  } catch (error: unknown) {
                    console.error('Error using direct execSync for changelog diff:', error);
                    changelogDiff = '';
                  }
                } else {
                  // Fall back to execCommand
                  console.log('Falling back to execCommand for changelog diff');

                  const result = await execCommand(
                    `${gitPath} diff --unified=0 HEAD..origin/${branch} -- CHANGELOG.md`,
                  );
                  changelogDiff = result.stdout;
                  console.log('execCommand result:', result);
                }

                if (changelogDiff) {
                  // Extract only added lines from the changelog
                  const changelogLines = changelogDiff
                    .split('\n')
                    .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
                    .map((line) => line.substring(1))
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

                if (execSync) {
                  try {
                    console.log('Using execSync directly for pull');
                    execSync(`${gitPath} pull origin ${branch}`);
                    console.log('Direct execSync result:');
                  } catch (error: unknown) {
                    console.error('Error using direct execSync for pull:', error);
                    throw error;
                  }
                } else {
                  // Fall back to execCommand
                  console.log('Falling back to execCommand for pull');
                  await execCommand(`${gitPath} pull origin ${branch}`);
                  console.log('execCommand result:');
                }

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

                if (execSync) {
                  try {
                    console.log('Using execSync directly for install');
                    execSync('pnpm install');
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

                if (execSync) {
                  try {
                    console.log('Using execSync directly for build');
                    execSync('pnpm run build');
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
