import { json, type LoaderFunction } from '@remix-run/cloudflare';

interface GitDirectTestResults {
  gitRepo: boolean;
  gitStatus: string | null;
  gitRemote: string | null;
  workingDir: string | null;
  error: string | null;
}

export const loader: LoaderFunction = async () => {
  const results: GitDirectTestResults = {
    gitRepo: false,
    gitStatus: null,
    gitRemote: null,
    workingDir: null,
    error: null,
  };

  try {
    // Import child_process directly
    const { execSync } = await import('child_process');

    // Get current working directory
    try {
      const cwd = execSync('pwd', { encoding: 'utf8' });
      results.workingDir = cwd.trim();
    } catch (error) {
      results.error = `Error getting working directory: ${error instanceof Error ? error.message : 'Unknown error'}`;
      return json(results);
    }

    // Test if this is a Git repository using absolute paths
    try {
      const gitCheck = execSync('/opt/homebrew/bin/git rev-parse --is-inside-work-tree', {
        encoding: 'utf8',
        cwd: results.workingDir || process.cwd(),
      });
      results.gitRepo = gitCheck.trim() === 'true';
    } catch (error) {
      results.error = `Error checking Git repo: ${error instanceof Error ? error.message : 'Unknown error'}`;
      return json(results);
    }

    // Get Git status
    try {
      const gitStatus = execSync('/opt/homebrew/bin/git status', {
        encoding: 'utf8',
        cwd: results.workingDir || process.cwd(),
      });
      results.gitStatus = gitStatus.trim();
    } catch (error) {
      results.error = `Error getting Git status: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }

    // Get Git remote info
    try {
      const gitRemote = execSync('/opt/homebrew/bin/git remote -v', {
        encoding: 'utf8',
        cwd: results.workingDir || process.cwd(),
      });
      results.gitRemote = gitRemote.trim();
    } catch (error) {
      results.error = `Error getting Git remote: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }

    return json(results);
  } catch (error) {
    results.error = `General error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    return json(results);
  }
};
