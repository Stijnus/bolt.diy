/**
 * Server-side utilities for the Bolt application
 * Contains utilities for safe command execution and other server operations
 */
import { isCloudEnvironment } from './environment';
import { execSync } from 'child_process';

/**
 * Type for Node.js platform strings that we support
 */
type SupportedPlatform = 'darwin' | 'linux' | 'win32';

/**
 * Common paths where Git might be installed
 */
const commonGitPaths: Record<SupportedPlatform, string[]> = {
  darwin: ['/opt/homebrew/bin/git', '/usr/local/bin/git', '/usr/bin/git'],
  linux: ['/usr/bin/git', '/usr/local/bin/git'],
  win32: ['C:\\Program Files\\Git\\bin\\git.exe', 'C:\\Program Files (x86)\\Git\\bin\\git.exe'],
};

/**
 * Helper function to safely get platform-specific Git paths
 */
export const getPlatformGitPaths = (): string[] => {
  const platform = process.platform as string;

  // Check if the platform is supported
  if (platform === 'darwin' || platform === 'linux' || platform === 'win32') {
    return commonGitPaths[platform as SupportedPlatform];
  }

  // Default to Linux paths for unsupported platforms
  console.warn(`Unsupported platform: ${platform}, defaulting to Linux paths`);

  return commonGitPaths.linux;
};

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
 * Execute Git command directly with a specific path
 */
export const execDirectGit = async (
  args: string,
  options: { timeout?: number; cwd?: string } = {},
): Promise<{ stdout: string; stderr: string }> => {
  try {
    // Try to find git in PATH first
    try {
      const { stdout: gitPathOutput } = await execCommand('which git');
      const gitPath = gitPathOutput.trim();

      if (gitPath) {
        return await execCommand(`${gitPath} ${args}`, options);
      }
    } catch {
      // Continue to fallback paths if which fails
    }

    // Try each common git path
    for (const gitPath of getPlatformGitPaths()) {
      try {
        // Use quotes around the path if it contains spaces (Windows paths often do)
        const command =
          process.platform === 'win32' && gitPath.includes(' ') ? `"${gitPath}" ${args}` : `${gitPath} ${args}`;

        return await execCommand(command, options);
      } catch {
        // Try next path
        continue;
      }
    }

    throw new Error('Git not found in any common location');
  } catch (error) {
    throw error;
  }
};

/**
 * Get Git info synchronously
 */
export const getDirectGitInfoSync = (): {
  isGitRepo: boolean;
  currentBranch?: string;
  currentCommit?: string;
  remotes?: { name: string; url: string }[];
} => {
  try {
    // Check if we're in a Git repository
    try {
      execSync('git rev-parse --is-inside-work-tree', { encoding: 'utf8' });
    } catch {
      // Try with direct paths
      let found = false;

      for (const gitPath of getPlatformGitPaths()) {
        try {
          execSync(`"${gitPath}" rev-parse --is-inside-work-tree`, { encoding: 'utf8' });
          found = true;
          break;
        } catch {
          // Try next path
          continue;
        }
      }

      if (!found) {
        return { isGitRepo: false };
      }
    }

    // Function to execute git command with fallback to direct paths
    const execGitSync = (cmd: string): string => {
      try {
        return execSync(`git ${cmd}`, { encoding: 'utf8' }).trim();
      } catch {
        // Try with direct paths
        for (const gitPath of getPlatformGitPaths()) {
          try {
            return execSync(`"${gitPath}" ${cmd}`, { encoding: 'utf8' }).trim();
          } catch {
            // Try next path
            continue;
          }
        }
        return '';
      }
    };

    // Get current branch
    const currentBranch = execGitSync('branch --show-current');

    // Get current commit
    const currentCommit = execGitSync('rev-parse --short HEAD');

    // Get remotes
    const remotesOutput = execGitSync('remote -v');

    // Create remotes array
    const remotes: { name: string; url: string }[] = [];

    if (remotesOutput) {
      const remoteLines = remotesOutput.split('\n');

      for (const line of remoteLines) {
        if (!line.trim()) {
          continue;
        }

        const match = line.match(/^(\S+)\s+(\S+)\s+\((\S+)\)$/);

        if (match && match[3] === 'fetch') {
          remotes.push({
            name: match[1],
            url: match[2],
          });
        }
      }
    }

    return {
      isGitRepo: true,
      currentBranch: currentBranch || undefined,
      currentCommit: currentCommit || undefined,
      remotes: remotes.length > 0 ? remotes : undefined,
    };
  } catch {
    // Ignore error details and just return not a git repo
    return { isGitRepo: false };
  }
};

/**
 * Get information about the current Git repository using direct child_process execution
 */
