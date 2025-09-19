import { openDatabase, getWorkflowByProjectId, upsertWorkflow } from '~/lib/persistence/db';
import type { Workflow, WorkflowColumn } from '~/lib/persistence/db';

const DEFAULT_COLUMNS: WorkflowColumn[] = [
  { id: 'pending', status: 'pending', title: 'Pending', order: 0 },
  { id: 'in-progress', status: 'in-progress', title: 'In Progress', order: 1 },
  { id: 'blocked', status: 'blocked', title: 'Blocked', order: 2 },
  { id: 'completed', status: 'completed', title: 'Completed', order: 3 },
  { id: 'cancelled', status: 'cancelled', title: 'Cancelled', order: 4 },
];

export async function getOrCreateWorkflow(projectId: string): Promise<Workflow> {
  const db = await openDatabase();

  if (!db) {
    return {
      id: projectId,
      projectId,
      columns: DEFAULT_COLUMNS,
      updatedAt: new Date().toISOString(),
    };
  }

  const existing = await getWorkflowByProjectId(db, projectId);

  if (existing) {
    return existing;
  }

  const wf: Workflow = {
    id: projectId,
    projectId,
    columns: DEFAULT_COLUMNS,
    updatedAt: new Date().toISOString(),
  };
  await upsertWorkflow(db, wf);

  return wf;
}

export async function saveWorkflow(projectId: string, columns: WorkflowColumn[]): Promise<void> {
  const db = await openDatabase();

  if (!db) {
    return;
  }

  const wf: Workflow = {
    id: projectId,
    projectId,
    columns: columns
      .map((c, i) => ({ ...c, order: typeof c.order === 'number' ? c.order : i }))
      .sort((a, b) => a.order - b.order),
    updatedAt: new Date().toISOString(),
  };
  await upsertWorkflow(db, wf);
}
