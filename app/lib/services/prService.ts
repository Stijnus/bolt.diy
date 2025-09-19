import { openDatabase } from '~/lib/persistence/db';

export type PRState = 'open' | 'merged' | 'closed' | 'draft';
export interface PRRow {
  id: string;
  projectId: string;
  featureId: string;
  provider: 'github' | 'gitlab' | 'other';
  url: string;
  title: string;
  state: PRState;
  branch: string;
  baseBranch: string;
  reviewers?: string[];
  createdAt: string;
  updatedAt: string;
}

export async function createPR(
  row: Omit<PRRow, 'id' | 'createdAt' | 'updatedAt' | 'state'> & { id?: string; state?: PRState },
) {
  const db = await openDatabase();

  if (!db) {
    throw new Error('Database not available');
  }

  const now = new Date().toISOString();
  const record: PRRow = {
    id: row.id || `${Date.now()}`,
    projectId: row.projectId,
    featureId: row.featureId,
    provider: row.provider,
    url: row.url,
    title: row.title,
    state: row.state || 'open',
    branch: row.branch,
    baseBranch: row.baseBranch,
    reviewers: row.reviewers || [],
    createdAt: now,
    updatedAt: now,
  };
  const tx = db.transaction('prs', 'readwrite');
  tx.objectStore('prs').put(record);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  return record;
}

export async function listPRsByFeature(featureId: string): Promise<PRRow[]> {
  const db = await openDatabase();

  if (!db) {
    return [];
  }

  const tx = db.transaction('prs', 'readonly');
  const idx = tx.objectStore('prs').index('featureId');
  const rows: PRRow[] = await new Promise((resolve, reject) => {
    const req = idx.getAll(featureId);
    req.onsuccess = () => resolve((req.result as PRRow[]) || []);
    req.onerror = () => reject(req.error);
  });
  rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return rows;
}

export async function updatePR(id: string, updates: Partial<PRRow>): Promise<void> {
  const db = await openDatabase();

  if (!db) {
    return;
  }

  const tx = db.transaction('prs', 'readwrite');
  const store = tx.objectStore('prs');
  const current: PRRow | undefined = await new Promise((resolve) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result as PRRow | undefined);
    req.onerror = () => resolve(undefined);
  });

  if (!current) {
    return;
  }

  const next: PRRow = { ...current, ...updates, updatedAt: new Date().toISOString() };
  store.put(next);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function removePR(id: string): Promise<void> {
  const db = await openDatabase();

  if (!db) {
    return;
  }

  const tx = db.transaction('prs', 'readwrite');
  tx.objectStore('prs').delete(id);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
