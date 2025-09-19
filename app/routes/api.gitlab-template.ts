import { json } from '@remix-run/cloudflare';
import { withSecurity } from '~/lib/security';

async function fetchGitLabRepoContents(repo: string, gitlabUrl: string = 'https://gitlab.com', token?: string) {
  const baseUrl = `${gitlabUrl}/api/v4`;
  const encodedRepo = encodeURIComponent(repo);

  // Get project info
  const projectResponse = await fetch(`${baseUrl}/projects/${encodedRepo}`, {
    headers: {
      'User-Agent': 'bolt.diy-app',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!projectResponse.ok) {
    throw new Error(`GitLab project not found: ${repo}`);
  }

  const projectData = (await projectResponse.json()) as any;
  const defaultBranch = projectData.default_branch;

  // Get repository tree
  const treeResponse = await fetch(
    `${baseUrl}/projects/${encodedRepo}/repository/tree?recursive=true&ref=${defaultBranch}&per_page=100`,
    {
      headers: {
        'User-Agent': 'bolt.diy-app',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    },
  );

  if (!treeResponse.ok) {
    throw new Error(`Failed to fetch GitLab repository tree: ${treeResponse.status}`);
  }

  const treeData = (await treeResponse.json()) as any[];

  // Filter files and fetch content
  const files = treeData.filter(
    (item: any) =>
      item.type === 'blob' &&
      !item.path.startsWith('.git/') &&
      (!item.path.endsWith('.lock') || item.path.includes('package-lock.json')),
  );

  const fileContents = [];
  const batchSize = 10;

  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    const batchPromises = batch.map(async (file: any) => {
      try {
        const contentResponse = await fetch(
          `${baseUrl}/projects/${encodedRepo}/repository/files/${encodeURIComponent(file.path)}/raw?ref=${defaultBranch}`,
          {
            headers: {
              'User-Agent': 'bolt.diy-app',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          },
        );

        if (!contentResponse.ok) {
          console.warn(`Failed to fetch ${file.path}: ${contentResponse.status}`);
          return null;
        }

        const content = await contentResponse.text();

        return {
          name: file.path.split('/').pop() || '',
          path: file.path,
          content,
        };
      } catch (error) {
        console.warn(`Error fetching ${file.path}:`, error);
        return null;
      }
    });

    const batchResults = await Promise.all(batchPromises);
    fileContents.push(...batchResults.filter(Boolean));

    if (i + batchSize < files.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return fileContents;
}

async function gitlabTemplateLoader({ request, context }: { request: Request; context: any }) {
  const url = new URL(request.url);
  const repo = url.searchParams.get('repo');
  const gitlabUrl = url.searchParams.get('gitlab_url') || 'https://gitlab.com';

  if (!repo) {
    return json({ error: 'Repository name is required' }, { status: 400 });
  }

  try {
    const gitlabToken = context?.cloudflare?.env?.GITLAB_TOKEN || process.env.GITLAB_TOKEN;
    const fileList = await fetchGitLabRepoContents(repo, gitlabUrl, gitlabToken);

    return json(fileList);
  } catch (error) {
    console.error('Error processing GitLab template:', error);
    return json(
      {
        error: 'Failed to fetch GitLab template files',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export const loader = withSecurity(gitlabTemplateLoader);
