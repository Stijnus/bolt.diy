export type VerbosityLevel = 'minimal' | 'standard' | 'detailed';
import type { SupabaseConnectionState, SupabaseProject } from '~/lib/stores/supabase';

export interface LegacySupabaseConnectionState {
  isConnected: boolean;
  hasSelectedProject: boolean;
  selectedProjectId?: string;
  projectName?: string;
  projectRegion?: string;
  organizationId?: string;
  projectCreatedAt?: string;
  projectTables?: number;
  credentials?: {
    anonKey?: string;
    supabaseUrl?: string;
  };
}

function createStubProject(legacy: LegacySupabaseConnectionState): SupabaseProject {
  const projectId = legacy.selectedProjectId || 'legacy-project';

  return {
    id: projectId,
    name: legacy.projectName || 'Selected Project',
    region: legacy.projectRegion || 'us-east-1',
    organization_id: legacy.organizationId || '',
    status: 'active',
    created_at: legacy.projectCreatedAt || new Date().toISOString(),
    stats:
      legacy.projectTables !== undefined
        ? {
            database: {
              tables: legacy.projectTables,
              size: 'unknown',
            },
          }
        : undefined,
  };
}

export function normalizeSupabaseConnectionState(
  state?: SupabaseConnectionState | LegacySupabaseConnectionState,
): SupabaseConnectionState {
  if (!state) {
    return {
      user: null,
      token: '',
      stats: undefined,
      selectedProjectId: undefined,
      isConnected: false,
      project: undefined,
    };
  }

  if ('token' in state) {
    const storeState = state as SupabaseConnectionState;
    return {
      ...storeState,
      isConnected: storeState.isConnected ?? (!!storeState.user && !!storeState.token),
    };
  }

  const legacy = state as LegacySupabaseConnectionState;
  const stubProject = legacy.hasSelectedProject ? createStubProject(legacy) : undefined;

  return {
    user: legacy.isConnected
      ? {
          id: 'legacy-user',
          email: 'connected@supabase.local',
          role: 'Owner',
          created_at: new Date().toISOString(),
          last_sign_in_at: new Date().toISOString(),
        }
      : null,
    token: legacy.isConnected ? 'connected' : '',
    stats: stubProject
      ? {
          projects: [stubProject],
          totalProjects: 1,
        }
      : {
          projects: [],
          totalProjects: 0,
        },
    selectedProjectId: stubProject?.id,
    isConnected: legacy.isConnected,
    project: stubProject,
    credentials: legacy.credentials,
  };
}

export interface SupabaseWorkflowContext {
  connectionState: SupabaseConnectionState;
  needsProject: boolean;
  needsProjectSelection: boolean;
  needsSetup: boolean;
  hasExistingTables: boolean;
  isNewProject: boolean;
  projectsAvailable: number;
}

/**
 * Generates workflow-aware Supabase instructions based on current state and context
 */
export function getSupabaseWorkflowInstructions(
  context: SupabaseWorkflowContext,
  verbosity: VerbosityLevel = 'standard',
): string {
  const { connectionState, needsProject, needsProjectSelection, needsSetup } = context;

  // No connection - guide through full setup
  if (!connectionState.token) {
    return getInitialConnectionInstructions(verbosity);
  }

  // Connected but needs project creation
  if (needsProject && context.projectsAvailable === 0) {
    return getProjectCreationInstructions(connectionState, verbosity);
  }

  // Connected but needs to select an existing project
  if (needsProjectSelection) {
    return getProjectSelectionInstructions(connectionState, verbosity, context.projectsAvailable);
  }

  // Has project but needs setup
  if (needsSetup) {
    return getProjectSetupInstructions(connectionState, verbosity);
  }

  // Fully configured - provide operational instructions
  return getOperationalInstructions(context, verbosity);
}

