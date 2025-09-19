import { useState, useEffect, useCallback, useRef } from 'react';
import { atom } from 'nanostores';
import { toast } from 'react-toastify';
import {
  addOrUpdateFeature,
  addProject,
  deleteProjectById,
  getAllProjects,
  getProjectById,
  getProjectChats,
  openDatabase,
  updateProject,
  updateProjectBranches,
  getFeaturesByProject,
  getFeatureById,
} from './db';
import type { ChatHistoryItem } from './useChatHistory';
import FS from '@isomorphic-git/lightning-fs';
import http from 'isomorphic-git/http/web';
import git, { type PromiseFsClient, type GitAuth } from 'isomorphic-git';
import Cookies from 'js-cookie';
import type { WebContainer } from '@webcontainer/api';
import { webcontainer } from '~/lib/webcontainer';
import { useGit } from '~/lib/hooks/useGit';
import { workbenchStore } from '~/lib/stores/workbench';
import type { Branch, Feature, NewFeature, Project } from '~/components/projects/types';
import { logActivity } from '~/lib/services/activityService';

const persistenceEnabled = !import.meta.env.VITE_DISABLE_PERSISTENCE;
const gitHttpOptions = { http, corsProxy: '/api/git-proxy' } as const;
export const db = persistenceEnabled ? await openDatabase() : undefined;
export const chatId = atom<string | undefined>(undefined);
export const description = atom<string | undefined>(undefined);

const encodeBasicAuth = (username: string, password: string) => {
  const value = `${username}:${password}`;

  if (typeof btoa === 'function') {
    return btoa(value);
  }

  try {
    return Buffer.from(value, 'utf-8').toString('base64');
  } catch {
    return value;
  }
};

const normalizeGitUrl = (gitUrl: string) => {
  if (gitUrl.startsWith('git@')) {
    const withoutPrefix = gitUrl.replace(/^git@/, '');
    const [host, repoPath] = withoutPrefix.split(':');

    return `https://${host}/${repoPath}`;
  }

  if (gitUrl.startsWith('ssh://git@')) {
    return gitUrl.replace('ssh://git@', 'https://');
  }

  return gitUrl;
};

const resolveGitCookieKey = (gitUrl: string) => {
  try {
    const normalized = normalizeGitUrl(gitUrl);
    const host = new URL(normalized).hostname;

    if (host.endsWith('github.com')) {
      return 'git:github.com';
    }

    if (host.endsWith('gitlab.com')) {
      return 'git:gitlab.com';
    }
  } catch {
    return undefined;
  }

  return undefined;
};

const getSavedGitCredentials = (gitUrl: string): GitAuth | undefined => {
  const cookieKey = resolveGitCookieKey(gitUrl);

  if (!cookieKey) {
    return undefined;
  }

  const stored = Cookies.get(cookieKey);

  if (!stored) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(stored) as GitAuth;

    if (parsed?.username && parsed?.password) {
      return parsed;
    }
  } catch {
    return undefined;
  }

  return undefined;
};

const getGitAuthOptions = (gitUrl: string) => {
  const headers: Record<string, string> = { 'User-Agent': 'bolt.diy' };
  const credentials = getSavedGitCredentials(gitUrl);

  if (!credentials) {
    return { headers };
  }

  const cookieKey = resolveGitCookieKey(gitUrl);
  const setCookie = (auth: GitAuth) => {
    if (cookieKey) {
      Cookies.set(cookieKey, JSON.stringify(auth));
    }
  };

  headers.Authorization = `Basic ${encodeBasicAuth(credentials.username || '', credentials.password || '')}`;

  return {
    headers,
    onAuth: () => credentials,
    onAuthSuccess: (_url: string, auth: GitAuth) => {
      headers.Authorization = `Basic ${encodeBasicAuth(auth.username || '', auth.password || '')}`;
      setCookie(auth);
    },
    onAuthFailure: (requestUrl: string) => {
      console.error(`Authentication failed for ${requestUrl}`);
      toast.error(
        'Authentication failed while accessing the repository. Please reconnect your git provider credentials.',
      );
      throw new Error(`Authentication failed for ${requestUrl}`);
    },
  } as const;
};

