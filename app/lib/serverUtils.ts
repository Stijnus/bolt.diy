/**
 * Server-side utilities for the Bolt application
 * Contains utilities for safe command execution and other server operations
 */

import { isCloudEnvironment } from './environment';

// Add common paths where Git might be located
const commonGitPaths = [
  '/opt/homebrew/bin/git', // macOS Homebrew
  '/usr/local/bin/git', // macOS Homebrew (Intel)
  '/usr/bin/git', // Linux/macOS system
  'C:\\Program Files\\Git\\bin\\git.exe', // Windows
  'C:\\Program Files (x86)\\Git\\bin\\git.exe', // Windows 32-bit
];

/**
 * A custom implementation of util.promisify to avoid ESM/CommonJS conflicts
 */
function promisify<T extends (...args: any[]) => any>(fn: T): (...args: Parameters<T>) => Promise<any> {
  return function (...args: Parameters<T>): Promise<any> {
    return new Promise((resolve, reject) => {
      fn(...args, (err: any, result: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  };
}

/**
 * Execute a shell command safely with timeout and error handling
 * This will only work in a Node.js environment, not in Cloudflare Workers
 */
export const execCommand = async (
  command: string,
  options: { timeout?: number; cwd?: string } = {},
): Promise<{ stdout: string; stderr: string }> => {
  // Make sure we're not in a cloud environment
  if (isCloudEnvironment()) {
    throw new Error('Cannot execute commands in a cloud environment');
  }

  // Import dynamically to avoid issues in browser/worker environments
  try {
    const { exec } = await import('child_process');

    // Use our custom promisify instead of importing from util
    const execPromise = promisify(exec);

    // Execute with provided options
    const { timeout = 30000, cwd } = options;

    return await execPromise(command, { timeout, cwd });
  } catch (error) {
    console.error(`Error executing command: ${command}`, error);
    throw error;
  }
};

/**
 * Execute Git commands using the direct path to Git
 * This bypasses PATH issues and directly accesses the Git executable
 */
export const execDirectGit = async (
  args: string,
  options: { timeout?: number; cwd?: string } = {},
): Promise<{ stdout: string; stderr: string }> => {
  // Try all known Git paths directly
  for (const gitPath of commonGitPaths) {
    try {
      /*
       * Try executing with the direct path - don't use quotes as they can cause issues
       * We don't use the standard git executable name at all
       */
      return await execCommand(`${gitPath} ${args}`, options);
    } catch {
      // Try next path
      continue;
    }
  }

  // If all direct attempts fail, throw error
  throw new Error('Could not find Git executable in any known location');
};

/**
 * Check if Git is installed and available (using direct path approach)
 * Returns true if Git is available, false otherwise
 */
export const isDirectGitAvailable = async (): Promise<boolean> => {
  try {
    const { stdout } = await execDirectGit('--version');
    return stdout.trim().toLowerCase().includes('git version');
  } catch {
    return false;
  }
};

/**
 * Get information about the current Git repository using direct child_process execution
 */
export const getDirectGitInfoSync = async (): Promise<{
  isGitRepo: boolean;
  currentBranch?: string;
  currentCommit?: string;
  remotes?: { name: string; url: string }[];
}> => {
  try {
    // Import directly to avoid ESM/CommonJS conflicts
    const { execSync } = await import('child_process');
    const gitPath = '/opt/homebrew/bin/git';

    // Get current working directory
    let workingDir;

    try {
      workingDir = execSync('pwd', { encoding: 'utf8' }).trim();
    } catch {
      // Use default working dir if we can't get it
      workingDir = process.cwd();
    }

    // Check if we're in a Git repository
    try {
      execSync(`${gitPath} rev-parse --is-inside-work-tree`, {
        encoding: 'utf8',
        cwd: workingDir,
      });
    } catch {
      return { isGitRepo: false };
    }

    // Get current branch
    let currentBranch = '';

    try {
      currentBranch = execSync(`${gitPath} branch --show-current`, {
        encoding: 'utf8',
        cwd: workingDir,
      }).trim();
    } catch {
      // Not critical if we can't get branch
    }

    // Get current commit
    let currentCommit = '';

    try {
      currentCommit = execSync(`${gitPath} rev-parse --short HEAD`, {
        encoding: 'utf8',
        cwd: workingDir,
      }).trim();
    } catch {
      // Not critical if we can't get commit
    }

    // Get remotes
    const remotes: { name: string; url: string }[] = [];

    try {
      const remotesOutput = execSync(`${gitPath} remote -v`, {
        encoding: 'utf8',
        cwd: workingDir,
      });

      // Parse remotes (format: "name url (fetch/push)")
      remotesOutput.split('\n').forEach((line) => {
        if (!line.trim()) {
          return;
        }

        const [name, url] = line.split('\t');

        if (name && url && url.includes('(fetch)')) {
          remotes.push({
            name,
            url: url.replace(' (fetch)', '').trim(),
          });
        }
      });
    } catch {
      // Not critical if we can't get remotes
    }

    return {
      isGitRepo: true,
      currentBranch,
      currentCommit,
      remotes,
    };
  } catch (error) {
    console.error('Error getting Git info:', error);
    return { isGitRepo: false };
  }
};

/**
 * Check if Git is installed and available
 * Returns true if Git is available, false otherwise
 */
export const isGitAvailable = async (): Promise<boolean> => {
  try {
    const { stdout } = await execCommand('git --version');
    return stdout.trim().toLowerCase().includes('git version');
  } catch {
    // Try with full paths if the command fails
    for (const gitPath of commonGitPaths) {
      try {
        const { stdout } = await execCommand(`${gitPath} --version`);

        if (stdout.trim().toLowerCase().includes('git version')) {
          return true;
        }
      } catch {
        // Continue to next path
      }
    }
    return false;
  }
};

/**
 * Execute Git command with fallback to full path if git is not in PATH
 */
export const execGitCommand = async (
  args: string,
  options: { timeout?: number; cwd?: string } = {},
): Promise<{ stdout: string; stderr: string }> => {
  try {
    // First try with standard git command
    return await execCommand(`git ${args}`, options);
  } catch (error) {
    // If that fails, try with full paths
    for (const gitPath of commonGitPaths) {
      try {
        // Use the full git path as the command, not as an argument to git
        return await execCommand(`"${gitPath}" ${args}`, options);
      } catch {
        // Continue to next path
      }
    }

    // If all attempts fail, throw the original error
    throw error;
  }
};

/**
 * Get information about the current Git repository
 */
export const getGitInfo = async (): Promise<{
  isGitRepo: boolean;
  currentBranch?: string;
  currentCommit?: string;
  remotes?: { name: string; url: string }[];
}> => {
  try {
    // Check if we're in a Git repository
    try {
      await execGitCommand('rev-parse --is-inside-work-tree');
    } catch {
      return { isGitRepo: false };
    }

    // Get current branch
    const { stdout: branchOutput } = await execGitCommand('branch --show-current');
    const currentBranch = branchOutput.trim();

    // Get current commit
    const { stdout: commitOutput } = await execGitCommand('rev-parse --short HEAD');
    const currentCommit = commitOutput.trim();

    // Get remotes
    const { stdout: remotesOutput } = await execGitCommand('remote -v');

    // Create remotes array
    const remotes: { name: string; url: string }[] = [];

    // Parse remotes (format: "name url (fetch/push)")
    remotesOutput.split('\n').forEach((line) => {
      if (!line.trim()) {
        return;
      }

      const [name, url] = line.split('\t');

      if (name && url && url.includes('(fetch)')) {
        remotes.push({
          name,
          url: url.replace(' (fetch)', '').trim(),
        });
      }
    });

    return {
      isGitRepo: true,
      currentBranch,
      currentCommit,
      remotes,
    };
  } catch (error) {
    console.error('Error getting Git info:', error);
    return { isGitRepo: false };
  }
};

/**
 * Diagnose Git setup issues and provide solutions
 * Returns detailed information about Git configuration and possible solutions
 */
export const diagnoseGitIssues = async (): Promise<{
  isGitInstalled: boolean;
  isGitRepo: boolean;
  hasOriginRemote: boolean;
  gitVersion?: string;
  gitPath?: string;
  systemPath?: string;
  possibleSolutions: string[];
}> => {
  const result = {
    isGitInstalled: false,
    isGitRepo: false,
    hasOriginRemote: false,
    gitVersion: undefined as string | undefined,
    gitPath: undefined as string | undefined,
    systemPath: undefined as string | undefined,
    possibleSolutions: [] as string[],
  };

  try {
    // Get system PATH to help with diagnostics
    try {
      const { stdout: pathOutput } = await execCommand('echo $PATH');
      result.systemPath = pathOutput.trim();
    } catch {
      // Not critical if we can't get PATH
    }

    // First try the standard isGitAvailable
    let gitAvailable = await isGitAvailable();

    // If standard approach failed, try with direct path
    if (!gitAvailable) {
      gitAvailable = await isDirectGitAvailable();
    }

    if (gitAvailable) {
      result.isGitInstalled = true;

      try {
        // Try to get Git version, first with regular method
        try {
          const { stdout } = await execGitCommand('--version');
          result.gitVersion = stdout.trim();
        } catch {
          // Then with direct method
          const { stdout } = await execDirectGit('--version');
          result.gitVersion = stdout.trim();
        }
      } catch {
        console.error('Strange: Git was found but version command failed');
      }
    } else {
      result.isGitInstalled = false;

      // Check if Git is installed in common locations but not in PATH
      try {
        // Check Homebrew Git location (common on macOS)
        const { stdout: homebrewGit } = await execCommand('ls /opt/homebrew/bin/git || ls /usr/local/bin/git');

        if (homebrewGit.trim()) {
          result.possibleSolutions.push(
            'Git is installed but not in your PATH. Try running: export PATH="/opt/homebrew/bin:$PATH"',
            'For permanent fix, add the line above to your ~/.zshrc or ~/.bash_profile',
            'Then restart your terminal and the application',
          );
        } else {
          result.possibleSolutions.push(
            'Verify Git is installed correctly: git --version',
            'Make sure Git is in your system PATH',
            'Install Git from https://git-scm.com/downloads',
          );
        }
      } catch {
        // Standard Git not found solutions
        result.possibleSolutions.push(
          'Verify Git is installed correctly: git --version',
          'Make sure Git is in your system PATH',
          'Install Git from https://git-scm.com/downloads',
        );
      }

      return result;
    }

    // Get Git path by checking common locations
    for (const gitPath of commonGitPaths) {
      try {
        const { stdout } = await execCommand(`${gitPath} --version`);

        if (stdout.trim().toLowerCase().includes('git version')) {
          result.gitPath = gitPath;
          break;
        }
      } catch {
        // Continue to next path
      }
    }

    if (!result.gitPath) {
      // Fallback to which/where if we couldn't find it
      try {
        const { stdout: whichOutput } = await execCommand('which git || where git');
        result.gitPath = whichOutput.trim();
      } catch {
        // Not critical if we can't determine path
      }
    }

    // Use getGitInfo with fallback to direct Git
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

    result.isGitRepo = gitInfo.isGitRepo;

    if (!result.isGitRepo) {
      result.possibleSolutions.push(
        'This is not a Git repository. Initialize with: git init',
        'Or clone the repository: git clone https://github.com/stackblitz-labs/bolt.diy.git',
      );
    } else {
      // Check for origin remote if it's a Git repo
      const remotes = gitInfo.remotes || [];
      result.hasOriginRemote = remotes.some((r) => r.name === 'origin');

      if (!result.hasOriginRemote) {
        result.possibleSolutions.push(
          'Add GitHub as remote: git remote add origin https://github.com/stackblitz-labs/bolt.diy.git',
        );
      }
    }

    // Add general solutions if we have issues
    if (!result.isGitRepo || !result.hasOriginRemote) {
      result.possibleSolutions.push('Restart Bolt after making changes');
    }

    return result;
  } catch (error) {
    console.error('Error diagnosing Git issues:', error);
    result.possibleSolutions.push(
      'Unknown error occurred while diagnosing Git. Check the console for more details.',
      'Make sure Git is properly installed and in your PATH',
    );

    return result;
  }
};

/**
 * Execute Git commands using Node's child_process.execSync
 * This is a last resort direct method that bypasses all wrappers and directly executes Git
 */
export const execDirectGitSync = async (
  args: string,
  options: { timeout?: number; cwd?: string } = {},
): Promise<{ stdout: string; stderr: string }> => {
  try {
    // Import directly to avoid ESM/CommonJS conflicts
    const { execSync } = await import('child_process');

    // Get working directory if not provided
    const workingDir = options.cwd || process.cwd();

    // On macOS, directly try the homebrew Git location first as we know it works
    try {
      const stdout = execSync(`/opt/homebrew/bin/git ${args}`, {
        encoding: 'utf8',
        timeout: options.timeout,
        cwd: workingDir,
      });

      return { stdout, stderr: '' };
    } catch {
      // If homebrew Git fails, try other locations
    }

    // Try all other known Git paths
    for (const gitPath of commonGitPaths) {
      // Skip the homebrew path as we already tried it
      if (gitPath === '/opt/homebrew/bin/git') {
        continue;
      }

      try {
        // Execute directly without any wrappers
        const stdout = execSync(`${gitPath} ${args}`, {
          encoding: 'utf8',
          timeout: options.timeout,
          cwd: workingDir,
        });

        return { stdout, stderr: '' };
      } catch {
        // Try next path
        continue;
      }
    }

    // If all direct attempts fail, throw error
    throw new Error('Could not find Git executable in any known location');
  } catch (error) {
    throw error;
  }
};

/**
 * Super fallback Git availability check using direct sync execution
 * Returns true if Git is available, false otherwise
 */
export const isDirectGitSyncAvailable = async (): Promise<boolean> => {
  try {
    // Import directly to avoid ESM/CommonJS conflicts
    const { execSync } = await import('child_process');

    // Try the homebrew Git location directly first as we know it works
    try {
      const stdout = execSync('/opt/homebrew/bin/git --version', { encoding: 'utf8' });
      return stdout.trim().toLowerCase().includes('git version');
    } catch {
      // If homebrew Git fails, try other locations
      for (const gitPath of commonGitPaths) {
        // Skip the homebrew path as we already tried it
        if (gitPath === '/opt/homebrew/bin/git') {
          continue;
        }

        try {
          const stdout = execSync(`${gitPath} --version`, { encoding: 'utf8' });
          return stdout.trim().toLowerCase().includes('git version');
        } catch {
          // Try next path
          continue;
        }
      }
    }

    return false;
  } catch {
    return false;
  }
};

/**
 * Ultimate Git execution function that tries all available methods
 * This is the function to use for Git commands, as it will try all methods in order
 */
export const execGitUltimate = async (
  args: string,
  options: { timeout?: number; cwd?: string } = {},
): Promise<{ stdout: string; stderr: string }> => {
  try {
    // Method 1: Try with standard git command
    try {
      return await execCommand(`git ${args}`, options);
    } catch {
      // Continue to next method
    }

    // Method 2: Try with our path-fallback execGitCommand
    try {
      return await execGitCommand(args, options);
    } catch {
      // Continue to next method
    }

    // Method 3: Try with direct execDirectGit
    try {
      return await execDirectGit(args, options);
    } catch {
      // Continue to next method
    }

    // Method 4: Last resort - direct child_process.execSync
    return await execDirectGitSync(args, options);
  } catch (error) {
    // If all methods fail, throw the error
    throw error;
  }
};
