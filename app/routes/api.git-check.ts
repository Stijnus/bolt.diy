import { json, type LoaderFunction } from '@remix-run/cloudflare';
import { isCloudEnvironment } from '~/lib/environment';
import { isGitAvailable, execCommand, getGitInfo } from '~/lib/serverUtils';

// Define an interface for Git remotes
interface GitRemote {
  name: string;
  url: string;
}

export const loader: LoaderFunction = async ({ request }) => {
  // Get diagnostic parameter
  const url = new URL(request.url);
  const diagnostic = url.searchParams.get('diagnostic') === 'true';

  // If we're in a cloud environment, Git availability is not relevant
  if (isCloudEnvironment()) {
    return json({
      isAvailable: false,
      inCloud: true,
      error: null,
    });
  }

  try {
    // Check if Git is available
    const gitAvailable = await isGitAvailable();

    // Basic response if Git is not available or diagnostic not requested
    if (!gitAvailable || !diagnostic) {
      return json({
        isAvailable: gitAvailable,
        inCloud: false,
        error: gitAvailable ? null : 'Git command not found. Please install Git to enable update functionality.',
      });
    }

    // Enhanced diagnostic mode
    try {
      // Check Git version
      const { stdout: gitVersion } = await execCommand('git --version');

      // Check Git configuration
      const { stdout: gitConfig } = await execCommand('git config --list');

      // Get repository info
      const repoInfo = await getGitInfo();

      // Try to get remotes
      let remotes: GitRemote[] = [];

      if (repoInfo.isGitRepo) {
        try {
          const { stdout: remotesOutput } = await execCommand('git remote -v');
          remotes = remotesOutput
            .split('\n')
            .filter((line) => line.includes('(fetch)'))
            .map((line) => {
              const [name, url] = line.split(/\s+/);
              return { name, url: url.replace('(fetch)', '').trim() };
            });
        } catch {
          // Continue even if we can't get remotes
        }
      }

      return json({
        isAvailable: true,
        inCloud: false,
        error: null,
        diagnostic: {
          gitVersion: gitVersion.trim(),
          isGitRepo: repoInfo.isGitRepo,
          currentBranch: repoInfo.currentBranch,
          currentCommit: repoInfo.currentCommit,
          remotes,
          hasUpstream: remotes.some((r) => r.name === 'upstream'),
          hasOrigin: remotes.some((r) => r.name === 'origin'),
          configEntries: gitConfig.split('\n').length,
        },
      });
    } catch (diagError) {
      return json({
        isAvailable: true,
        inCloud: false,
        error: null,
        diagnostic: {
          error: diagError instanceof Error ? diagError.message : 'Error running Git diagnostics',
        },
      });
    }
  } catch (error) {
    console.error('Error checking Git availability:', error);

    return json({
      isAvailable: false,
      inCloud: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred checking Git availability',
    });
  }
};