export const getDirectGitInfo = async (): Promise<{
  isGitRepo: boolean;
  currentBranch?: string;
  currentCommit?: string;
  remotes?: { name: string; url: string }[];
}> => {
  try {
    // Import directly to avoid ESM/CommonJS conflicts
    const { execSync } = await import('child_process');

    // Find the Git executable path
    let gitPath = '';

    // Try to find Git using 'which' command first
    try {
      gitPath = execSync('which git', { encoding: 'utf8' }).trim();
    } catch {
      // If 'which' fails, try each common path
      for (const path of getPlatformGitPaths()) {
        try {
          execSync(`${path} --version`, { encoding: 'utf8' });
          gitPath = path;
          break;
        } catch {
          // Continue to next path
        }
      }
    }

    // If we still don't have a valid Git path, return early
    if (!gitPath) {
      console.error('Could not find Git executable');
      return { isGitRepo: false };
    }

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
 * Check if Git is installed by trying to execute the git command
 */
export const isGitInstalled = async (): Promise<boolean> => {
  try {
    const { stdout } = await execCommand('git --version');
    return stdout.trim().toLowerCase().includes('git version');
  } catch {
    // Try with full paths if the command fails
    for (const gitPath of getPlatformGitPaths()) {
      try {
        const { stdout } = await execCommand(`${gitPath} --version`);

        if (stdout.trim().toLowerCase().includes('git version')) {
          return true;
        }
      } catch {
        // Try next path
        continue;
      }
    }

    return false;
  }
};

/**
 * Execute Git commands with fallback to direct paths
 */
export const execGit = async (
  args: string,
  options: { timeout?: number; cwd?: string } = {},
): Promise<{ stdout: string; stderr: string }> => {
  try {
    // Try with standard git command first
    return await execCommand(`git ${args}`, options);
  } catch (error) {
    // If that fails, try with full paths
    for (const gitPath of getPlatformGitPaths()) {
      try {
        // Use the full git path as the command, not as an argument to git
        return await execCommand(`"${gitPath}" ${args}`, options);
      } catch {
        // Try next path
        continue;
      }
    }

    // If all attempts fail, throw the original error
    throw error;
  }
};

/**
 * Execute Git command with fallback to direct paths
 */
export const execGitWithFallback = async (
  args: string,
  options: { timeout?: number; cwd?: string } = {},
): Promise<{ stdout: string; stderr: string }> => {
  // Method 1: Try with standard git command
  try {
    return await execCommand(`git ${args}`, options);
  } catch {
    // Continue to next method
  }

  // Method 2: Try with our path-fallback execGit
  try {
    return await execGit(args, options);
  } catch {
    // Continue to next method
  }

  // Method 3: Try each common git path directly
  for (const gitPath of getPlatformGitPaths()) {
    try {
      return await execCommand(`"${gitPath}" ${args}`, options);
    } catch {
      // Try next path
      continue;
    }
  }

  // If all methods fail, throw error
  throw new Error(`Failed to execute Git command: ${args}`);
};

/**
 * Check for Git updates
 */
export const checkGitUpdates = async (): Promise<{
  hasUpdates: boolean;
  currentCommit?: string;
  latestCommit?: string;
  behindCount?: number;
  error?: string;
}> => {
  try {
    // First check if we're in a Git repository
    const gitInfo = await getDirectGitInfo();

    if (!gitInfo.isGitRepo) {
      return { hasUpdates: false, error: 'Not a Git repository' };
    }

    // Get current commit
    const { stdout: currentCommitOutput } = await execGitWithFallback('rev-parse HEAD');
    const currentCommit = currentCommitOutput.trim();

    // Fetch from remote to get latest changes
    try {
      await execGitWithFallback('fetch');
    } catch (error) {
      return {
        hasUpdates: false,
        currentCommit,
        error: `Failed to fetch from remote: ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    // Get the latest commit on the remote branch
    try {
      // Get current branch
      const { stdout: branchOutput } = await execGitWithFallback('branch --show-current');
      const currentBranch = branchOutput.trim();

      // Get remote for current branch
      const { stdout: remoteOutput } = await execGitWithFallback(`config --get branch.${currentBranch}.remote`);
      const remote = remoteOutput.trim() || 'origin';

      // Get latest commit on remote branch
      const { stdout: latestCommitOutput } = await execGitWithFallback(`rev-parse ${remote}/${currentBranch}`);
      const latestCommit = latestCommitOutput.trim();

      // Check if we're behind the remote
      const { stdout: behindOutput } = await execGitWithFallback(`rev-list --count ${currentCommit}..${latestCommit}`);
      const behindCount = parseInt(behindOutput.trim(), 10);

      return {
        hasUpdates: behindCount > 0,
        currentCommit,
        latestCommit,
        behindCount,
      };
    } catch (error) {
      return {
        hasUpdates: false,
        currentCommit,
        error: `Failed to check for updates: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  } catch (error) {
    return {
      hasUpdates: false,
      error: `Error checking for updates: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

/**
 * Pull latest changes from Git
 */
export const pullGitUpdates = async (): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> => {
  try {
    // First check if we're in a Git repository
    const gitInfo = await getDirectGitInfo();

    if (!gitInfo.isGitRepo) {
      return { success: false, error: 'Not a Git repository' };
    }

    // Pull latest changes
    try {
      const { stdout } = await execGitWithFallback('pull');
      return { success: true, message: stdout.trim() };
    } catch (error) {
      return {
        success: false,
        error: `Failed to pull updates: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: `Error pulling updates: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

/**
 * Check if Git is installed at the Homebrew path
 */
export const isHomebrewGitInstalled = async (): Promise<boolean> => {
  try {
    const { stdout } = await execCommand('/opt/homebrew/bin/git --version');
    return stdout.trim().toLowerCase().includes('git version');
  } catch {
    // If homebrew Git fails, try other locations
    for (const gitPath of getPlatformGitPaths()) {
      // Skip the homebrew path as we already tried it
      if (gitPath === '/opt/homebrew/bin/git') {
        continue;
      }

      try {
        const { stdout } = await execCommand(`${gitPath} --version`);

        if (stdout.trim().toLowerCase().includes('git version')) {
          return true;
        }
      } catch {
        // Try next path
        continue;
      }
    }

    return false;
  }
};

/**
 * Get diagnostic information about Git
 */
export const getGitDiagnostic = async (): Promise<{
  gitInstalled: boolean;
  gitPath?: string;
  gitVersion?: string;
  gitPaths?: string[];
  systemPath?: string;
  error?: string;
}> => {
  const result: {
    gitInstalled: boolean;
    gitPath?: string;
    gitVersion?: string;
    gitPaths?: string[];
    systemPath?: string;
    error?: string;
  } = {
    gitInstalled: false,
  };

  try {
    // Get system PATH
    try {
      const { stdout } = await execCommand('echo $PATH');
      result.systemPath = stdout.trim();
    } catch {
      // Not critical if we can't get PATH
    }

    // First try the standard isGitInstalled
    let gitAvailable = await isGitInstalled();

    // If standard approach failed, try with direct path
    if (!gitAvailable) {
      try {
        await execDirectGit('--version');
        gitAvailable = true;
      } catch {
        // Git is not available
      }
    }

    result.gitInstalled = gitAvailable;

    if (gitAvailable) {
      try {
        // Try to get Git version, first with regular method
        try {
          const { stdout } = await execGit('--version');
          result.gitVersion = stdout.trim();
        } catch {
          // Then with direct method
          const { stdout } = await execDirectGit('--version');
          result.gitVersion = stdout.trim();
        }

        // Try to get Git path using 'which git' first
        let foundPath: string | undefined = undefined;

        try {
          const { stdout } = await execCommand('which git');
          foundPath = stdout.trim();
          result.gitPath = foundPath;
        } catch {
          // 'which git' failed, proceed to check common paths
          console.warn("'which git' command failed, checking common paths.");

          for (const path of getPlatformGitPaths()) {
            try {
              /*
               * Check if the path exists and is executable, then verify version
               * Note: Simple existence check might be sufficient and less error-prone
               * For now, just try executing; suppress specific 'No such file' errors
               */
              const { stdout } = await execCommand(`${path} --version`);

              if (stdout.trim().toLowerCase().includes('git version')) {
                result.gitPath = path;
                break; // Found a working path
              }
            } catch (pathError) {
              // Log only if it's not a 'command not found' or 'No such file' error
              const errorMsg = String(pathError);

              if (!errorMsg.includes('No such file or directory') && !errorMsg.includes('command not found')) {
                console.warn(`Error checking git path ${path}:`, pathError);
              }

              // Try next path
              continue;
            }
          }
        }
      } catch (error) {
        result.error = `Error getting Git info: ${error instanceof Error ? error.message : String(error)}`;
      }
    }

    // Add all possible Git paths for reference
    result.gitPaths = getPlatformGitPaths();

    return result;
  } catch (error) {
    return {
      gitInstalled: false,
      error: `Error getting Git diagnostic: ${error instanceof Error ? error.message : String(error)}`,
    };
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

    // Try all other known Git paths
    for (const gitPath of getPlatformGitPaths()) {
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

    // Try all other known Git paths
    for (const gitPath of getPlatformGitPaths()) {
      try {
        const stdout = execSync(`${gitPath} --version`, { encoding: 'utf8' });
        return stdout.trim().toLowerCase().includes('git version');
      } catch {
        // Try next path
        continue;
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
      return await execGit(args, options);
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
