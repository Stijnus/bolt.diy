import { json, type LoaderFunction } from '@remix-run/cloudflare';
import { isGitAvailable, isDirectGitAvailable, execGitCommand, execDirectGit, execCommand } from '~/lib/serverUtils';

interface GitTestResults {
  standardGitAvailable: boolean;
  directGitAvailable: boolean;
  gitVersion: string | null;
  directHomebrewTest: string | null;
  directUsrLocalTest: string | null;
  systemPath: string | null;
  rawHomebrewTest: string | null;
  environment: typeof process.env;
  error?: string;
}

export const loader: LoaderFunction = async () => {
  const results: GitTestResults = {
    standardGitAvailable: false,
    directGitAvailable: false,
    gitVersion: null,
    directHomebrewTest: null,
    directUsrLocalTest: null,
    systemPath: null,
    rawHomebrewTest: null,
    environment: process.env,
  };

  try {
    // Check standard Git availability
    results.standardGitAvailable = await isGitAvailable();

    // Check direct Git availability
    results.directGitAvailable = await isDirectGitAvailable();

    // Get system PATH
    try {
      const { stdout: pathOutput } = await execCommand('echo $PATH');
      results.systemPath = pathOutput.trim();
    } catch (error) {
      console.error('Error getting PATH:', error);
    }

    // Try Git with absolute path using Node child_process directly
    try {
      // Import directly to avoid issues in browser/worker environments
      const { execSync } = await import('child_process');

      try {
        const result = execSync('/opt/homebrew/bin/git --version', { encoding: 'utf8' });
        results.rawHomebrewTest = result.trim();
      } catch (err) {
        const error = err as Error;
        results.rawHomebrewTest = `Error: ${error.message}`;
      }
    } catch (importError) {
      results.rawHomebrewTest = `Error importing child_process: ${importError instanceof Error ? importError.message : 'Unknown error'}`;
    }

    // Try to get Git version if any method succeeded
    if (results.standardGitAvailable) {
      try {
        const { stdout } = await execGitCommand('--version');
        results.gitVersion = stdout.trim();
      } catch (error) {
        console.error('Error getting Git version:', error);
      }
    } else if (results.directGitAvailable) {
      try {
        const { stdout } = await execDirectGit('--version');
        results.gitVersion = stdout.trim();
      } catch (error) {
        console.error('Error getting Git version:', error);
      }
    }

    // Try direct homebrew path (without using our wrapper)
    try {
      const { stdout: homebrewOutput } = await execCommand('/opt/homebrew/bin/git --version');
      results.directHomebrewTest = homebrewOutput.trim();
    } catch (error) {
      results.directHomebrewTest = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }

    // Try direct usr/local path (without using our wrapper)
    try {
      const { stdout: usrLocalOutput } = await execCommand('/usr/local/bin/git --version');
      results.directUsrLocalTest = usrLocalOutput.trim();
    } catch (error) {
      results.directUsrLocalTest = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }

    return json(results);
  } catch (error) {
    console.error('Error testing Git:', error);
    return json({
      ...results,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
