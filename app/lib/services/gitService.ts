export interface GitService {
  createBranch(projectGitUrl: string, branch: string, from?: string): Promise<string>;
  switchBranch(projectGitUrl: string, branch: string): Promise<string>;
}

// Placeholder; to be wired to WebContainer + isomorphic-git abstraction
export const gitService: GitService = {
  async createBranch() {
    throw new Error('gitService.createBranch not implemented');
  },
  async switchBranch() {
    throw new Error('gitService.switchBranch not implemented');
  },
};
