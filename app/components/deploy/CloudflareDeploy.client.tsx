import { toast } from 'react-toastify';
import { useStore } from '@nanostores/react';
import { cloudflareConnection } from '~/lib/stores/cloudflare';
import { workbenchStore } from '~/lib/stores/workbench';
import { webcontainer } from '~/lib/webcontainer';
import { path } from '~/utils/path';
import { useState } from 'react';
import type { ActionCallbackData } from '~/lib/runtime/message-parser';
import { chatId } from '~/lib/persistence/useChatHistory';

export function useCloudflareDeploy() {
  const [isDeploying, setIsDeploying] = useState(false);
  const cfConn = useStore(cloudflareConnection);
  const currentChatId = useStore(chatId);

  const handleCloudflareDeploy = async () => {
    if (!cfConn.token || !cfConn.accountId) {
      toast.error('Please connect to Cloudflare first in the settings tab!');
      return false;
    }

    if (!currentChatId) {
      toast.error('No active chat found. Please start or select a chat.');
      return false;
    }

    const artifact = workbenchStore.firstArtifact;
    if (!artifact) {
      toast.error('No active project found in the workbench.');
      return false;
    }

    try {
      setIsDeploying(true);

      const deploymentId = `deploy-cloudflare-${currentChatId}-${Date.now()}`;
      workbenchStore.addArtifact({
        id: deploymentId,
        messageId: deploymentId, // Or link to an existing message if appropriate
        title: 'Cloudflare Pages Deployment',
        type: 'standalone', // Or 'deployment' if such a type is defined
      });

      const deployArtifact = workbenchStore.artifacts.get()[deploymentId];
      if (!deployArtifact) {
        throw new Error('Failed to create deployment artifact.');
      }

      // 1. Build process
      deployArtifact.runner.handleDeployAction('building', 'running', { source: 'cloudflare' });

      const buildActionId = `build-${Date.now()}`;
      const buildActionData: ActionCallbackData = {
        messageId: `cloudflare-build-${currentChatId}`,
        artifactId: artifact.id,
        actionId: buildActionId,
        action: {
          type: 'build' as const,
          content: 'npm run build', // Or configurable build command
        },
      };

      artifact.runner.addAction(buildActionData);
      await artifact.runner.runAction(buildActionData);

      if (!artifact.runner.buildOutput || artifact.runner.buildOutput.status === 'failed') {
        const errorMessage = artifact.runner.buildOutput?.error || 'Build failed. Check the terminal for details.';
        deployArtifact.runner.handleDeployAction('building', 'failed', {
          error: errorMessage,
          source: 'cloudflare',
        });
        toast.error(errorMessage);
        throw new Error(errorMessage);
      }

      // 2. File preparation
      deployArtifact.runner.handleDeployAction('deploying', 'running', { source: 'cloudflare' });

      const container = await webcontainer;
      // Ensure buildOutput.path is relative to /home/project or absolute
      const rawBuildPath = artifact.runner.buildOutput.path.startsWith('/home/project')
        ? artifact.runner.buildOutput.path
        : path.join('/home/project', artifact.runner.buildOutput.path);

      const projectRelativeBuildPath = rawBuildPath.replace('/home/project', '');

      // List of common output directories to check
      const commonOutputDirs = [projectRelativeBuildPath, '/dist', '/build', '/out', '/output', '/public', '/.next'];
      let finalBuildPath = '';
      let buildPathExists = false;

      for (const dir of commonOutputDirs) {
        try {
          // WebContainer expects absolute paths starting from root '/'
          const checkDir = dir.startsWith('/') ? dir : `/${dir}`;
          await container.fs.readdir(checkDir.replace(/\/+/g, '/')); // Normalize multiple slashes
          finalBuildPath = checkDir.replace(/\/+/g, '/');
          buildPathExists = true;
          console.log(`Using build directory for Cloudflare: ${finalBuildPath}`);
          break;
        } catch (error) {
          console.log(`Directory ${dir} doesn't exist for Cloudflare, trying next. Error: ${(error as Error).message}`);
        }
      }

      if (!buildPathExists) {
        const errorMsg = 'Could not find build output directory. Please check your build configuration.';
        deployArtifact.runner.handleDeployAction('deploying', 'failed', { error: errorMsg, source: 'cloudflare' });
        toast.error(errorMsg);
        throw new Error(errorMsg);
      }

      async function getAllFiles(dirPath: string, basePath: string = dirPath): Promise<Record<string, { content: string, type: string }>> {
        const files: Record<string, { content: string, type: string }> = {};
        const entries = await container.fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          const relativePath = path.relative(basePath, fullPath).replace(/\\/g, '/'); // Ensure POSIX paths

          if (entry.isFile()) {
            const contentBuffer = await container.fs.readFile(fullPath);
            // For Cloudflare, we might need to send as base64 or handle binary files appropriately.
            // For now, assuming text files and sending content directly.
            // The API route will need to handle this.
            files[`/${relativePath}`] = { content: new TextDecoder().decode(contentBuffer), type: 'file' };
          } else if (entry.isDirectory()) {
            const subFiles = await getAllFiles(fullPath, basePath);
            Object.assign(files, subFiles);
          }
        }
        return files;
      }

      const fileContents = await getAllFiles(finalBuildPath);
      if (Object.keys(fileContents).length === 0) {
        const errorMsg = `No files found in the build directory: ${finalBuildPath}. Deployment aborted.`;
        deployArtifact.runner.handleDeployAction('deploying', 'failed', { error: errorMsg, source: 'cloudflare' });
        toast.error(errorMsg);
        throw new Error(errorMsg);
      }

      // 3. API Call
      const projectName = `bolt-cf-project-${currentChatId}`; // Simplified project name
      // Check for existing project ID (optional, depends on API design)
      const existingProjectId = localStorage.getItem(`cloudflare-project-${currentChatId}`);


      const response = await fetch('/api/cloudflare-deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: fileContents, // This structure might need adjustment based on API endpoint
          token: cfConn.token,
          accountId: cfConn.accountId,
          chatId: currentChatId,
          projectName: existingProjectId || projectName, // Send existing ID or new name
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const errorMsg = data.error || 'Cloudflare deployment API request failed.';
        deployArtifact.runner.handleDeployAction('deploying', 'failed', { error: errorMsg, source: 'cloudflare' });
        toast.error(errorMsg);
        throw new Error(errorMsg);
      }

      // 4. Success
      // Assuming the API returns deployment URL and possibly a project ID if newly created
      const deploymentUrl = data.url || (data.deployment && data.deployment.url);
      if (!deploymentUrl) {
        const errorMsg = 'Deployment succeeded but no URL was returned from API.';
        deployArtifact.runner.handleDeployAction('deploying', 'failed', { error: errorMsg, source: 'cloudflare' });
        toast.warn(errorMsg); // Warn because it's partially successful
        // Potentially still return true or handle as a soft error
      } else {
         deployArtifact.runner.handleDeployAction('complete', 'complete', {
          url: deploymentUrl,
          source: 'cloudflare',
        });
        toast.success(`Successfully deployed to Cloudflare Pages: ${deploymentUrl}`);
      }

      if (data.projectId && !existingProjectId) {
        localStorage.setItem(`cloudflare-project-${currentChatId}`, data.projectId);
      }
      
      return true;

    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unknown error occurred during Cloudflare deployment.';
      console.error('Cloudflare Deploy Error:', error);
      toast.error(message);
      // Ensure the deployment artifact reflects the error if not already set
      const deployArtifact = workbenchStore.artifacts.get()[`deploy-cloudflare-${currentChatId}-${Date.now()}`]; // This ID might be tricky if error is early
      if (deployArtifact && deployArtifact.runner.currentActionStatus?.status !== 'failed') {
         deployArtifact.runner.handleDeployAction('deploying', 'failed', { error: message, source: 'cloudflare' });
      }
      return false;
    } finally {
      setIsDeploying(false);
    }
  };

  return {
    isDeploying,
    handleCloudflareDeploy,
    isConnected: !!cfConn.token && !!cfConn.accountId,
  };
}
