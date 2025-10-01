import { json, type ActionFunction } from '@remix-run/cloudflare';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('api.supabase.projects.status');

export interface ProjectStatusRequest {
  token: string;
  projectId: string;
}

export interface ProjectStatusResponse {
  success: boolean;
  project?: {
    id: string;
    name: string;
    status: string;
    region: string;
    database?: {
      host: string;
      version: string;
      postgres_engine: string;
      status: string;
    };
    ready: boolean;
    setupSteps: {
      database: boolean;
      api: boolean;
      auth: boolean;
      storage: boolean;
    };
  };
  error?: string;
  retryAfter?: number; // seconds to wait before next check
}

export const action: ActionFunction = async ({ request }) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const { token, projectId } = (await request.json()) as ProjectStatusRequest;

    logger.debug('Checking project status:', { projectId });

    if (!token || !projectId) {
      return json(
        {
          success: false,
          error: 'Missing required fields: token and projectId are required',
        },
        { status: 400 },
      );
    }

    // Get project details from Supabase Management API
    const projectResponse = await fetch(`https://api.supabase.com/v1/projects/${projectId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!projectResponse.ok) {
      const errorData = (await projectResponse.json()) as { message?: string } | null;
      logger.error('Project status check failed:', errorData);

      let errorMessage = 'Failed to get project status';

      if (projectResponse.status === 404) {
        errorMessage = 'Project not found';
      } else if (projectResponse.status === 403) {
        errorMessage = 'Access denied to project';
      } else if (errorData?.message) {
        errorMessage = errorData.message;
      }

      return json(
        {
          success: false,
          error: errorMessage,
        },
        { status: projectResponse.status },
      );
    }

    const project = (await projectResponse.json()) as {
      id: string;
      name: string;
      status: string;
      region: string;
      database?: {
        host: string;
        version: string;
        postgres_engine: string;
        status?: string;
      };
    };
    logger.debug('Project status retrieved:', project);

    // Determine if project is ready for use
    const normalizedStatus = project.status?.toUpperCase() ?? 'UNKNOWN';
    const isActive = ['ACTIVE_HEALTHY', 'ACTIVE', 'READY'].includes(normalizedStatus);
    const hasDatabase = project.database?.status ? project.database.status === 'HEALTHY' : true;

    // Check various service readiness
    const setupSteps = {
      database: hasDatabase,
      api: isActive,
      auth: isActive, // Auth is ready when project is active
      storage: isActive, // Storage is ready when project is active
    };

    const allReady = isActive && hasDatabase;

    // Calculate retry timing based on status
    let retryAfter = 10; // Default 10 seconds

    if (project.status === 'COMING_UP') {
      retryAfter = 15; // Project is starting up
    } else if (project.status === 'INACTIVE') {
      retryAfter = 30; // Project might need more time
    } else if (isActive && !hasDatabase) {
      retryAfter = 5; // Database should be ready soon
    }

    return json({
      success: true,
      project: {
        id: project.id,
        name: project.name ?? 'Supabase Project',
        status: project.status ?? 'UNKNOWN',
        region: project.region ?? 'us-east-1',
        database: project.database,
        ready: allReady,
        setupSteps,
      },
      retryAfter: allReady ? undefined : retryAfter,
    });
  } catch (error) {
    logger.error('Project status check error:', error);
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check project status',
      },
      { status: 500 },
    );
  }
};
