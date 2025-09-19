import type { GitInfo, GitStatus } from './simpleTypes';

export class SimpleGitService {
  /**
   * Check if a git repository is accessible
   * This uses a simple fetch to check if the repository exists and is public
   */
  static async checkGitRepository(gitUrl: string): Promise<GitInfo> {
    try {
      // Parse the git URL to determine the provider and repo info
      const repoInfo = this.parseGitUrl(gitUrl);

      if (!repoInfo) {
        return {
          status: 'inaccessible',
          error: 'Invalid Git URL format',
          lastChecked: new Date().toISOString(),
        };
      }

      // For GitHub repositories, we can check accessibility via API
      if (repoInfo.provider === 'github') {
        return await this.checkGitHubRepository(repoInfo.owner, repoInfo.repo);
      }

      // For other providers, we'll try a simple HEAD request
      return await this.checkGenericRepository(gitUrl);
    } catch (error) {
      console.error('Error checking git repository:', error);
      return {
        status: 'inaccessible',
        error: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: new Date().toISOString(),
      };
    }
  }

  /**
   * Parse Git URL to extract provider, owner, and repo
   */
  private static parseGitUrl(gitUrl: string): { provider: string; owner: string; repo: string } | null {
    try {
      // Handle GitHub URLs
      const githubHttpsMatch = gitUrl.match(/https:\/\/github\.com\/([^\/]+)\/([^\/]+)(?:\.git)?/);

      if (githubHttpsMatch) {
        return {
          provider: 'github',
          owner: githubHttpsMatch[1],
          repo: githubHttpsMatch[2].replace('.git', ''),
        };
      }

      const githubSshMatch = gitUrl.match(/git@github\.com:([^\/]+)\/([^\/]+)(?:\.git)?/);

      if (githubSshMatch) {
        return {
          provider: 'github',
          owner: githubSshMatch[1],
          repo: githubSshMatch[2].replace('.git', ''),
        };
      }

      // Handle GitLab URLs
      const gitlabMatch = gitUrl.match(/https:\/\/gitlab\.com\/([^\/]+)\/([^\/]+)(?:\.git)?/);

      if (gitlabMatch) {
        return {
          provider: 'gitlab',
          owner: gitlabMatch[1],
          repo: gitlabMatch[2].replace('.git', ''),
        };
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Check GitHub repository using GitHub API
   */
  private static async checkGitHubRepository(owner: string, repo: string): Promise<GitInfo> {
    try {
      // Check repository info
      const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'bolt.diy',
        },
      });

      if (!repoResponse.ok) {
        if (repoResponse.status === 404) {
          return {
            status: 'inaccessible',
            error: 'Repository not found or is private',
            lastChecked: new Date().toISOString(),
          };
        }

        throw new Error(`GitHub API error: ${repoResponse.status}`);
      }

      const repoData = await repoResponse.json();

      // Get branches
      const branchesResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches`, {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'bolt.diy',
        },
      });

      let branches: string[] = [];

      if (branchesResponse.ok) {
        const branchesData = await branchesResponse.json();

        if (Array.isArray(branchesData)) {
          branches = branchesData.map((branch: any) => branch.name);
        }
      }

      return {
        status: 'accessible',
        defaultBranch: (repoData as any).default_branch,
        branches,
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error checking GitHub repository:', error);
      return {
        status: 'inaccessible',
        error: error instanceof Error ? error.message : 'Failed to check repository',
        lastChecked: new Date().toISOString(),
      };
    }
  }

  /**
   * Check generic repository with HEAD request
   */
  private static async checkGenericRepository(gitUrl: string): Promise<GitInfo> {
    try {
      // Try to convert to HTTPS URL for checking
      const httpsUrl = gitUrl.replace(/^git@([^:]+):/, 'https://$1/').replace(/\.git$/, '');

      const response = await fetch(httpsUrl, {
        method: 'HEAD',
        mode: 'no-cors', // This will limit what we can check, but avoids CORS issues
      });

      return {
        status: 'accessible',
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'inaccessible',
        error: 'Repository not accessible or CORS blocked',
        lastChecked: new Date().toISOString(),
      };
    }
  }

  /**
   * Get a user-friendly status message
   */
  static getStatusMessage(gitInfo: GitInfo): string {
    switch (gitInfo.status) {
      case 'accessible':
        return 'Repository is accessible';
      case 'inaccessible':
        return gitInfo.error || 'Repository is not accessible';
      case 'checking':
        return 'Checking repository...';
      case 'unknown':
      default:
        return 'Repository status unknown';
    }
  }

  /**
   * Get status color for UI
   */
  static getStatusColor(status: GitStatus): string {
    switch (status) {
      case 'accessible':
        return 'text-green-500';
      case 'inaccessible':
        return 'text-red-500';
      case 'checking':
        return 'text-yellow-500';
      case 'unknown':
      default:
        return 'text-gray-500';
    }
  }
}
