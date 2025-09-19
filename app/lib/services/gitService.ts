import http from 'isomorphic-git/http/web';
import git, { type PromiseFsClient, type GitAuth } from 'isomorphic-git';
import Cookies from 'js-cookie';
import { toast } from 'react-toastify';
import type { WebContainer } from '@webcontainer/api';
import { webcontainer } from '~/lib/webcontainer';
import type { Branch } from '~/components/projects/types';

const gitHttpOptions = { http, corsProxy: '/api/git-proxy' } as const;

export class GitRepositoryNotFoundError extends Error {
  constructor(
    message: string = 'The Git repository for this project could not be found. Please reconnect the project to a valid Git repository or remove Git-specific actions.',
  ) {
    super(message);
    this.name = 'GitRepositoryNotFoundError';
  }
}

const hasGitMetadata = async (fs: PromiseFsClient, dir: string) => {
  try {
    await fs.promises.stat(`${dir}/.git`);
    return true;
  } catch {
    return false;
  }
};

export interface GitService {
  createBranch(projectGitUrl: string, branch: string, from?: string): Promise<Branch>;
  switchBranch(projectGitUrl: string, branch: string): Promise<string>;
  ensureRepoInWebContainer(
    projectGitUrl: string,
  ): Promise<{ container: WebContainer; fs: PromiseFsClient; dir: string }>;
  readBranchMetadata(fs: PromiseFsClient, dir: string, branchName: string): Promise<Branch>;
}

// Git utility functions
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

// Git service implementation
export const gitService: GitService = {
  async ensureRepoInWebContainer(projectGitUrl: string) {
    const container = await webcontainer;

    if (!container) {
      throw new Error('WebContainer is not available.');
    }

    // Derive a stable repo directory inside WebContainer from git URL
    const getRepoDir = (container: any, gitUrl: string) => {
      const name = (gitUrl?.split('/')?.pop() || 'project').replace(/\.git$/, '') || 'project';
      return `${container.workdir}/${name}`;
    };

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

  async readBranchMetadata(fs: PromiseFsClient, dir: string, branchName: string): Promise<Branch> {
    const fallbackTimestamp = new Date().toISOString();

    try {
      const [latestCommit] = await git.log({ fs, dir, ref: branchName, depth: 1 });

      if (!latestCommit) {
        return {
          name: branchName,
          author: 'Unknown',
          updated: fallbackTimestamp,
        };
      }

      return {
        name: branchName,
        author: latestCommit.commit.author.name || 'Unknown',
        updated: new Date(latestCommit.commit.author.timestamp * 1000).toISOString(),
        commitHash: latestCommit.oid,
      };
    } catch (logError) {
      console.warn(`Unable to read metadata for branch '${branchName}':`, logError);

      return {
        name: branchName,
        author: 'Unknown',
        updated: fallbackTimestamp,
      };
    }
  },

  async createBranch(projectGitUrl: string, branchName: string, branchFrom: string = 'main'): Promise<Branch> {
    if (!projectGitUrl || typeof projectGitUrl !== 'string') {
      throw new Error('Invalid project Git URL provided');
    }

    if (!branchName || typeof branchName !== 'string' || branchName.trim().length === 0) {
      throw new Error('Invalid branch name provided');
    }

    if (!branchFrom || typeof branchFrom !== 'string' || branchFrom.trim().length === 0) {
      throw new Error('Invalid source branch name provided');
    }

    const sanitizedBranchName = branchName.trim().replace(/[^a-zA-Z0-9\-_\/]/g, '-');

    if (sanitizedBranchName !== branchName.trim()) {
      console.warn(`Branch name sanitized from '${branchName}' to '${sanitizedBranchName}'`);
    }

    try {
      const { fs, dir } = await this.ensureRepoInWebContainer(projectGitUrl);
      const repositoryReady = await hasGitMetadata(fs, dir);

      if (!repositoryReady) {
        throw new GitRepositoryNotFoundError();
      }

      const authOptions = getGitAuthOptions(projectGitUrl);

      try {
        await git.fetch({
          fs,
          dir,
          remote: 'origin',
          ref: branchFrom,
          singleBranch: true,
          depth: 1,
          ...gitHttpOptions,
          ...authOptions,
        });
      } catch (fetchError) {
        console.warn(`Failed to fetch branch '${branchFrom}':`, fetchError);
      }

      let localBranches = await git.listBranches({ fs, dir });

      if (!localBranches.includes(branchFrom)) {
        const remoteBranches = await git.listBranches({ fs, dir, remote: 'origin' });

        if (!remoteBranches.includes(branchFrom)) {
          throw new Error(`Source branch '${branchFrom}' does not exist on the remote repository.`);
        }

        const baseRemoteRef = `refs/remotes/origin/${branchFrom}`;
        const baseOid = await git.resolveRef({ fs, dir, ref: baseRemoteRef });
        await git.branch({ fs, dir, ref: branchFrom, checkout: false, object: baseOid });
        localBranches = [...localBranches, branchFrom];
      }

      if (localBranches.includes(sanitizedBranchName)) {
        toast.info(`Branch '${sanitizedBranchName}' already exists`);
        return await this.readBranchMetadata(fs, dir, sanitizedBranchName);
      }

      const baseOid = await git.resolveRef({ fs, dir, ref: branchFrom });
      await git.branch({ fs, dir, ref: sanitizedBranchName, checkout: false, object: baseOid });

      try {
        await git.push({
          fs,
          dir,
          remote: 'origin',
          ref: sanitizedBranchName,
          force: false,
          ...gitHttpOptions,
          ...authOptions,
        });
      } catch (pushError) {
        console.error('Failed to push new branch to remote:', pushError);
        throw new Error(
          pushError instanceof Error
            ? `Branch '${sanitizedBranchName}' was created locally but pushing to remote failed: ${pushError.message}`
            : `Branch '${sanitizedBranchName}' was created locally but pushing to remote failed.`,
        );
      }

      const branchMetadata = await this.readBranchMetadata(fs, dir, sanitizedBranchName);
      toast.success(`Branch '${branchMetadata.name}' created from '${branchFrom}'`);

      return branchMetadata;
    } catch (error) {
      console.error('Error creating git branch:', error);

      if (error instanceof GitRepositoryNotFoundError) {
        throw error;
      }

      const errnoError = error as NodeJS.ErrnoException | undefined;
      const message = error instanceof Error ? error.message : String(error ?? '');
      const errorCode = errnoError?.code || (error as { code?: string })?.code;

      if (errorCode === 'ENOENT' || errorCode === 'NotFoundError' || message.includes('ENOENT')) {
        throw new GitRepositoryNotFoundError();
      }

      if (error instanceof Error) {
        throw error;
      }

      throw new Error('Git branch creation failed due to an unexpected error');
    }
  },

  async switchBranch(projectGitUrl: string, branchName: string): Promise<string> {
    try {
      const { fs, dir } = await this.ensureRepoInWebContainer(projectGitUrl);

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
        } catch {
          // ignore fetch errors
        }
      }

      if (!branches.includes(branchName)) {
        throw new Error(`Branch '${branchName}' does not exist`);
      }

      // Checkout
      await git.checkout({ fs, dir, ref: branchName, force: false });

      console.log(`Successfully switched to branch '${branchName}'`);
      toast.success(`Switched to branch '${branchName}'`);

      return branchName;
    } catch (error) {
      console.error('Error switching to branch:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to switch to branch: ${errorMessage}`);
      throw error;
    }
  },
};
