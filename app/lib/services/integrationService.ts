import {
  openDatabase,
  upsertIntegration,
  listIntegrationsByScope,
  deleteIntegration,
  type IntegrationConfigRow,
  type IntegrationProvider,
} from '~/lib/persistence/db';
/* eslint-disable padding-line-between-statements, @blitz/newline-before-return, curly */

export type { IntegrationConfigRow, IntegrationProvider };

export async function saveIntegration(row: Omit<IntegrationConfigRow, 'createdAt' | 'updatedAt'>) {
  const db = await openDatabase();
  if (!db) throw new Error('Database not available');
  const now = new Date().toISOString();
  await upsertIntegration(db, { ...row, createdAt: now, updatedAt: now });
}

export async function listProjectIntegrations(projectId: string) {
  const db = await openDatabase();
  if (!db) return [];
  return listIntegrationsByScope(db, 'project', projectId);
}

export async function removeIntegration(id: string) {
  const db = await openDatabase();
  if (!db) return;
  await deleteIntegration(db, id);
}

// Stubs for provider sync; network restricted so we just noop/update placeholders.
export async function syncPRsForProject(_projectId: string): Promise<void> {
  /*
   * In a real implementation we would read PRs for the project from the db and
   * then call provider APIs to refresh states. Here we keep it as a no-op
   * placeholder that can be expanded later.
   */
  return;
}

// Slack/Discord webhook stubs
export async function sendWebhook(url: string, payload: any): Promise<boolean> {
  try {
    // Network is restricted, so we simulate success.
    console.log('Webhook queued (simulation):', { url, payload });
    return true;
  } catch {
    return false;
  }
}
