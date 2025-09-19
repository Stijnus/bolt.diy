import { useCallback } from 'react';
import type { Branch } from '~/components/projects/types';
import { gitService } from '~/lib/services/gitService';
import { fileSystemService } from '~/lib/services/fileSystemService';
import { useGit } from '~/lib/hooks/useGit';

export function useGitOperations() {
  const { ready: gitReady } = useGit();

  const createGitBranch = useCallback(
    async (projectGitUrl: string, branchName: string, branchFrom: string = 'main'): Promise<Branch> => {
      if (!gitReady) {
        throw new Error('Git system is not ready.');
      }

      return gitService.createBranch(projectGitUrl, branchName, branchFrom);
    },
    [gitReady],
  );

  const switchToBranch = useCallback(
    async (projectGitUrl: string, branchName: string, _branchFrom?: string): Promise<string> => {
      if (!gitReady) {
        throw new Error('Git system is not ready.');
      }

      const result = await gitService.switchBranch(projectGitUrl, branchName);

      // Reload files after branch switch
      try {
        const { container, dir } = await gitService.ensureRepoInWebContainer(projectGitUrl);
        await fileSystemService.reloadProjectFiles(container, dir);
        console.log(`Successfully switched to branch '${branchName}' and reloaded project files`);
      } catch (error) {
        console.error('Failed to reload project files after branch switch:', error);

        // Don't throw - branch switch was successful
      }

      return result;
    },
    [gitReady],
  );

  const ensureRepoInWebContainer = useCallback(
    async (projectGitUrl: string) => {
      if (!gitReady) {
        throw new Error('Git system is not ready.');
      }

      return gitService.ensureRepoInWebContainer(projectGitUrl);
    },
    [gitReady],
  );

  const readBranchMetadata = useCallback(async (fs: any, dir: string, branchName: string): Promise<Branch> => {
    return gitService.readBranchMetadata(fs, dir, branchName);
  }, []);

  return {
    createGitBranch,
    switchToBranch,
    ensureRepoInWebContainer,
    readBranchMetadata,
    gitReady,
  };
}