function createWebcontainerFsAdapter(container: WebContainer): PromiseFsClient {
  const relativePath = (path: string) => {
    if (!path) {
      return '.';
    }

    if (path.startsWith('/')) {
      return pathUtils.relative(container.workdir, path);
    }

    if (path.startsWith(container.workdir)) {
      return pathUtils.relative(container.workdir, path);
    }

    return path.replace(/^\.\/+/, '') || '.';
  };

  const fsAdapter: PromiseFsClient = {
    promises: {
      readFile: async (path: string, options: any = {}) => {
        const encoding = typeof options === 'string' ? options : options?.encoding;
        const result = await container.fs.readFile(relativePath(path), encoding);

        return result;
      },
      writeFile: async (path: string, data: any, options: any = {}) => {
        const rel = relativePath(path);
        const encoding = typeof options === 'string' ? options : options?.encoding;

        if (data instanceof Uint8Array) {
          await container.fs.writeFile(rel, data);
        } else {
          await container.fs.writeFile(rel, data, encoding || 'utf8');
        }
      },
      mkdir: async (path: string, options: any = {}) => {
        await container.fs.mkdir(relativePath(path), { recursive: true, ...options });
      },
      readdir: async (path: string, options: any = {}) => {
        return await container.fs.readdir(relativePath(path), options);
      },
      rmdir: async (path: string, options: any = {}) => {
        await container.fs.rm(relativePath(path), { recursive: true, ...options });
      },
      unlink: async (path: string) => {
        await container.fs.rm(relativePath(path), { recursive: false });
      },
      stat: async (path: string) => {
        const rel = relativePath(path);

        if (rel === '.' || rel === '') {
          const now = Date.now();
          return {
            isFile: () => false,
            isDirectory: () => true,
            isSymbolicLink: () => false,
            size: 4096,
            mode: 0o040755,
            mtimeMs: now,
            ctimeMs: now,
            birthtimeMs: now,
            atimeMs: now,
            uid: 1000,
            gid: 1000,
            dev: 1,
            ino: 1,
            nlink: 1,
            rdev: 0,
            blksize: 4096,
            blocks: 8,
            mtime: new Date(now),
            ctime: new Date(now),
            birthtime: new Date(now),
            atime: new Date(now),
          };
        }

        if (rel === '.git/index') {
          const now = Date.now();
          return {
            isFile: () => true,
            isDirectory: () => false,
            isSymbolicLink: () => false,
            size: 12,
            mode: 0o100644,
            mtimeMs: now,
            ctimeMs: now,
            birthtimeMs: now,
            atimeMs: now,
            uid: 1000,
            gid: 1000,
            dev: 1,
            ino: 1,
            nlink: 1,
            rdev: 0,
            blksize: 4096,
            blocks: 8,
            mtime: new Date(now),
            ctime: new Date(now),
            birthtime: new Date(now),
            atime: new Date(now),
          };
        }

        const dirPath = pathUtils.dirname(rel);
        const fileName = pathUtils.basename(rel);

        const entries = await container.fs.readdir(dirPath, { withFileTypes: true });
        const entry = entries.find((item) => item.name === fileName);

        if (!entry) {
          const error = new Error(`ENOENT: no such file or directory '${path}'`) as NodeJS.ErrnoException;
          error.code = 'ENOENT';
          error.errno = -2;
          error.syscall = 'stat';
          error.path = path;
          throw error;
        }

        const now = Date.now();

        return {
          isFile: () => entry.isFile(),
          isDirectory: () => entry.isDirectory(),
          isSymbolicLink: () => false,
          size: entry.isDirectory() ? 4096 : 1,
          mode: entry.isDirectory() ? 0o040755 : 0o100644,
          mtimeMs: now,
          ctimeMs: now,
          birthtimeMs: now,
          atimeMs: now,
          uid: 1000,
          gid: 1000,
          dev: 1,
          ino: 1,
          nlink: 1,
          rdev: 0,
          blksize: 4096,
          blocks: entry.isDirectory() ? 8 : 1,
          mtime: new Date(now),
          ctime: new Date(now),
          birthtime: new Date(now),
          atime: new Date(now),
        };
      },
      lstat: async (path: string) => {
        return await fsAdapter.promises.stat(path);
      },
      readlink: async (path: string) => {
        throw new Error(`EINVAL: invalid argument, readlink '${path}'`);
      },
      symlink: async (target: string, path: string) => {
        throw new Error(`EPERM: operation not permitted, symlink '${target}' -> '${path}'`);
      },
      chmod: async () => {
        return;
      },
    },
  };

  return fsAdapter;
}

