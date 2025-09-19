/**
 * Git utility functions for URL normalization, validation, and manipulation
 */

export interface GitUrlInfo {
  host: string;
  owner: string;
  repo: string;
  protocol: 'https' | 'ssh' | 'git';
  normalized: string;
}

/**
 * Normalizes a Git URL to HTTPS format
 */
export function normalizeGitUrl(gitUrl: string): string {
  if (gitUrl.startsWith('git@')) {
    const withoutPrefix = gitUrl.replace(/^git@/, '');
    const [host, repoPath] = withoutPrefix.split(':');

    return `https://${host}/${repoPath}`;
  }

  if (gitUrl.startsWith('ssh://git@')) {
    return gitUrl.replace('ssh://git@', 'https://');
  }

  return gitUrl;
}

/**
 * Parses a Git URL and extracts information
 */
export function parseGitUrl(gitUrl: string): GitUrlInfo | null {
  try {
    const normalized = normalizeGitUrl(gitUrl);
    const url = new URL(normalized);

    const pathParts = url.pathname.split('/').filter(Boolean);

    if (pathParts.length < 2) {
      return null;
    }

    const owner = pathParts[0];
    const repo = pathParts[1].replace(/\.git$/, '');

    let protocol: 'https' | 'ssh' | 'git' = 'https';

    if (gitUrl.startsWith('git@')) {
      protocol = 'git';
    } else if (gitUrl.startsWith('ssh://')) {
      protocol = 'ssh';
    }

    return {
      host: url.hostname,
      owner,
      repo,
      protocol,
      normalized,
    };
  } catch {
    return null;
  }
}

/**
 * Validates if a URL is a valid Git repository URL
 */
export function isValidGitUrl(gitUrl: string): boolean {
  if (!gitUrl || typeof gitUrl !== 'string') {
    return false;
  }

  // Check for valid Git URL patterns
  const patterns = [
    /^https?:\/\/.+\/.+/, // HTTPS
    /^git@.+:.+/, // SSH with git@
    /^ssh:\/\/git@.+\/.+/, // SSH with ssh://
  ];

  return patterns.some((pattern) => pattern.test(gitUrl));
}

/**
 * Extracts repository name from Git URL
 */
export function getRepoName(gitUrl: string): string {
  const info = parseGitUrl(gitUrl);
  return info?.repo || (gitUrl?.split('/')?.pop() || 'project').replace(/\.git$/, '') || 'project';
}

/**
 * Generates a project name from Git URL
 */
export function generateProjectName(gitUrl: string): string {
  const info = parseGitUrl(gitUrl);

  if (info) {
    return `${info.owner}/${info.repo}`;
  }

  return getRepoName(gitUrl);
}

/**
 * Validates and sanitizes a branch name
 */
export function sanitizeBranchName(branchName: string): string {
  if (!branchName || typeof branchName !== 'string') {
    throw new Error('Branch name must be a non-empty string');
  }

  const sanitized = branchName.trim().replace(/[^a-zA-Z0-9\-_\/]/g, '-');

  if (sanitized.length === 0) {
    throw new Error('Branch name cannot be empty after sanitization');
  }

  return sanitized;
}

/**
 * Checks if a branch name is valid
 */
export function isValidBranchName(branchName: string): boolean {
  if (!branchName || typeof branchName !== 'string' || branchName.trim().length === 0) {
    return false;
  }

  // Git branch name restrictions
  const invalidPatterns = [
    /^\./, // Cannot start with a dot
    /\.\.$/, // Cannot end with two dots
    /\/\//, // Cannot have consecutive slashes
    /^\//, // Cannot start with a slash
    /\/$/, // Cannot end with a slash
    /[\x00-\x1f\x7f]/, // No control characters
    /[~^:?*\[]/, // No special characters
    /\s/, // No whitespace
  ];

  return !invalidPatterns.some((pattern) => pattern.test(branchName));
}

/**
 * Path utility functions for Git operations
 */
export const pathUtils = {
  dirname: (path: string): string => {
    if (!path || !path.includes('/')) {
      return '.';
    }

    const normalized = path.replace(/\/+$/, '');

    return normalized.split('/').slice(0, -1).join('/') || '.';
  },

  basename: (path: string): string => {
    const normalized = path.replace(/\/+$/, '');
    return normalized.split('/').pop() || '';
  },

  relative: (from: string, to: string): string => {
    if (!from || !to) {
      return '.';
    }

    const normalize = (segment: string) => segment.replace(/\/+$/, '').split('/').filter(Boolean);
    const fromParts = normalize(from);
    const toParts = normalize(to);

    let commonLength = 0;
    const minLength = Math.min(fromParts.length, toParts.length);

    for (let i = 0; i < minLength; i++) {
      if (fromParts[i] !== toParts[i]) {
        break;
      }

      commonLength++;
    }

    const upLevels = fromParts.length - commonLength;
    const remaining = toParts.slice(commonLength);

    const relativeParts = [...Array(upLevels).fill('..'), ...remaining];

    return relativeParts.length === 0 ? '.' : relativeParts.join('/');
  },

  join: (...paths: string[]): string => {
    return paths.filter(Boolean).join('/').replace(/\/+/g, '/').replace(/^\/+/, '/');
  },
};
