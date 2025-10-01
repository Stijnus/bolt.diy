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
  /*
   * Try to get organization ID from multiple sources, in order of preference:
   * 1. Organization ID from existing projects (keeps projects together)
   * 2. Organization ID from selected project
   * 3. First available organization from organizations list (fallback)
   */
  const organizationId =
    connectionState.stats?.projects?.[0]?.organization_id ||
    connectionState.project?.organization_id ||
    connectionState.organizations?.[0]?.id;

  if (!organizationId) {
    // If no organization ID is available, instruct to reconnect
    return `<supabase_organization_missing>
CRITICAL: No Supabase organization available for project creation.

The user needs to reconnect to Supabase to fetch their organization information.

ACTION REQUIRED:
Inform the user: "I need you to reconnect your Supabase account to fetch your organization details. Please disconnect and reconnect Supabase in the settings."

DO NOT proceed with project creation until organization information is available.
</supabase_organization_missing>`;
  }

  switch (verbosity) {
    case 'minimal':
      return `Connected to Supabase but no project. If user explicitly says "create Supabase project", infer name from context and create immediately. Otherwise ask user for project name, then use <boltAction type="supabase" operation="project-create" name="project-name" organizationId="${organizationId}" dbPassword="[auto-generated-24-char-password]"> with auto-generated secure password.`;

    case 'detailed':
      return `<supabase_project_creation>
SUPABASE PROJECT CREATION WORKFLOW - INTERACTIVE MODE

Current State: Authenticated but no projects exist yet
Organization ID: ${organizationId}

CRITICAL: Detect user intent FIRST before asking questions!

INTENT DETECTION - USER EXPLICITLY REQUESTS PROJECT CREATION:
If the user's message contains ANY of these explicit phrases:
- "create a new Supabase project"
- "create a Supabase project"
- "set up a new Supabase project"
- "make a new Supabase project"
- "spin up a Supabase project"
- "initialize a Supabase project"

ACTION: Skip the question and create the project IMMEDIATELY!
1. Infer project name from the user's context (e.g., "kanban board" → "kanban-board")
2. If no clear name, use a generic descriptive name based on their request
3. Generate password automatically
4. Create the boltAction in your FIRST response

EXAMPLE - EXPLICIT CREATION REQUEST:
User: "Make a kanban board with drag and drop with Supabase real-time sync, create a new Supabase project and execute the SQL"

Your response (NO QUESTIONS - complete workflow in ONE artifact):
"I'll create a kanban board with drag-and-drop and Supabase real-time sync. Setting up a new Supabase project 'kanban-board' with the database schema..."

<boltArtifact id="kanban-board-supabase" title="Kanban Board with Supabase">
<boltAction type="supabase" operation="project-create" name="kanban-board" organizationId="${organizationId}" dbPassword="Xy9$mK2@pLqR8#nV4wT7jF3h">
</boltAction>

<boltAction type="supabase" operation="migration" filePath="/supabase/migrations/001_kanban_schema.sql">
-- Kanban board schema
CREATE TABLE boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid REFERENCES boards(id) ON DELETE CASCADE,
  title text NOT NULL,
  status text NOT NULL,
  position integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Policies (public access for demo)
CREATE POLICY "Enable read access for all users" ON boards FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON tasks FOR SELECT USING (true);
</boltAction>

<boltAction type="file" filePath="package.json">
{
  "name": "kanban-board",
  "dependencies": {
    "@supabase/supabase-js": "^2.39.0",
    "react": "^18.2.0",
    "react-beautiful-dnd": "^13.1.1"
  }
}
</boltAction>

<boltAction type="shell">
npm install
</boltAction>

<boltAction type="start">
npm run dev
</boltAction>
</boltArtifact>

"Your Supabase project is being created (1-2 min). The schema will be applied automatically once ready, then the app will start!"

---

STANDARD WORKFLOW - USER DOESN'T EXPLICITLY REQUEST PROJECT:
If user's message is ambiguous (e.g., "Build a task manager with Supabase"), follow interactive flow:

STEP 1: ASK FOR PROJECT NAME
Ask the user ONE simple question: "What would you like to name your Supabase project?"
- Explain naming rules: lowercase letters, numbers, hyphens only (2-63 chars)
- Example: "task-manager" or "my-app"
- If they provide invalid name, suggest sanitized version

STEP 2: GENERATE SECURE PASSWORD AUTOMATICALLY
DO NOT ask user for password. Instead, generate it programmatically:
\`\`\`javascript
// Generate secure 24-character password
const generatePassword = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  return Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map(x => chars[x % chars.length]).join('');
};
const dbPassword = generatePassword();
\`\`\`

STEP 3: CREATE PROJECT IMMEDIATELY
Once you have the name and generated password, create the boltAction in the SAME response:

<boltAction type="supabase" operation="project-create" name="user-provided-name" organizationId="${organizationId}" dbPassword="[generated-password]">

EXAMPLE STANDARD WORKFLOW:
User: "Build a task manager with Supabase"

Your response:
"I'll create a Supabase project for your task manager. What would you like to name it? (e.g., 'task-manager', 'my-tasks')"

User: "task-manager"

Your response:
"Perfect! Creating Supabase project 'task-manager' with a secure auto-generated database password..."

<boltArtifact id="supabase-project-setup" title="Supabase Project Setup">
<boltAction type="supabase" operation="project-create" name="task-manager" organizationId="${organizationId}" dbPassword="Xy9$mK2@pLqR8#nV4wT7jF3h">
</boltAction>
</boltArtifact>

"Your project is being created. This typically takes 1-2 minutes. I'll automatically configure the environment once it's ready."

REQUIRED PARAMETERS:
- name: User-provided name (sanitized to meet requirements)
- organizationId: "${organizationId}" (auto-detected from connected account)
- dbPassword: Auto-generated 24-character secure password (NEVER show to user, just mention it's auto-generated)
- region: (optional, defaults to us-east-1)
- plan: (optional, defaults to free)

POST-CREATION WORKFLOW (FULLY AUTOMATIC):
1. ✅ Project creation initiated via API
2. ✅ System polls status until ACTIVE_HEALTHY (1-2 minutes)
3. ✅ API keys fetched automatically
4. ✅ .env file created with credentials
5. ✅ Project auto-selected in connection state
6. ✅ Ready for database operations immediately!

IMPORTANT: After creating the project, the system handles EVERYTHING automatically:
- Waiting for project to be ready
- Fetching and configuring API keys
- Setting up environment variables
- Selecting the new project

YOU DON'T NEED TO:
❌ Ask user to manually copy environment variables
❌ Tell them to wait or check Supabase dashboard
❌ Instruct them to configure anything manually
❌ Wait for user confirmation to continue

AFTER PROJECT CREATION:
The project will be automatically configured. You can IMMEDIATELY continue with:

<boltAction type="supabase" operation="migration" filePath="/supabase/migrations/001_init.sql">
CREATE TABLE your_table (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;
</boltAction>

Then continue building the application as if the project was already set up!

ERROR HANDLING:
- Name conflicts: Suggest appending random suffix (e.g., "task-manager-xyz")
- Subscription limits: Explain user needs Supabase Pro plan
- Timeout: If initialization takes >5 minutes, show error
- Invalid parameters: Show corrected format and retry

EXAMPLE FLOW:
User: "Create project task-manager"
You: [Create boltAction]
System: [Automatically initializes project]
You: "Great! Now creating the database schema..."
     [Create migration boltAction]
     [Continue building app]
</supabase_project_creation>`;

    default:
      return `<supabase_project_setup>
SUPABASE PROJECT CREATION REQUIRED

Connected to Supabase but no project available for database operations.

CRITICAL: Detect explicit project creation intent!

IF USER EXPLICITLY SAYS "create a Supabase project", "create new Supabase project", "set up Supabase project", etc.:
→ SKIP QUESTIONS! Create project immediately with inferred name from context.
→ Include migrations, app files, npm install, and start in the SAME artifact
→ Example: "kanban board app, create Supabase project" → create "kanban-board" + schema + app

IF USER REQUEST IS AMBIGUOUS (just mentions "with Supabase"):
→ Follow interactive workflow below.

INTERACTIVE WORKFLOW:
1. Ask user: "What would you like to name your Supabase project?"
2. Generate secure 24-char password automatically using crypto APIs
3. Create project immediately:
   <boltAction type="supabase" operation="project-create" name="[user-name]" organizationId="${organizationId}" dbPassword="[auto-generated]">

PROJECT NAMING RULES:
- 2-63 characters long
- Lowercase letters, numbers, hyphens only
- Must start and end with alphanumeric characters
- Example: "my-app", "task-manager", "blog-api"

PASSWORD GENERATION (automatic):
\`\`\`javascript
const password = Array.from(crypto.getRandomValues(new Uint8Array(24)))
  .map(x => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'[x % 70])
  .join('');
\`\`\`

POST-CREATION (FULLY AUTOMATIC):
1. System waits for project to be ready (1-2 minutes)
2. API keys fetched and configured automatically
3. .env file created automatically
4. Project auto-selected
5. You can immediately use migrations and queries!

NO MANUAL STEPS NEEDED - continue building right away!
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
  const organizationId =
    connectionState.stats?.projects?.[0]?.organization_id ||
    connectionState.project?.organization_id ||
    connectionState.organizations?.[0]?.id;

  switch (verbosity) {
    case 'minimal':
      return `Supabase connected. ${projectsAvailable} project${projectsAvailable === 1 ? '' : 's'} found: ${projectList}. If user explicitly says "create Supabase project", infer name and create immediately. Otherwise ask: use existing or create new project?`;

    case 'detailed':
      return `<supabase_project_selection_or_creation>
SUPABASE PROJECT SELECTION OR CREATION

Current State: Authenticated with Supabase
Available Projects (${projectsAvailable}): ${projectList}

🚨 CRITICAL: DETECT EXPLICIT PROJECT CREATION INTENT FIRST! 🚨

INTENT DETECTION - USER EXPLICITLY REQUESTS NEW PROJECT CREATION:
If the user's message contains ANY of these explicit phrases:
- "create a new Supabase project"
- "create a Supabase project"
- "set up a new Supabase project"
- "make a new Supabase project"
- "spin up a Supabase project"
- "initialize a new Supabase project"
- "fresh Supabase instance"
- "new Supabase database"

ACTION: User has ALREADY chosen to create new project! Skip all questions!
1. Infer project name from context (e.g., "kanban board" → "kanban-board")
2. If no clear name, derive from their feature request
3. Generate password automatically
4. Create boltAction in your FIRST response - NO QUESTIONS!

EXAMPLE - EXPLICIT NEW PROJECT REQUEST:
User: "Make a kanban board with Supabase real-time sync, create a new Supabase project"

Your response (NO QUESTIONS - even though they have existing projects):
"I'll create a new Supabase project 'kanban-board' with real-time sync..."

<boltArtifact id="kanban-board" title="Kanban Board with Supabase">
<boltAction type="supabase" operation="project-create" name="kanban-board" organizationId="${organizationId}" dbPassword="[generated]">
</boltAction>

<boltAction type="supabase" operation="migration" filePath="/supabase/migrations/001_schema.sql">
CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  status text NOT NULL
);
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
</boltAction>

