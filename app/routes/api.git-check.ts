import { json, type LoaderFunction } from '@remix-run/cloudflare';
import { isCloudEnvironment } from '~/lib/environment';
import { execCommand, getDirectGitInfo, isGitInstalled } from '~/lib/serverUtils';

// Only import Node.js modules if we're not in a cloud environment
let execSync: any = null;

if (!isCloudEnvironment()) {
  try {
    // This will only work in Node.js environments, not in Cloudflare Workers
    const childProcess = await import('child_process');
    execSync = childProcess.execSync;
  } catch {
    console.warn('child_process module not available despite not being in cloud environment');
  }
}

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
    // Check if Git is installed using multiple methods
    let gitInstalled = false;
    let gitVersion = '';

    // First try using the utility function which should work in all environments
    gitInstalled = await isGitInstalled();

    // If that fails and we have execSync available, try direct execSync
    if (!gitInstalled && execSync) {
      try {
        const output = execSync('git --version', { encoding: 'utf8', timeout: 3000 });

        if (output) {
          gitVersion = output.toString().trim();
          gitInstalled = gitVersion.toLowerCase().includes('git version');
        }
      } catch (execError) {
        console.warn('Error executing git command directly:', execError);
      }
    }

    // Basic response if Git is not installed or diagnostic not requested
    if (!gitInstalled || !diagnostic) {
      return json({
        isAvailable: gitInstalled,
        inCloud: false,
        error: gitInstalled ? null : 'Git command not found. Please install Git to enable update functionality.',
      });
    }

    // Enhanced diagnostic mode
    try {
      // Git version already obtained above

      // Check Git configuration
      const { stdout: gitConfig } = await execCommand('git config --list');

      // Get repository info
      const repoInfo = await getDirectGitInfo();

      // Try to get remotes
      let remotes: GitRemote[] = [];

      if (repoInfo.isGitRepo && execSync) {
        try {
          const remotesOutput = execSync('git remote -v', { encoding: 'utf8', timeout: 3000 });

          if (remotesOutput) {
            const trimmedOutput = remotesOutput.toString().trim();
            remotes = trimmedOutput
              .split('\n')
              .filter((line: string) => line.includes('(fetch)'))
              .map((line: string) => {
                const [name, url] = line.split(/\s+/);
                return { name, url: url.replace('(fetch)', '').trim() };
              });
          }
        } catch (remotesError) {
          console.warn('Error getting Git remotes:', remotesError);

          // Continue even if we can't get remotes
        }
      }

      return json({
        isAvailable: true,
        inCloud: false,
        error: null,
        diagnostic: {
          gitVersion,
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
    console.error('Error checking Git installation:', error);

    return json({
      isAvailable: false,
      inCloud: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred checking Git installation',
    });
  }
};
