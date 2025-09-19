export interface Activity {
  id: string;
  scopeType: 'org' | 'team' | 'project' | 'feature';
  scopeId: string;
  userId: string;
  action: string;
  details?: Record<string, any>;
  timestamp: string;
}

import { openDatabase } from '~/lib/persistence/db';

export async function logActivity(activity: Activity): Promise<void> {
  const db = await openDatabase();

  if (!db) {
    return;
  }

  const tx = db.transaction('activities', 'readwrite');
  tx.objectStore('activities').put(activity);

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error as any);
  });
}

export async function listActivitiesByScope(scopeType: Activity['scopeType'], scopeId: string): Promise<Activity[]> {
  const db = await openDatabase();

  if (!db) {
    return [];
  }

  const tx = db.transaction('activities', 'readonly');
  const store = tx.objectStore('activities');
  const idx = store.index('scopeId');

  return new Promise((resolve) => {
    const req = idx.getAll(scopeId);

    req.onsuccess = () => {
      const rows = (req.result as Activity[]).filter((r) => r.scopeType === scopeType);
      resolve(rows);
    };
    req.onerror = () => resolve([]);
  });
}