<boltAction type="file" filePath="src/App.tsx">
[Kanban board component code]
</boltAction>

<boltAction type="shell">
npm install @supabase/supabase-js
</boltAction>

<boltAction type="start">
npm run dev
</boltAction>
</boltArtifact>

---

STANDARD WORKFLOW - USER DOESN'T EXPLICITLY REQUEST NEW PROJECT:
If request is ambiguous (e.g., "Build task manager with Supabase"), offer BOTH options:

USER HAS TWO OPTIONS:

OPTION 1: USE EXISTING PROJECT
- Ask which project they want to use
- Guide them: "Open the Supabase connector in chat settings and click 'Select' next to your preferred project"
- Wait for selection before proceeding

OPTION 2: CREATE NEW PROJECT
- If user wants a new dedicated project for this task:
  1. Ask for project name
  2. Generate secure password automatically
  3. Create immediately using boltAction

RECOMMENDED APPROACH:
Ask: "I see you have ${projectsAvailable} Supabase project${projectsAvailable === 1 ? '' : 's'} (${projectList}). Would you like to use one of these, or create a new project for this [task/feature]?"

If user chooses to CREATE NEW PROJECT:

STEP 1: Ask for project name
"What would you like to name your new Supabase project? (e.g., 'task-manager', 'blog-api')"