function getInitialConnectionInstructions(verbosity: VerbosityLevel): string {
  switch (verbosity) {
    case 'minimal':
      return `CRITICAL: Supabase not connected. User must connect account first. Remind them to "connect to Supabase in chat settings" before proceeding.`;

    case 'detailed':
      return `<supabase_connection_required>
CRITICAL: Supabase Account Connection Required

The user needs to connect their Supabase account before any database operations can be performed.

Workflow Steps:
1. User must click "Connect to Supabase" in the chat interface
2. Authenticate with their Supabase account
3. Select organization and project
4. Configure API keys for the selected project

Until connected, you cannot:
- Create or execute database queries
- Create migration files
- Set up project environments
- Access Supabase features

Response Template:
"To proceed with Supabase database operations, please connect your Supabase account first. Click the Supabase connection button in the chat interface and follow the authentication flow."
</supabase_connection_required>`;

    default:
      return `<supabase_setup>
CRITICAL: Supabase Account Connection Required

You need to connect to Supabase before proceeding with database operations.

Steps Required:
1. Connect Supabase account via chat interface
2. Authenticate and select organization
3. Choose or create a project
4. Configure environment variables

Inform the user: "Please connect your Supabase account in the chat interface before proceeding with database setup."
</supabase_setup>`;
  }
}

function getProjectCreationInstructions(connectionState: SupabaseConnectionState, verbosity: VerbosityLevel): string {
  const sampleProject = connectionState.stats?.projects?.[0];
  const organizationId = sampleProject?.organization_id || connectionState.project?.organization_id || 'org-id';
  const passwordGuidance =
    'Generate a secure 16+ character password using crypto.randomUUID() or a similar secure random generator.';

  switch (verbosity) {
    case 'minimal':
      return `Connected to Supabase but no project. Use <boltAction type="supabase" operation="project-create" name="project-name" organizationId="${organizationId}" dbPassword="(secure 16+ char password)"> and follow setup.`;

    case 'detailed':
      return `<supabase_project_creation>
SUPABASE PROJECT CREATION WORKFLOW

Current State: Authenticated but no projects exist yet
Organization ID: ${organizationId}

Project Creation Process:
1. Collect project requirements from user
2. Generate secure database password
3. Create project via API
4. Monitor initialization progress
5. Configure environment once ready

Project Creation Action:
<boltAction type="supabase" operation="project-create" name="project-name" organizationId="${organizationId}" dbPassword="(secure 16+ char password)">

Required Parameters:
- name: 2-63 chars, lowercase, alphanumeric and hyphens only
- organizationId: ${organizationId !== 'org-id' ? organizationId : 'Provided by user'}
- dbPassword: ${passwordGuidance}
- region: (optional, defaults to us-east-1)
- plan: (optional, defaults to free)

After Creation:
1. Project initialization takes 1-2 minutes
2. Wait for ACTIVE_HEALTHY status
3. Fetch API keys once ready
4. Set up environment configuration

Error Handling:
- Name conflicts: Suggest alternative names
- Subscription limits: Guide to upgrade plans
- Invalid parameters: Provide format requirements
</supabase_project_creation>`;

    default:
      return `<supabase_project_setup>
SUPABASE PROJECT REQUIRED

Connected to Supabase but no project available for database operations.

Options:
1. Create New Project:
   <boltAction type="supabase" operation="project-create" name="project-name" organizationId="${organizationId}" dbPassword="${passwordGuidance}">

2. Select Existing Project (if available):
   Guide user to select project in chat interface

Project Creation Requirements:
- Unique project name (2-63 chars, lowercase, alphanumeric/hyphens)
- Secure database password
- Organization selection

Post-Creation:
- Wait for project initialization (1-2 minutes)
- Configure API keys automatically
- Set up environment variables
</supabase_project_setup>`;
  }
}

