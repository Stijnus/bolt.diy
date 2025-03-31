import { json, type ActionFunction } from '@remix-run/cloudflare';
import { isCloudEnvironment } from '~/lib/environment';
import {
  execCommand,
  execGitUltimate,
  isGitAvailable,
  isDirectGitAvailable,
  isDirectGitSyncAvailable,
  getGitInfo,
  getDirectGitInfoSync,
} from '~/lib/serverUtils';

interface UpdateRequestBody {
  branch?: string;
  autoUpdate?: boolean;
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
          // Check if Git is available - try multiple methods
          let gitAvailable = await isGitAvailable();

          if (!gitAvailable) {
            gitAvailable = await isDirectGitAvailable();
          }

          if (!gitAvailable) {
            gitAvailable = await isDirectGitSyncAvailable();
          }

          if (!gitAvailable) {
            controller.enqueue(
              encoder.encode(
                JSON.stringify({
                  stage: 'complete',
                  message: 'Git is not available on this system',
                  error: 'Git command not found. Please install Git to enable update functionality.',
                  progress: 100,
                }) + '\n',
              ),
            );
            controller.close();

            return;
          }

          // Get git repository info - try multiple methods
          let gitInfo;

          try {
            gitInfo = await getGitInfo();
          } catch {
            try {
              gitInfo = await getDirectGitInfoSync();
            } catch {
              gitInfo = { isGitRepo: false };
            }
          }

          if (!gitInfo.isGitRepo) {
            controller.enqueue(
              encoder.encode(
                JSON.stringify({
                  stage: 'complete',
                  message: 'Not a Git repository',
                  error: 'The current directory is not a Git repository.',
                  progress: 100,
                }) + '\n',
              ),
            );
            controller.close();

            return;
          }

          // Check repository status
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                stage: 'fetch',
                message: 'Checking repository status...',
                progress: 10,
              }) + '\n',
            ),
          );

          /*
           * Use our ultimate Git executor for all Git commands
           * It will try all methods in order until one succeeds
           */
          const execGitSafe = execGitUltimate;

          // Check for uncommitted changes
          const { stdout: statusOutput } = await execGitSafe('status --porcelain');

          if (statusOutput.trim()) {
            controller.enqueue(
              encoder.encode(
                JSON.stringify({
                  stage: 'fetch',
                  message: 'Uncommitted changes detected',
                  error:
                    'There are uncommitted changes in your repository. Please commit or stash them before updating.',
                  progress: 20,
                }) + '\n',
              ),
            );
            controller.close();

            return;
          }

          // Get current commit
          const { stdout: currentCommit } = await execGitSafe('rev-parse --short HEAD');

          // Fetch updates from remote
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                stage: 'fetch',
                message: 'Fetching updates...',
                progress: 30,
                details: {
                  currentCommit: currentCommit.trim(),
                },
              }) + '\n',
            ),
          );

          // Check if upstream remote exists
          let remoteExists = false;

          try {
            const { stdout: remoteOutput } = await execGitSafe('remote');
            remoteExists = remoteOutput.split('\n').some((r) => r.trim() === 'upstream');
          } catch {
            // Handle error checking remotes
          }

          if (!remoteExists) {
            // If upstream doesn't exist, use origin
            await execGitSafe(`fetch origin`);
          } else {
            await execGitSafe(`fetch upstream`);
          }

          // Determine which remote to use
          const remote = remoteExists ? 'upstream' : 'origin';

          // Get remote commit
          const { stdout: remoteCommit } = await execGitSafe(`rev-parse --short ${remote}/${branch}`);

          // Get changed files
          const { stdout: diffOutput } = await execGitSafe(`diff --name-status HEAD..${remote}/${branch}`);
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
          const { stdout: diffStats } = await execGitSafe(`diff --shortstat HEAD..${remote}/${branch}`);
          const additionsMatch = diffStats.match(/(\d+) insertion/);
          const deletionsMatch = diffStats.match(/(\d+) deletion/);
          const additions = additionsMatch ? additionsMatch[1] : '0';
          const deletions = deletionsMatch ? deletionsMatch[1] : '0';

          // Get commit messages
          const { stdout: commitMessages } = await execGitSafe(`log --pretty=format:"%s" HEAD..${remote}/${branch}`);

          // Check for changelog file updates
          let changelog = '';

          try {
            const { stdout: changelogDiff } = await execGitSafe(
              `diff --unified=0 HEAD..${remote}/${branch} -- CHANGELOG.md`,
            );

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
                  currentCommit: currentCommit.trim(),
                  remoteCommit: remoteCommit.trim(),
                  updateReady,
                  changelog,
                  compareUrl: `https://github.com/stackblitz-labs/bolt.diy/compare/${currentCommit.trim()}...${remoteCommit.trim()}`,
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

            await execGitSafe(`pull ${remote} ${branch}`);

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

            await execCommand('pnpm install');

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

            await execCommand('pnpm run build');

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
    return json(
      {
        error: 'Update process failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
};
