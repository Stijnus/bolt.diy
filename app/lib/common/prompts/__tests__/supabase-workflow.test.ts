import { describe, it, expect } from 'vitest';
import {
  analyzeSupabaseContext,
  getSupabaseWorkflowInstructions,
  normalizeSupabaseConnectionState,
} from '~/lib/common/prompts/supabase-workflow-rules';
import type { SupabaseConnectionState, SupabaseProject } from '~/lib/stores/supabase';
import type { SupabaseUser } from '~/types/supabase';

const baseUser: SupabaseUser = {
  id: 'user-1',
  email: 'owner@example.com',
  role: 'Owner',
  created_at: new Date().toISOString(),
  last_sign_in_at: new Date().toISOString(),
};

function createProject(overrides: Partial<SupabaseProject> = {}): SupabaseProject {
  const databaseStats = overrides.stats?.database;

  return {
    id: overrides.id ?? 'proj-1',
    name: overrides.name ?? 'Demo Project',
    organization_id: overrides.organization_id ?? 'org-1',
    region: overrides.region ?? 'us-east-1',
    status: overrides.status ?? 'active',
    created_at: overrides.created_at ?? new Date().toISOString(),
    stats: {
      database: {
        tables: databaseStats?.tables ?? 0,
        size: databaseStats?.size ?? '0',
        size_mb: databaseStats?.size_mb,
        views: databaseStats?.views,
        functions: databaseStats?.functions,
      },
    },
  };
}

function buildState(overrides: Partial<SupabaseConnectionState>): SupabaseConnectionState {
  return {
    user: overrides.user ?? baseUser,
    token: overrides.token ?? 'token',
    stats: overrides.stats ?? { projects: [], totalProjects: 0 },
    selectedProjectId: overrides.selectedProjectId,
    isConnected: overrides.isConnected ?? true,
    project: overrides.project,
    credentials: overrides.credentials,
  };
}

describe('Supabase workflow analyzer', () => {
  it('treats missing connection as not connected', () => {
    const context = analyzeSupabaseContext(normalizeSupabaseConnectionState(undefined));

    expect(context.needsProject).toBe(false);
    expect(context.needsProjectSelection).toBe(false);
    expect(context.needsSetup).toBe(false);

    const instructions = getSupabaseWorkflowInstructions(context, 'standard');
    expect(instructions).toContain('Supabase Account Connection Required');
  });

  it('requests project creation when no projects exist', () => {
    const state = buildState({
      stats: { projects: [], totalProjects: 0 },
      selectedProjectId: undefined,
      credentials: undefined,
    });

    const context = analyzeSupabaseContext(state);

    expect(context.needsProject).toBe(true);
    expect(context.projectsAvailable).toBe(0);

    const instructions = getSupabaseWorkflowInstructions(context, 'detailed');
    expect(instructions).toContain('SUPABASE PROJECT CREATION WORKFLOW');
    expect(instructions).toContain('operation="project-create"');
  });

  it('requests project selection when projects are available but none selected', () => {
    const project = createProject();
    const state = buildState({
      stats: { projects: [project], totalProjects: 1 },
      selectedProjectId: undefined,
      project: undefined,
      credentials: undefined,
    });

    const context = analyzeSupabaseContext(state);

    expect(context.needsProjectSelection).toBe(true);
    expect(context.projectsAvailable).toBe(1);

    const instructions = getSupabaseWorkflowInstructions(context, 'standard');
    expect(instructions).toContain('Supabase connection detected but no project selected');
  });

  it('requests project setup when credentials are missing', () => {
    const project = createProject();
    const state = buildState({
      stats: { projects: [project], totalProjects: 1 },
      selectedProjectId: project.id,
      project,
      credentials: undefined,
    });

    const context = analyzeSupabaseContext(state);

    expect(context.needsSetup).toBe(true);

    const instructions = getSupabaseWorkflowInstructions(context, 'standard');
    expect(instructions).toContain('operation="setup"');
  });

  it('provides operational guidance when project is fully configured', () => {
    const project = createProject({
      stats: {
        database: {
          tables: 3,
          size: '10',
        },
      },
    });

    const state = buildState({
      stats: { projects: [project], totalProjects: 1 },
      selectedProjectId: project.id,
      project,
      credentials: {
        anonKey: 'anon',
        supabaseUrl: 'https://demo.supabase.co',
      },
    });

    const context = analyzeSupabaseContext(state);

    expect(context.needsSetup).toBe(false);
    expect(context.hasExistingTables).toBe(true);
    expect(context.isNewProject).toBe(false);

    const instructions = getSupabaseWorkflowInstructions(context, 'detailed');
    expect(instructions).toContain('SUPABASE FULLY CONFIGURED - OPERATIONAL MODE');
    expect(instructions).toContain('operation="migration"');
    expect(instructions).toContain('operation="query"');
  });
});
