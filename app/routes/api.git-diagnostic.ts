import { json, type LoaderFunction } from '@remix-run/cloudflare';
import { isCloudEnvironment } from '~/lib/environment';
import { execSync } from 'child_process';

// Simplified result interface focused on update requirements
interface GitDiagnosticResult {
  inCloud: boolean;
  gitInstalled: boolean;
  isGitInstalled: boolean; // Backward compatibility
  isGitRepo: boolean;
  hasUpstreamRemote: boolean;
  hasOriginRemote: boolean; // Backward compatibility
  upstreamUrl?: string;
  gitVersion?: string;
  possibleSolutions?: string[];
  error?: string;
}

export const loader: LoaderFunction = async () => {
  // Check if we're in a cloud environment (where Git operations aren't relevant)
  if (isCloudEnvironment()) {
    return json({
      inCloud: true,
      gitInstalled: false,
      isGitInstalled: false, // Backward compatibility
      isGitRepo: false,
      hasUpstreamRemote: false,
      hasOriginRemote: false, // Backward compatibility
      possibleSolutions: ['Git operations are not available in cloud environments.'],
    });
  }

  // Initialize result with default values
  const result: GitDiagnosticResult = {
    inCloud: false,
    gitInstalled: false,
    isGitInstalled: false, // Backward compatibility
    isGitRepo: false,
    hasUpstreamRemote: false,
    hasOriginRemote: false, // Backward compatibility
  };

  try {
    // 1. Check if Git is installed by running 'git --version'
    try {
      const gitVersionOutput = execSync('git --version', { encoding: 'utf8', timeout: 3000 }).trim();
      result.gitInstalled = gitVersionOutput.toLowerCase().includes('git version');
      result.isGitInstalled = result.gitInstalled; // Backward compatibility
      result.gitVersion = gitVersionOutput;
    } catch (error) {
      console.warn('Git not installed or not in PATH:', error);
      result.gitInstalled = false;
      result.isGitInstalled = false; // Backward compatibility
      result.error = 'Git is not installed or not in your PATH';
    }

    // If Git is not installed, return early with appropriate solutions
    if (!result.gitInstalled) {
      result.possibleSolutions = [
        'Git is required for updating Bolt.DIY.',
        'Install Git from https://git-scm.com/downloads',
        'Make sure Git is added to your system PATH.',
        'Restart your terminal and application after installation.',
      ];

      return json(result);
    }

    // 2. Check if current directory is a Git repository
    try {
      execSync('git rev-parse --is-inside-work-tree', {
        encoding: 'utf8',
        stdio: 'ignore',
        timeout: 3000,
      });
      result.isGitRepo = true;
    } catch (error) {
      console.warn('Not a Git repository:', error);
      result.isGitRepo = false;
      result.possibleSolutions = [
        'The current directory is not a Git repository.',
        'Initialize Git with: git init',
        'Or clone the Bolt.DIY repository: git clone https://github.com/stackblitz-labs/bolt.diy.git',
      ];

      return json(result);
    }

    // 3. Check for upstream remote
    try {
      const remotesOutput = execSync('git remote -v', { encoding: 'utf8', timeout: 3000 }).trim();
      const hasUpstream = remotesOutput.includes('upstream');
      result.hasUpstreamRemote = hasUpstream;
      result.hasOriginRemote = hasUpstream; // For backward compatibility, treat upstream as origin

      // Extract the upstream URL if it exists
      if (hasUpstream) {
        const upstreamLine = remotesOutput.split('\n').find((line) => line.startsWith('upstream'));

        if (upstreamLine) {
          const urlMatch = upstreamLine.match(/upstream\s+(\S+)/);

          if (urlMatch && urlMatch[1]) {
            result.upstreamUrl = urlMatch[1];
          }
        }
      }
    } catch (error) {
      console.warn('Error checking remotes:', error);
      result.hasUpstreamRemote = false;
      result.hasOriginRemote = false; // Backward compatibility
    }

    // Generate solutions if upstream remote is missing
    if (!result.hasUpstreamRemote) {
      result.possibleSolutions = [
        'The repository is missing the upstream remote pointing to the official Bolt.DIY repository.',
        'Add it with: git remote add upstream https://github.com/stackblitz-labs/bolt.diy.git',
      ];

      return json(result);
    }

    // If we got here, everything is set up correctly for updates
    return json({
      ...result,
      possibleSolutions: ['Git is properly configured for updates. You can now use the update functionality.'],
    });
  } catch (error) {
    console.error('Unhandled error in Git diagnostic:', error);
    return json({
      inCloud: false,
      gitInstalled: false,
      isGitInstalled: false, // Backward compatibility
      isGitRepo: false,
      hasUpstreamRemote: false,
      hasOriginRemote: false, // Backward compatibility
      error: error instanceof Error ? error.message : 'Unknown error occurred during Git diagnostics',
      possibleSolutions: ['An unexpected error occurred. Please check your Git installation and try again.'],
    });
  }
};
