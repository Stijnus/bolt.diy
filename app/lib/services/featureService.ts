import type { Feature } from '~/components/projects/types';
import {
  addOrUpdateFeature as addOrUpdateFeatureDb,
  getFeatureById as getFeatureByIdDb,
  getFeaturesByProject as getFeaturesByProjectDb,
  deleteFeatureById as deleteFeatureByIdDb,
  openDatabase,
} from '~/lib/persistence/db';

export async function upsertFeature(projectId: string, feature: Feature): Promise<void> {
  const db = await openDatabase();

  if (!db) {
    throw new Error('Database not available');
  }

  return addOrUpdateFeatureDb(db, projectId, feature);
}

export async function getFeature(id: string): Promise<(Feature & { projectId: string }) | undefined> {
  const db = await openDatabase();

  if (!db) {
    return undefined;
  }

  return getFeatureByIdDb(db, id);
}

export async function listFeaturesByProject(projectId: string): Promise<Array<Feature & { projectId: string }>> {
  const db = await openDatabase();

  if (!db) {
    return [];
  }

  return getFeaturesByProjectDb(db, projectId);
}

export async function removeFeature(projectId: string, id: string): Promise<void> {
  const db = await openDatabase();

  if (!db) {
    throw new Error('Database not available');
  }

  return deleteFeatureByIdDb(db, projectId, id);
}
