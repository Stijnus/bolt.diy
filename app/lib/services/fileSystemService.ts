import type { WebContainer } from '@webcontainer/api';
import { workbenchStore } from '~/lib/stores/workbench';

export interface FileSystemService {
  reloadProjectFiles(container: WebContainer, repoDir?: string): Promise<void>;
  scanDirectory(
    container: WebContainer,
    path: string,
    files: Record<string, string>,
    maxDepth?: number,
    currentDepth?: number,
  ): Promise<Record<string, string>>;
}

export const fileSystemService: FileSystemService = {
  async reloadProjectFiles(container: WebContainer, repoDir?: string): Promise<void> {
    try {
      // Read all files from the WebContainer working directory
      const base = repoDir ? repoDir.replace(container.workdir + '/', '') : '.';
      const files = await this.scanDirectory(container, base, {});

      // Convert into FileMap shape expected by workbench
      const fileMap: any = {};

      for (const [p, content] of Object.entries(files)) {
        fileMap[p] = { type: 'file', content, isBinary: false };
      }

      // Update the workbench with the new files
      workbenchStore.files.set(fileMap);

      // Show workbench if not already visible
      if (!workbenchStore.showWorkbench.get()) {
        workbenchStore.showWorkbench.set(true);
      }

      console.log(`Reloaded ${Object.keys(files).length} project files into workbench`);
    } catch (error) {
      console.error('Failed to reload project files:', error);

      // Don't throw - branch switch was successful even if file reload failed
    }
  },

  async scanDirectory(
    container: WebContainer,
    path: string,
    files: Record<string, string>,
    maxDepth: number = 3,
    currentDepth: number = 0,
  ): Promise<Record<string, string>> {
    if (currentDepth >= maxDepth) {
      return files;
    }

    try {
      const entries = await container.fs.readdir(path, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path === '.' ? entry.name : `${path}/${entry.name}`;

        // Skip common directories that shouldn't be loaded
        if (
          entry.name.startsWith('.') ||
          [
            'node_modules',
            'dist',
            'build',
            '.next',
            'out',
            'coverage',
            '.nyc_output',
            '__pycache__',
            '.venv',
            'venv',
          ].includes(entry.name)
        ) {
          continue;
        }

        if (entry.isFile()) {
          // Only load certain file types
          const ext = entry.name.split('.').pop()?.toLowerCase();

          if (
            (ext &&
              [
                'js',
                'ts',
                'tsx',
                'jsx',
                'py',
                'java',
                'go',
                'rs',
                'php',
                'rb',
                'cpp',
                'c',
                'cs',
                'swift',
                'kt',
                'dart',
                'html',
                'css',
                'scss',
                'sass',
                'less',
                'vue',
                'svelte',
                'astro',
                'json',
                'yaml',
                'yml',
                'toml',
                'xml',
                'md',
                'txt',
                'env',
                'config',
                'conf',
                'dockerfile',
                'Dockerfile',
                'makefile',
                'Makefile',
              ].includes(ext)) ||
            [
              'README',
              'LICENSE',
              'CHANGELOG',
              'package.json',
              'cargo.toml',
              'requirements.txt',
              'setup.py',
              'pom.xml',
              'build.gradle',
              'composer.json',
              'Gemfile',
            ].includes(entry.name)
          ) {
            try {
              const content = await container.fs.readFile(fullPath, 'utf-8');
              files[fullPath] = content;
            } catch (error) {
              console.warn(`Failed to read file ${fullPath}:`, error);
            }
          }
        } else if (entry.isDirectory()) {
          // Recursively scan subdirectories
          await this.scanDirectory(container, fullPath, files, maxDepth, currentDepth + 1);
        }
      }
    } catch (error) {
      console.warn(`Failed to scan directory ${path}:`, error);
    }

    return files;
  },
};