function getProjectSetupInstructions(connectionState: SupabaseConnectionState, verbosity: VerbosityLevel): string {
  const projectId = connectionState.selectedProjectId;

  switch (verbosity) {
    case 'minimal':
      return `Project selected but not configured. Setup with: <boltAction type="supabase" operation="setup" projectId="${projectId}">`;

    case 'detailed':
      return `<supabase_project_setup_detailed>
SUPABASE PROJECT ENVIRONMENT SETUP

Current State: Project selected but environment not configured
Project ID: ${projectId}

Setup Workflow:
1. Verify project is active and healthy
2. Fetch API keys (anon and service role)
3. Generate environment configuration
4. Create .env file with credentials
5. Update connection state

Setup Action:
<boltAction type="supabase" operation="setup" projectId="${projectId}">

Generated Environment:
- VITE_SUPABASE_URL=https://[project-id].supabase.co
- VITE_SUPABASE_ANON_KEY=[anon-key]
- SUPABASE_SERVICE_ROLE_KEY=[service-role-key] (optional)

Validation Steps:
1. Test database connectivity
2. Verify API key permissions
3. Check project services status

Post-Setup Tasks:
- Enable Row Level Security (RLS) on new tables
- Configure authentication settings
- Set up storage buckets if needed
</supabase_project_setup_detailed>`;

    default:
      return `<supabase_environment_setup>
SUPABASE PROJECT CONFIGURATION REQUIRED

Project selected but environment not configured for development.

Setup Action:
<boltAction type="supabase" operation="setup" projectId="${projectId}">

This will:
- Fetch API keys from your project
- Generate .env file with configuration
- Test database connectivity
- Configure development environment

After setup, you can:
- Create and execute database migrations
- Run SQL queries
- Set up authentication
- Configure storage
</supabase_environment_setup>`;
  }
}

function getOperationalInstructions(context: SupabaseWorkflowContext, verbosity: VerbosityLevel): string {
  const { connectionState, hasExistingTables, isNewProject } = context;

  switch (verbosity) {
    case 'minimal':
      return `Supabase ready. Migrations: <boltAction type="supabase" operation="migration" filePath="/supabase/migrations/name.sql">content</boltAction>. Queries: <boltAction type="supabase" operation="query">SQL</boltAction>`;

    case 'detailed':
      return `<supabase_operational_instructions>
SUPABASE FULLY CONFIGURED - OPERATIONAL MODE

Current State: Project configured and ready for development
Project: ${connectionState.project?.name || 'Selected Project'}
Existing Tables: ${hasExistingTables ? 'Yes' : 'None detected'}
Project Age: ${isNewProject ? 'New/Empty' : 'Established'}

DATABASE OPERATIONS:

1. Migration Management:
   <boltAction type="supabase" operation="migration" filePath="/supabase/migrations/create_table_name.sql">
   -- Migration comment describing changes
   CREATE TABLE table_name (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     created_at timestamptz DEFAULT now(),
     updated_at timestamptz DEFAULT now()
   );

   -- Enable RLS
   ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

   -- Add RLS policies
   CREATE POLICY "Users can view own records" ON table_name
     FOR SELECT USING (auth.uid() = user_id);
   </boltAction>

2. Direct Query Execution:
   <boltAction type="supabase" operation="query">
   SELECT * FROM table_name LIMIT 10;
   </boltAction>

3. Database Validation:
   <boltAction type="supabase" operation="validate">
   -- Validates connection and basic operations
   </boltAction>

4. Seed Data Loading:
   <boltAction type="supabase" operation="seed" filePath="/supabase/seed.sql">
   INSERT INTO table_name (column1, column2) VALUES
   ('value1', 'value2'),
   ('value3', 'value4');
   </boltAction>

BEST PRACTICES:
- Always enable RLS on new tables
- Use descriptive migration names without number prefixes
- Create policies for all CRUD operations
- Use UUID primary keys with gen_random_uuid()
- Include timestamps (created_at, updated_at)
- Add comments explaining migration purpose
- Test destructive operations with SELECT first

AUTHENTICATION SETUP:
- Configure auth providers in Supabase dashboard
- Set up email templates
- Configure RLS policies for user access
- Implement auth.uid() in policies

STORAGE CONFIGURATION:
- Create buckets for file uploads
- Set up RLS policies for storage access
- Configure CORS for client-side uploads
</supabase_operational_instructions>`;

    default:
      return `<supabase_operational>
SUPABASE READY FOR DEVELOPMENT

Project configured and ready for database operations.

Common Operations:

1. Create Migration:
   <boltAction type="supabase" operation="migration" filePath="/supabase/migrations/table_name.sql">
   CREATE TABLE table_name (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     created_at timestamptz DEFAULT now()
   );
   ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
   </boltAction>

2. Execute Query:
   <boltAction type="supabase" operation="query">
   SELECT * FROM table_name;
   </boltAction>

3. Validate Setup:
   <boltAction type="supabase" operation="validate">
   </boltAction>

Migration Best Practices:
- Enable RLS on new tables
- Create descriptive policy names
- Use UUID primary keys
- Include created_at/updated_at timestamps
- Add migration comments
</supabase_operational>`;
  }
}

