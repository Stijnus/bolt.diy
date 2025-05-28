import type { ActionFunctionArgs } from '@remix-run/cloudflare';
import { json } from '@remix-run/cloudflare';
import { Toucan } from 'toucan-js'; // For Sentry, if configured
import { webcrypto } from 'node:crypto'; // Using node:crypto for Web Crypto API

// Define types for Cloudflare API interactions (can be expanded and moved to types/cloudflare.ts)
interface CloudflareError {
  code: number;
  message: string;
}

interface CloudflareProject {
  id: string;
  name: string;
  subdomain: string;
  latest_deployment?: CloudflareDeploymentInfo;
  created_on: string;
  // ... other project properties
}

interface CloudflareDeploymentInfo {
  id: string;
  url: string;
  latest_stage: {
    name: string;
    status: string; // e.g., 'success', 'pending', 'failure'
  };
  // ... other deployment properties
}

interface DeployRequestBody {
  files: Record<string, string>; // file path -> file content (as string)
  token: string;
  accountId: string;
  projectName: string;
  chatId: string; // Used for context, perhaps project naming or logging
}

const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4';

async function sha1(data: string): Promise<string> {
  const buffer = new TextEncoder().encode(data);
  const hashBuffer = await webcrypto.subtle.digest('SHA-1', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const action = async ({ request, context }: ActionFunctionArgs) => {
  // const sentry = new Toucan({
  //   dsn: context.cloudflare.env.SENTRY_DSN,
  //   context,
  //   request,
  // });

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  let body: DeployRequestBody;
  try {
    body = await request.json();
  } catch (error) {
    // sentry.captureException(error);
    return json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { files, token, accountId, projectName: rawProjectName } = body;

  if (!token || !accountId || !rawProjectName) {
    return json({ error: 'Missing token, accountId, or projectName' }, { status: 400 });
  }
  if (!files || Object.keys(files).length === 0) {
    return json({ error: 'No files provided for deployment' }, { status: 400 });
  }

  // Sanitize project name (Cloudflare has restrictions)
  const projectName = rawProjectName.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 58);

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json', // Default, will be overridden for FormData
  };

  try {
    // Step 1: Check if project exists, create if not
    let project: CloudflareProject | null = null;
    const projectDetailsUrl = `${CLOUDFLARE_API_BASE}/accounts/${accountId}/pages/projects/${projectName}`;

    const existingProjectResponse = await fetch(projectDetailsUrl, { headers: { ...headers, 'Content-Type': 'application/json'} });

    if (existingProjectResponse.status === 404) {
      const createProjectBody = {
        name: projectName,
        production_branch: 'main', // Default, not strictly necessary for direct uploads
        build_config: null, // We are uploading prebuilt files
        deployment_configs: {
          production: {
            // compatibility_date: new Date().toISOString().split('T')[0], // e.g., "2024-03-15"
            // compatibility_flags: ["nodejs_compat"], // Example flag
          },
        },
      };
      const createResponse = await fetch(`${CLOUDFLARE_API_BASE}/accounts/${accountId}/pages/projects`, {
        method: 'POST',
        headers: {...headers, 'Content-Type': 'application/json'},
        body: JSON.stringify(createProjectBody),
      });
      if (!createResponse.ok) {
        const errorData = await createResponse.json() as { errors: CloudflareError[] };
        console.error('Cloudflare project creation error:', errorData);
        return json({ error: 'Failed to create Cloudflare project', details: errorData.errors }, { status: createResponse.status });
      }
      project = (await createResponse.json() as { result: CloudflareProject }).result;
    } else if (existingProjectResponse.ok) {
      project = (await existingProjectResponse.json() as { result: CloudflareProject }).result;
    } else {
      const errorData = await existingProjectResponse.json() as { errors: CloudflareError[] };
      console.error('Cloudflare project fetch error:', errorData);
      return json({ error: 'Failed to fetch Cloudflare project details', details: errorData.errors }, { status: existingProjectResponse.status });
    }

    if (!project) {
      return json({ error: 'Project could not be found or created.' }, { status: 500 });
    }

    // Step 2: Prepare file manifest and FormData for upload
    const manifest: Record<string, string> = {};
    const formData = new FormData();

    for (const filePath in files) {
      const content = files[filePath];
      const hash = await sha1(content);
      // Cloudflare expects paths to not start with / in the manifest
      manifest[filePath.startsWith('/') ? filePath.substring(1) : filePath] = hash;
      // The key for the file in FormData should be its hash
      formData.append(hash, new Blob([content]), filePath.startsWith('/') ? filePath.substring(1) : filePath);
    }

    formData.append('manifest', JSON.stringify(manifest));

    // Step 3: Create new deployment with manifest and files
    const deployUrl = `${CLOUDFLARE_API_BASE}/accounts/${accountId}/pages/projects/${project.name}/deployments`;
    const deployResponse = await fetch(deployUrl, {
      method: 'POST',
      headers: { // Note: Content-Type is NOT set here, fetch API sets it for FormData
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!deployResponse.ok) {
      const errorData = await deployResponse.json().catch(() => ({ errors: [{ message: 'Unknown deployment error, non-JSON response' }] })) as { errors: CloudflareError[] };
      console.error('Cloudflare deployment error:', errorData, 'Status:', deployResponse.status);
      return json({ error: 'Cloudflare deployment failed', details: errorData.errors, status: deployResponse.status }, { status: deployResponse.status });
    }

    const deploymentResult = (await deployResponse.json() as { result: CloudflareDeploymentInfo }).result;

    // The deployment might still be in progress.
    // The client-side component can poll using the deployment ID if needed.
    // For this API, we return the initial successful response.

    return json({
      success: true,
      deployment: {
        id: deploymentResult.id,
        url: deploymentResult.url, // This is the preview URL
        // latest_stage might not be immediately 'success'
        state: deploymentResult.latest_stage?.status || 'processing',
      },
      project: {
        id: project.id,
        name: project.name,
        subdomain: project.subdomain, // e.g. project-name.pages.dev
      },
      projectId: project.id, // for client-side storage
      deploymentUrl: deploymentResult.url, // for immediate use
    });

  } catch (error: any) {
    console.error('Cloudflare deploy action error:', error);
    // sentry.captureException(error);
    return json({ error: 'Internal server error during deployment', details: error.message }, { status: 500 });
  }
};