const pathUtils = {
  dirname: (path: string) => {
    if (!path || !path.includes('/')) {
      return '.';
    }

    const normalized = path.replace(/\/+$/, '');

    return normalized.split('/').slice(0, -1).join('/') || '.';
  },
  basename: (path: string) => {
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
};

export function useProjectHistory(selectedProjectId?: string) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const fsRef = useRef<FS | null>(null);
  const { ready: gitReady } = useGit();

  // Derive a stable repo directory inside WebContainer from git URL
  const getRepoDir = useCallback((container: any, gitUrl: string) => {
    const name = (gitUrl?.split('/')?.pop() || 'project').replace(/\.git$/, '') || 'project';
    return `${container.workdir}/${name}`;
  }, []);

  // Ensure the repository exists inside WebContainer. If missing, clone it.
  const ensureRepoInWebContainer = useCallback(
    async (projectGitUrl: string) => {
      const container = await webcontainer;

      if (!container) {
        throw new Error('WebContainer is not available.');
      }

      if (!gitReady) {
        throw new Error('Git system is not ready.');
      }

      const dir = getRepoDir(container, projectGitUrl);
      const authOptions = getGitAuthOptions(projectGitUrl);

      // Map WebContainer FS to isomorphic-git FS client
      const fs = createWebcontainerFsAdapter(container);

      // If no .git, clone into the dedicated directory
      let hasGit = false;

      try {
        await fs.promises.stat(`${dir}/.git`);
        hasGit = true;
      } catch {
        // ignore
      }

      if (!hasGit) {
        await fs.promises.mkdir(dir, { recursive: true });
        await git.clone({
          fs,
          dir,
          url: projectGitUrl,
          depth: 1,
          ...gitHttpOptions,
          ...authOptions,
        });
      }

      return { container, fs, dir } as const;
    },
    [gitReady, getRepoDir],
  );

  // Helper function to create a git branch in WebContainer
  const createGitBranch = useCallback(
    async (projectGitUrl: string, branchName: string, branchFrom: string = 'main') => {
      // Input validation
      if (!projectGitUrl || typeof projectGitUrl !== 'string') {
        throw new Error('Invalid project Git URL provided');
      }

      if (!branchName || typeof branchName !== 'string' || branchName.trim().length === 0) {
        throw new Error('Invalid branch name provided');
      }

      if (!branchFrom || typeof branchFrom !== 'string' || branchFrom.trim().length === 0) {
        throw new Error('Invalid source branch name provided');
      }

      // Sanitize branch name
      const sanitizedBranchName = branchName.trim().replace(/[^a-zA-Z0-9\-_\/]/g, '-');

      if (sanitizedBranchName !== branchName.trim()) {
        console.warn(`Branch name sanitized from '${branchName}' to '${sanitizedBranchName}'`);
      }

      try {
        const container = await webcontainer;
        const authOptions = getGitAuthOptions(projectGitUrl);

        if (!container) {
          throw new Error('WebContainer is not available. Please ensure the development environment is running.');
        }

        if (!gitReady) {
          throw new Error('Git system is not ready. Please wait for initialization to complete.');
        }

        // Get the project directory name from git URL
        const projectName = projectGitUrl.split('/').pop()?.replace('.git', '') || 'unknown';
        const workdir = container.workdir;

        // Check if the project is already cloned in WebContainer
        try {
          const entries = await container.fs.readdir('.', { withFileTypes: true });
          const hasGit = entries?.some((e: any) => e.name === '.git' && e.isDirectory && e.isDirectory());

          if (!hasGit) {
            throw new Error(`Git repository not found in WebContainer`);
          }
        } catch (statError) {
          console.warn('Git repository not found in WebContainer. Falling back to internal FS:', statError);

          // Fallback: use internal Lightning-FS clone (same store used by refreshProject)
          try {
            if (!fsRef.current) {
              fsRef.current = new FS('ProjectFS');
            }

            const fs = fsRef.current;
            const dir = `/${projectName}`;

            try {
              await fs.promises.stat(`${dir}/.git`);
            } catch {
              await git.clone({
                fs,
                dir,
                url: projectGitUrl,
                depth: 1,
                ...gitHttpOptions,
                ...authOptions,
              });
            }

            // Check local branches in fallback repo
            let branches: string[] = [];

            try {
              branches = await git.listBranches({ fs, dir });
            } catch (branchListError) {
              console.error('Failed to list branches in fallback repo:', branchListError);
              throw new Error('Failed to access fallback git repository.');
            }

            if (!Array.isArray(branches) || branches.length === 0) {
              throw new Error('No branches found in fallback repository.');
            }

            if (!branches.includes(branchFrom)) {
              const availableBranches = branches.slice(0, 5).join(', ');
              throw new Error(
                `Source branch '${branchFrom}' does not exist in fallback repo. Available branches: ${availableBranches}${
                  branches.length > 5 ? '...' : ''
                }`,
              );
            }

            if (branches.includes(sanitizedBranchName)) {
              console.warn(`Branch '${sanitizedBranchName}' already exists (fallback), skipping creation`);
              toast.info(`Branch '${sanitizedBranchName}' already exists`);

              return sanitizedBranchName;
            }

            try {
              await (git as any).branch({
                fs,
                dir,
                ref: sanitizedBranchName,
                checkout: false,
                from: branchFrom,
              } as any);
            } catch (branchError) {
              console.error('Fallback branch creation failed:', branchError);
              throw new Error(
                `Failed to create branch '${sanitizedBranchName}' from '${branchFrom}' in fallback repo. ${
                  branchError instanceof Error ? branchError.message : ''
                }`,
              );
            }

            console.log(`Successfully created branch '${sanitizedBranchName}' in fallback repository`);

            return sanitizedBranchName;
          } catch (fallbackError) {
            console.error('Fallback repository handling failed:', fallbackError);

            throw new Error(
              `Project '${projectName}' not found in WebContainer and fallback failed. Please refresh the project first.`,
            );
          }
        }

        // Create the fs interface for isomorphic-git
        const fs: any = {
          promises: {
            readFile: (path: string, options: any) => container.fs.readFile(path, options),
            writeFile: (path: string, data: any, options: any) => container.fs.writeFile(path, data, options),
            mkdir: (path: string, options: any) => container.fs.mkdir(path, { recursive: true, ...options }),
            readdir: (path: string, options: any) => container.fs.readdir(path, options),
            stat: async (path: string) => {
              try {
                const stats = await container.fs.readdir(
                  path.includes('/') ? path.split('/').slice(0, -1).join('/') : '.',
                  { withFileTypes: true },
                );
                const fileName = path.includes('/') ? path.split('/').pop() : path;
                const fileInfo = stats.find((f: any) => f.name === fileName);

                if (!fileInfo) {
                  const error = new Error(`ENOENT: no such file or directory '${path}'`) as any;
                  error.code = 'ENOENT';
                  throw error;
                }

                return {
                  isFile: () => fileInfo.isFile(),
                  isDirectory: () => fileInfo.isDirectory(),
                  size: fileInfo.isFile() ? 1 : 4096,
                  mode: fileInfo.isDirectory() ? 0o040755 : 0o100644,
                  mtime: new Date(),
                };
              } catch (error: any) {
                if (!error.code) {
                  error.code = 'ENOENT';
                }

                throw error;
              }
            },
          },
        };

        // Check if the source branch exists
        let branches: string[] = [];

        try {
          branches = await git.listBranches({ fs, dir: workdir });
        } catch (branchListError) {
          console.error('Failed to list branches:', branchListError);
          throw new Error('Failed to access git repository. The repository may be corrupted.');
        }

        if (!Array.isArray(branches) || branches.length === 0) {
          throw new Error('No branches found in repository. Repository may be empty or corrupted.');
        }

        if (!branches.includes(branchFrom)) {
          const availableBranches = branches.slice(0, 5).join(', ');
          throw new Error(
            `Source branch '${branchFrom}' does not exist. Available branches: ${availableBranches}${branches.length > 5 ? '...' : ''}`,
          );
        }

        // Check if the target branch already exists
        if (branches.includes(sanitizedBranchName)) {
          console.warn(`Branch '${sanitizedBranchName}' already exists, skipping creation`);
          toast.info(`Branch '${sanitizedBranchName}' already exists`);

          return sanitizedBranchName;
        }

        // Create the new branch from the source branch
        try {
          await (git as any).branch({
            fs,
            dir: workdir,
            ref: sanitizedBranchName,
            checkout: false,
            from: branchFrom,
          } as any);
        } catch (branchError) {
          console.error('Branch creation failed:', branchError);
          throw new Error(
            `Failed to create branch '${sanitizedBranchName}' from '${branchFrom}'. ${branchError instanceof Error ? branchError.message : ''}`,
          );
        }

        console.log(`Successfully created branch '${sanitizedBranchName}' from '${branchFrom}'`);

        return sanitizedBranchName;
      } catch (error) {
        console.error('Error creating git branch:', error);

        // Re-throw with more context if it's a generic error
        if (error instanceof Error) {
          if (error.message.includes('WebContainer') || error.message.includes('Git')) {
            throw error; // Already has good context
          } else {
            throw new Error(`Git branch creation failed: ${error.message}`);
          }
        } else {
          throw new Error(`Git branch creation failed due to an unexpected error`);
        }
      }
    },
    [gitReady],
  );

  // Helper function to switch to a git branch in WebContainer
  const switchToBranch = useCallback(
    async (projectGitUrl: string, branchName: string, branchFrom?: string) => {
      try {
        const { container, fs, dir } = await ensureRepoInWebContainer(projectGitUrl);

        // Ensure branch exists locally; if not, try fetch and check again
        let branches = await git.listBranches({ fs, dir });

        if (!branches.includes(branchName)) {
          try {
            await git.fetch({
              fs,
              dir,
              remote: 'origin',
              ref: branchName,
              ...gitHttpOptions,
              ...getGitAuthOptions(projectGitUrl),
            });
            branches = await git.listBranches({ fs, dir });
          } catch {}
        }

        if (!branches.includes(branchName) && branchFrom) {
          if (!branches.includes(branchFrom)) {
            try {
              await git.fetch({
                fs,
                dir,
                remote: 'origin',
                ref: branchFrom,
                ...gitHttpOptions,
                ...getGitAuthOptions(projectGitUrl),
              });
              branches = await git.listBranches({ fs, dir });
            } catch {}
          }

          if (branches.includes(branchFrom)) {
            try {
              await git.branch({ fs, dir, ref: branchName, checkout: false });
              branches = [...new Set([...branches, branchName])];
            } catch (branchError) {
              console.warn(`Failed to create local branch '${branchName}' from '${branchFrom}':`, branchError);
            }
          }
        }

        if (!branches.includes(branchName)) {
          throw new Error(`Branch '${branchName}' does not exist`);
        }

        // Checkout
        await git.checkout({ fs, dir, ref: branchName, force: false });

        // Reload files from repo directory
        await reloadProjectFiles(container, dir);

        console.log(`Successfully switched to branch '${branchName}' and reloaded project files`);
        toast.success(`Switched to branch '${branchName}' and reloaded project files`);

        return branchName;
      } catch (error) {
        console.error('Error switching to branch:', error);

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        toast.error(`Failed to switch to branch: ${errorMessage}`);
        throw error;
      }
    },
    [ensureRepoInWebContainer],
  );

  // Helper function to reload project files into workbench after branch switch
  const reloadProjectFiles = useCallback(async (container: any, repoDir?: string) => {
    try {
      // Read all files from the WebContainer working directory
      const base = repoDir ? repoDir.replace(container.workdir + '/', '') : '.';
      const files = await scanDirectory(container, base, {});

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
  }, []);

  // Helper function to recursively scan directory
  const scanDirectory = async (
    container: any,
    path: string,
    files: Record<string, string>,
    maxDepth: number = 3,
    currentDepth: number = 0,
  ): Promise<Record<string, string>> => {
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
          await scanDirectory(container, fullPath, files, maxDepth, currentDepth + 1);
        }
      }
    } catch (error) {
      console.warn(`Failed to scan directory ${path}:`, error);
    }

    return files;
  };

  const loadProjects = useCallback(async () => {
    if (db) {
      try {
        const allProjects = await getAllProjects(db);

        const enriched = await Promise.all(
          (allProjects || []).map(async (p) => {
            try {
              const feats = await getFeaturesByProject(db, p.id);
              return { ...p, features: (feats as unknown as Feature[]) ?? p.features };
            } catch {
              return p;
            }
          }),
        );

        setProjects(enriched);
      } catch (error) {
        console.error('Error loading projects:', error);
        toast.error('Failed to load projects');
      } finally {
        setLoading(false);
      }
    }
  }, []);

  const addNewProject = useCallback(
    async (project: Project) => {
      if (db) {
        try {
          await addProject(db, project);
          await loadProjects();
          toast.success(`Project "${project.name}" added successfully`);
        } catch (error) {
          console.error('Error adding project:', error);
          toast.error('Failed to add project');
        }
      }
    },
    [loadProjects],
  );

  const editProject = useCallback(
    async (id: string, updates: Partial<Project>) => {
      if (db) {
        try {
          const currentProject = await getProjectById(db, id);
          const updatedProject = { ...currentProject, ...updates };
          await updateProject(db, updatedProject, id);
          await loadProjects();
          toast.success('Project updated successfully');
        } catch (error) {
          console.error('Error updating project:', error);
          toast.error('Failed to update project');
        }
      }
    },
    [loadProjects],
  );

  const deleteProject = useCallback(
    async (id: string) => {
      if (db) {
        try {
          await deleteProjectById(db, id);
          await loadProjects();
          toast.success('Project deleted successfully');

          try {
            await logActivity({
              id: `${Date.now()}-project_deleted-${id}`,
              scopeType: 'project',
              scopeId: id,
              userId: 'local-user',
              action: 'project_deleted',
              details: {},
              timestamp: new Date().toISOString(),
            });
          } catch {}
        } catch (error) {
          console.error('Error deleting project:', error);
          toast.error('Failed to delete project');
        }
      }
    },
    [loadProjects],
  );

  const refreshProject = useCallback(
    async (gitUrl: string) => {
      if (!gitUrl) {
        return;
      }

      try {
        setLoading(true);

        // Initialize filesystem if not already done
        if (!fsRef.current) {
          fsRef.current = new FS('ProjectFS');
        }

        const fs = fsRef.current;

        const projectName = gitUrl.split('/').pop()?.replace('.git', '') || 'unknown';
        const dir = `/${projectName}`;
        const authOptions = getGitAuthOptions(gitUrl);

        try {
          // Try to check if directory exists and has .git folder
          await fs.promises.stat(`${dir}/.git`);
          console.log('Repository already cloned, pulling latest changes...');

          // Pull latest changes
          await git.pull({
            fs,
            dir,
            author: {
              name: 'bolt.diy',
              email: 'user@bolt.diy',
            },
            ...gitHttpOptions,
            ...authOptions,
          });
        } catch {
          console.log('Cloning repository...');

          // Clone the repository
          await git.clone({
            fs,
            dir,
            url: gitUrl,
            depth: 1,
            ...gitHttpOptions,
            ...authOptions,
          });
        }

        // Get branches
        const branches: Branch[] = [];

        try {
          const remoteBranches = await git.listBranches({
            fs,
            dir,
            remote: 'origin',
          });

          const seenBranches = new Set<string>();

          for (const branch of remoteBranches) {
            if (!branch || branch.toUpperCase() === 'HEAD' || seenBranches.has(branch)) {
              continue;
            }

            try {
              const commits = await git.log({
                fs,
                dir,
                ref: `origin/${branch}`,
                depth: 1,
              });

              if (commits.length > 0) {
                const commit = commits[0];
                seenBranches.add(branch);
                branches.push({
                  name: branch,
                  author: commit.commit.author.name,
                  updated: new Date(commit.commit.author.timestamp * 1000).toISOString(),
                  commitHash: commit.oid,
                });
              }
            } catch (error) {
              console.warn(`Failed to get info for branch ${branch}:`, error);
            }
          }
        } catch (error) {
          console.error('Error getting branches:', error);
        }

        if (db) {
          await updateProjectBranches(db, gitUrl, branches);
          await loadProjects();
        }

        toast.success('Project refreshed successfully');
      } catch (error) {
        console.error('Error refreshing project:', error);
        toast.error('Failed to refresh project');
      } finally {
        setLoading(false);
      }
    },
    [loadProjects],
  );

  const addFeature = useCallback(
    async (projectId: string, newFeature: NewFeature) => {
      // Input validation
      if (!projectId || typeof projectId !== 'string') {
        throw new Error('Invalid project ID provided');
      }

      if (!newFeature || typeof newFeature !== 'object') {
        throw new Error('Invalid feature data provided');
      }

      if (!newFeature.name || typeof newFeature.name !== 'string' || newFeature.name.trim().length === 0) {
        throw new Error('Feature name is required');
      }

      if (
        !newFeature.branchRef ||
        typeof newFeature.branchRef !== 'string' ||
        newFeature.branchRef.trim().length === 0
      ) {
        throw new Error('Branch reference is required');
      }

      if (
        !newFeature.branchFrom ||
        typeof newFeature.branchFrom !== 'string' ||
        newFeature.branchFrom.trim().length === 0
      ) {
        throw new Error('Source branch is required');
      }

      if (!db) {
        throw new Error('Database is not available. Please check your connection.');
      }

      try {
        const now = new Date().toISOString();

        // Get the project to access its git URL
        let project;

        try {
          project = await getProjectById(db, projectId);
        } catch (dbError) {
          console.error('Database error while fetching project:', dbError);
          throw new Error('Failed to access project data. Please try again.');
        }

        if (!project) {
          throw new Error('Project not found. It may have been deleted.');
        }

        if (!project.gitUrl) {
          throw new Error('Project does not have a valid Git URL configured.');
        }

        const isWebcontainerProject = project.source === 'webcontainer' || project.gitUrl.startsWith('webcontainer://');

        if (!isWebcontainerProject) {
          // First create the actual git branch
          try {
            await createGitBranch(project.gitUrl, newFeature.branchRef, newFeature.branchFrom);
          } catch (error) {
            console.error('Failed to create git branch:', error);
            toast.error(`Failed to create git branch: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
          }
        }

        const feature: Feature = {
          id: `${Date.now()}`,
          name: newFeature.name,
          branchRef: newFeature.branchRef,
          description: newFeature.description || '',
          branchFrom: newFeature.branchFrom,
          status: 'pending',
          head: newFeature.srcOid || '',

          // Initialize time tracking
          timeTracking: {
            createdAt: now,
            estimatedHours: newFeature.estimatedHours,
            lastUpdated: now,
          },

          // Initialize analytics data
          analytics: {
            priority: newFeature.priority || 'medium',
            complexity: newFeature.complexity || 'medium',
            tags: newFeature.tags || [],
            assignee: newFeature.assignee,
            dependencies: newFeature.dependencies || [],
          },
        };

        await addOrUpdateFeature(db, projectId, feature);
        await loadProjects();
        toast.success(`Feature "${feature.name}" added successfully with branch '${newFeature.branchRef}'`);
      } catch (error) {
        console.error('Error adding feature:', error);

        let errorMessage = 'Failed to add feature';

        if (error instanceof Error) {
          if (error.message.includes('branch')) {
            errorMessage = `Failed to create git branch: ${error.message}`;
          } else if (error.message.includes('Database') || error.message.includes('database')) {
            errorMessage = 'Database error while adding feature. Please try again.';
          } else {
            errorMessage = `Failed to add feature: ${error.message}`;
          }
        }

        toast.error(errorMessage);
        throw error;
      }
    },
    [loadProjects, createGitBranch],
  );

  const updateFeatureStatus = useCallback(
    async (projectId: string, featureId: string, status: Feature['status']) => {
      if (db) {
        try {
          const project = await getProjectById(db, projectId);
          let feature: Feature | undefined;

          try {
            const feat = await getFeatureById(db, featureId);
            feature = (feat as unknown as Feature) || undefined;
          } catch {
            feature = project.features.find((f) => f.id === featureId);
          }

          if (feature) {
            const now = new Date().toISOString();
            const isWebcontainerProject =
              project.source === 'webcontainer' || project.gitUrl.startsWith('webcontainer://');
            const updatedTimeTracking = { ...feature.timeTracking };

            // Handle branch switching when status changes
            if (status === 'in-progress' && feature.status !== 'in-progress') {
              // Starting work - switch to feature branch
              if (!isWebcontainerProject) {
                try {
                  await switchToBranch(project.gitUrl, feature.branchRef, feature.branchFrom);
                  updatedTimeTracking.startedAt = now;
                  toast.success(`Switched to branch '${feature.branchRef}' and started working on '${feature.name}'`);
                } catch (error) {
                  console.error('Failed to switch to feature branch:', error);
                  toast.error(
                    `Failed to switch to branch '${feature.branchRef}'. Status updated but you may need to switch manually.`,
                  );

                  // Still update the status even if branch switch failed
                  updatedTimeTracking.startedAt = now;
                }
              } else {
                updatedTimeTracking.startedAt = now;
              }
            } else if (status === 'completed' && feature.status === 'in-progress') {
              // Completing work
              updatedTimeTracking.completedAt = now;

              // Calculate actual hours if started
              if (updatedTimeTracking.startedAt) {
                const startTime = new Date(updatedTimeTracking.startedAt);
                const endTime = new Date(now);
                const hoursWorked = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
                updatedTimeTracking.actualHours = Math.round(hoursWorked * 10) / 10;
              }

              toast.success(
                `Feature '${feature.name}' completed! Consider merging branch '${feature.branchRef}' back to '${feature.branchFrom}'.`,
              );
            }

            updatedTimeTracking.lastUpdated = now;

            const updatedFeature = {
              ...feature,
              status,
              timeTracking: updatedTimeTracking,
            };

            await addOrUpdateFeature(db, projectId, updatedFeature);
            await loadProjects();

            if (status !== 'in-progress' && status !== 'completed') {
              toast.success(`Feature status updated to ${status}`);
            }

            // Log activity (best-effort)
            try {
              await logActivity({
                id: `${Date.now()}-feature_status-${featureId}`,
                scopeType: 'feature',
                scopeId: featureId,
                userId: 'local-user',
                action: 'feature_status_changed',
                details: { projectId, status },
                timestamp: now,
              });
            } catch {}
          }
        } catch (error) {
          console.error('Error updating feature status:', error);
          toast.error('Failed to update feature status');
        }
      }
    },
    [loadProjects, switchToBranch],
  );

  const startFeatureTimer = useCallback(
    async (projectId: string, featureId: string) => {
      if (db) {
        try {
          const project = await getProjectById(db, projectId);
          let feature: Feature | undefined;

          try {
            const feat = await getFeatureById(db, featureId);
            feature = (feat as unknown as Feature) || undefined;
          } catch {
            feature = project.features.find((f) => f.id === featureId);
          }

          if (feature) {
            const isWebcontainerProject =
              project.source === 'webcontainer' || project.gitUrl.startsWith('webcontainer://');

            // Switch to feature branch when starting timer
            if (!isWebcontainerProject) {
              try {
                await switchToBranch(project.gitUrl, feature.branchRef, feature.branchFrom);
              } catch (error) {
                console.error('Failed to switch to feature branch:', error);
                toast.warning(
                  `Timer started but failed to switch to branch '${feature.branchRef}'. You may need to switch manually.`,
                );
              }
            }

            const now = new Date().toISOString();
            const updatedFeature = {
              ...feature,
              status: 'in-progress' as const,
              timeTracking: {
                ...feature.timeTracking,
                startedAt: now,
                lastUpdated: now,
              },
            };

            await addOrUpdateFeature(db, projectId, updatedFeature);
            await loadProjects();
            toast.success(`Timer started for ${feature.name} on branch '${feature.branchRef}'`);

            try {
              await logActivity({
                id: `${Date.now()}-feature_timer_started-${featureId}`,
                scopeType: 'feature',
                scopeId: featureId,
                userId: 'local-user',
                action: 'feature_timer_started',
                details: { projectId },
                timestamp: now,
              });
            } catch {}
          }
        } catch (error) {
          console.error('Error starting timer:', error);
          toast.error('Failed to start timer');
        }
      }
    },
    [loadProjects, switchToBranch],
  );

  const stopFeatureTimer = useCallback(
    async (projectId: string, featureId: string) => {
      if (db) {
        try {
          const project = await getProjectById(db, projectId);
          let feature: Feature | undefined;

          try {
            const feat = await getFeatureById(db, featureId);
            feature = (feat as unknown as Feature) || undefined;
          } catch {
            feature = project.features.find((f) => f.id === featureId);
          }

          if (feature && feature.timeTracking?.startedAt) {
            const now = new Date().toISOString();
            const startTime = new Date(feature.timeTracking.startedAt);
            const endTime = new Date(now);
            const sessionHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
            const currentActualHours = feature.timeTracking.actualHours || 0;

            const updatedFeature = {
              ...feature,
              status: 'pending' as const,
              timeTracking: {
                ...feature.timeTracking,
                actualHours: Math.round((currentActualHours + sessionHours) * 10) / 10,
                lastUpdated: now,
                startedAt: undefined, // Clear the start time
              },
            };

            await addOrUpdateFeature(db, projectId, updatedFeature);
            await loadProjects();
            toast.success(`Timer stopped for ${feature.name} (${sessionHours.toFixed(1)}h)`);

            try {
              await logActivity({
                id: `${Date.now()}-feature_timer_stopped-${featureId}`,
                scopeType: 'feature',
                scopeId: featureId,
                userId: 'local-user',
                action: 'feature_timer_stopped',
                details: { projectId, sessionHours },
                timestamp: now,
              });
            } catch {}
          }
        } catch (error) {
          console.error('Error stopping timer:', error);
          toast.error('Failed to stop timer');
        }
      }
    },
    [loadProjects],
  );

  const updateFeatureAnalytics = useCallback(
    async (projectId: string, featureId: string, analytics: Partial<Feature['analytics']>) => {
      if (db) {
        try {
          const project = await getProjectById(db, projectId);
          let feature: Feature | undefined;

          try {
            const feat = await getFeatureById(db, featureId);
            feature = (feat as unknown as Feature) || undefined;
          } catch {
            feature = project.features.find((f) => f.id === featureId);
          }

          if (feature) {
            const updatedFeature = {
              ...feature,
              analytics: {
                ...feature.analytics,
                ...analytics,
              },
              timeTracking: {
                ...feature.timeTracking,
                lastUpdated: new Date().toISOString(),
              },
            };

            await addOrUpdateFeature(db, projectId, updatedFeature);
            await loadProjects();
            toast.success('Feature analytics updated');

            try {
              await logActivity({
                id: `${Date.now()}-feature_updated-${featureId}`,
                scopeType: 'feature',
                scopeId: featureId,
                userId: 'local-user',
                action: 'feature_updated',
                details: { projectId, analytics },
                timestamp: new Date().toISOString(),
              });
            } catch {}
          }
        } catch (error) {
          console.error('Error updating feature analytics:', error);
          toast.error('Failed to update feature analytics');
        }
      }
    },
    [loadProjects],
  );

  // Comprehensive "Start Working" function
  const startWorkingOnFeature = useCallback(
    async (projectId: string, featureId: string) => {
      if (!db) {
        toast.error('Database not available');
        return;
      }

      try {
        const project = await getProjectById(db, projectId);
        const feature = project.features.find((f) => f.id === featureId);

        if (!feature) {
          toast.error('Feature not found');
          return;
        }

        toast.info(`Setting up development environment for "${feature.name}"...`, { autoClose: 2000 });

        const isWebcontainerProject = project.source === 'webcontainer' || project.gitUrl.startsWith('webcontainer://');

        if (!isWebcontainerProject) {
          // Step 1: Ensure project is cloned and up to date
          try {
            await refreshProject(project.gitUrl);
          } catch (error) {
            console.error('Failed to refresh project:', error);
            toast.error('Failed to refresh project. Continuing with existing state...');
          }

          // Step 2: Switch to feature branch and load files
          try {
            await switchToBranch(project.gitUrl, feature.branchRef, feature.branchFrom);
          } catch (error) {
            console.error('Failed to switch to feature branch:', error);
            toast.error(`Failed to switch to branch '${feature.branchRef}'. You may need to switch manually.`);

            // Continue anyway - user can switch manually
          }
        }

        // Step 3: Update feature status to 'in-progress' and start timer
        const now = new Date().toISOString();
        const updatedFeature = {
          ...feature,
          status: 'in-progress' as const,
          timeTracking: {
            ...feature.timeTracking,
            startedAt: now,
            lastUpdated: now,
          },
        };

        await addOrUpdateFeature(db, projectId, updatedFeature);
        await loadProjects();

        toast.success(`🚀 Ready to work on "${feature.name}"! Branch: ${feature.branchRef}`, { autoClose: 4000 });
      } catch (error) {
        console.error('Error starting work on feature:', error);
        toast.error('Failed to start working on feature');
        throw error;
      }
    },
    [db, loadProjects, refreshProject, switchToBranch],
  );

  const getProjectAssociatedChats = useCallback(async (projectId: string): Promise<ChatHistoryItem[]> => {
    if (db) {
      try {
        return await getProjectChats(db, projectId);
      } catch (error) {
        console.error('Error getting project chats:', error);
        return [];
      }
    }

    return [];
  }, []);

  // Load selected project details
  useEffect(() => {
    if (selectedProjectId) {
      const project = projects.find((p) => p.id === selectedProjectId);
      setSelectedProject(project || null);
    } else {
      setSelectedProject(null);
    }
  }, [selectedProjectId, projects]);

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  return {
    projects,
    loading,
    selectedProject,
    addNewProject,
    editProject,
    deleteProject,
    refreshProject,
    addFeature,
    updateFeatureStatus,
    startFeatureTimer,
    stopFeatureTimer,
    updateFeatureAnalytics,
    loadProjects,
    getProjectAssociatedChats,
    createGitBranch,
    switchToBranch,
    startWorkingOnFeature,
  };
}