function getProjectSelectionInstructions(
  connectionState: SupabaseConnectionState,
  verbosity: VerbosityLevel,
  projectsAvailable: number,
): string {
  const projectNames = (connectionState.stats?.projects || []).map((project) => project.name).slice(0, 5);
  const projectList = projectNames.length > 0 ? projectNames.join(', ') : 'Projects available in account';

  switch (verbosity) {
    case 'minimal':
      return `Supabase connected. ${projectsAvailable} project${projectsAvailable === 1 ? '' : 's'} found. Ask user to select one via Supabase settings panel.`;

    case 'detailed':
      return `<supabase_project_selection>
SUPABASE PROJECT SELECTION REQUIRED

Current State: Authenticated with Supabase. ${projectsAvailable} project${projectsAvailable === 1 ? '' : 's'} detected but none selected.

Available Projects: ${projectList}

Selection Workflow:
1. Ask which project the user wants to use
2. Instruct them to open the Supabase connector in chat settings
3. Click "Select" next to the desired project
4. Confirm selection before continuing database work

If the list looks outdated, remind them to refresh the connector or create a new project.
</supabase_project_selection>`;

    default:
      return `<supabase_project_required>
Supabase connection detected but no project selected.

Detected projects: ${projectList}

Guide the user to open the Supabase connector in chat settings and select the project before continuing.
</supabase_project_required>`;
  }
}

/**
 * Determines the current Supabase workflow context
 */
export function analyzeSupabaseContext(connectionState: SupabaseConnectionState): SupabaseWorkflowContext {
  const normalized = normalizeSupabaseConnectionState(connectionState);
  const hasToken = !!normalized.token;
  const projectsAvailable = normalized.stats?.projects?.length ?? 0;
  const hasSelectedProject = !!normalized.selectedProjectId;
  const hasCredentials = !!(normalized.credentials?.anonKey && normalized.credentials?.supabaseUrl);

  const selectedProjectStats =
    normalized.project?.stats ||
    normalized.stats?.projects?.find((project) => project.id === normalized.selectedProjectId)?.stats;

  const tableCount = selectedProjectStats?.database?.tables ?? 0;
  const hasExistingTables = tableCount > 0;

  const createdAt = normalized.project?.created_at;
  let isNewProject = !hasExistingTables;

  if (createdAt) {
    const createdTime = Date.parse(createdAt);

    if (!Number.isNaN(createdTime)) {
      const ageInDays = (Date.now() - createdTime) / (1000 * 60 * 60 * 24);

      if (ageInDays < 7 && !hasExistingTables) {
        isNewProject = true;
      } else if (ageInDays >= 7) {
        isNewProject = false;
      }
    }
  }

  return {
    connectionState: normalized,
    needsProject: hasToken && projectsAvailable === 0,
    needsProjectSelection: hasToken && projectsAvailable > 0 && !hasSelectedProject,
    needsSetup: hasToken && hasSelectedProject && !hasCredentials,
    hasExistingTables,
    isNewProject,
    projectsAvailable,
  };
}