STEP 2: Generate password and create immediately
<boltAction type="supabase" operation="project-create"
            name="[user-provided-name]"
            organizationId="${organizationId}"
            dbPassword="[auto-generated-24-char-password]">

Example Complete Flow:
User: "Build a task manager with Supabase"
You: "I see you have ${projectsAvailable} projects (${projectList}). Would you like to use one of these or create a new project called 'task-manager'?"
User: "Create a new one"
You: "Great! What would you like to name it?"
User: "task-manager"
You: [Generate password, create boltAction immediately]

IMPORTANT RULES:
- NEVER assume user wants existing projects
- ALWAYS offer project creation as an option
- When creating: auto-generate password, never ask user for it
- Make the choice clear and explicit
</supabase_project_selection_or_creation>`;

    default:
      return `<supabase_project_required>
SUPABASE PROJECT OPTIONS

You have ${projectsAvailable} existing project${projectsAvailable === 1 ? '' : 's'}: ${projectList}

🚨 CRITICAL: Detect if user explicitly says "create new Supabase project", "create a Supabase project", "set up new Supabase project", etc.

IF EXPLICIT NEW PROJECT REQUEST:
→ User already chose! Infer name from context, create immediately - NO QUESTIONS!
→ Example: "kanban board, create new Supabase project" → create "kanban-board" project right away

IF AMBIGUOUS REQUEST (just mentions "with Supabase"):
→ Offer both options below

USER CAN CHOOSE:
1. Use existing project - guide them to select via Supabase connector
2. Create new project - ask for name, then create with boltAction

Ask: "Would you like to use one of your existing projects (${projectList}) or create a new one for this task?"

If creating new:
- Ask for project name
- Auto-generate secure password
- Use: <boltAction type="supabase" operation="project-create" name="[name]" organizationId="${organizationId}" dbPassword="[generated]">
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
