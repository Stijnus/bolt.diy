import FS from '@isomorphic-git/lightning-fs';
import git, { type GitAuth } from 'isomorphic-git';
import http from 'isomorphic-git/http/web';
import Cookies from 'js-cookie';

const gitHttpOptions = { http, corsProxy: '/api/git-proxy' } as const;

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
    const host = new URL(normalizeGitUrl(gitUrl)).hostname;

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
    return { headers } as const;
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
  } as const;
};

export interface AheadBehind {
  ahead: number;
  behind: number;
}

// Computes ahead/behind for remote branches (origin).
export async function computeAheadBehindFromRemote(
  gitUrl: string,
  featureBranch: string,
  baseBranch: string,
): Promise<AheadBehind | null> {
  try {
    const fs = new FS('ProjectFS');
    const projectName = gitUrl.split('/').pop()?.replace('.git', '') || 'unknown';
    const dir = `/${projectName}`;

    // Try to fetch to update refs; ignore errors
    try {
      await git.fetch({ fs, dir, remote: 'origin', ...gitHttpOptions, ...getGitAuthOptions(gitUrl) });
    } catch {}

    const featureRef = `refs/remotes/origin/${featureBranch}`;
    const baseRef = `refs/remotes/origin/${baseBranch}`;

    let featureCommits: any[] = [];
    let baseCommits: any[] = [];

    try {
      featureCommits = await git.log({ fs, dir, ref: featureRef, depth: 100 });
    } catch {
      // Feature branch may not exist on remote
      return null;
    }

    try {
      baseCommits = await git.log({ fs, dir, ref: baseRef, depth: 100 });
    } catch {
      return null;
    }

    const baseSet = new Set(baseCommits.map((c) => c.oid));
    const featSet = new Set(featureCommits.map((c) => c.oid));

    // ahead: commits in feature not in base
    const ahead = featureCommits.filter((c) => !baseSet.has(c.oid)).length;

    // behind: commits in base not in feature
    const behind = baseCommits.filter((c) => !featSet.has(c.oid)).length;

    return { ahead, behind };
  } catch {
    return null;
  }
}
