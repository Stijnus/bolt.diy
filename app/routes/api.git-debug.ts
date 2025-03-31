import { json, type LoaderFunction } from '@remix-run/cloudflare';
import { getDirectGitInfoSync } from '~/lib/serverUtils';

interface GitDebugResults {
  directInfoMethod: {
    isGitRepo: boolean;
    currentBranch?: string;
    currentCommit?: string;
    remotes?: { name: string; url: string }[];
  } | null;
  manualCheck: {
    isGitRepo: boolean;
    gitPath: string;
    testCommand: string;
    workingDir: string;
    currentBranch?: string;
  } | null;
  workingDir: string | null;
  error: string | null;
}

export const loader: LoaderFunction = async () => {
  const results: GitDebugResults = {
    directInfoMethod: null,
    manualCheck: null,
    workingDir: null,
    error: null,
  };

  try {
    // Get working directory
    try {
      const { execSync } = await import('child_process');
      results.workingDir = execSync('pwd', { encoding: 'utf8' }).trim();
    } catch (error) {
      results.error = `Error getting working directory: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }

    // Test our getDirectGitInfoSync function
    try {
      const gitInfo = await getDirectGitInfoSync();
      results.directInfoMethod = {
        isGitRepo: gitInfo.isGitRepo,
        currentBranch: gitInfo.currentBranch,
        currentCommit: gitInfo.currentCommit,
        remotes: gitInfo.remotes,
      };
    } catch (error) {
      results.error = `Error in getDirectGitInfoSync: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }

    // Manual check using child_process directly
    try {
      const { execSync } = await import('child_process');
      const cwd = results.workingDir || process.cwd();

      const isGitRepo =
        execSync('/opt/homebrew/bin/git rev-parse --is-inside-work-tree', {
          encoding: 'utf8',
          cwd,
        }).trim() === 'true';

      results.manualCheck = {
        isGitRepo,
        gitPath: '/opt/homebrew/bin/git',
        testCommand: '/opt/homebrew/bin/git rev-parse --is-inside-work-tree',
        workingDir: cwd,
      };

      if (isGitRepo && results.manualCheck) {
        const branch = execSync('/opt/homebrew/bin/git branch --show-current', {
          encoding: 'utf8',
          cwd,
        }).trim();

        results.manualCheck.currentBranch = branch;
      }
    } catch (error) {
      if (!results.error) {
        results.error = `Error in manual check: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    }

    return json(results);
  } catch (error) {
    return json({
      error: `General error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
};
