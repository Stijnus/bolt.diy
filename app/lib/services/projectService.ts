import type { Project, Branch } from '~/components/projects/types';
import {
  addProject,
  updateProject,
  getProjectById,
  getAllProjects,
  updateProjectBranches,
  deleteProjectById,
  openDatabase,
} from '~/lib/persistence/db';

export async function createProject(project: Project): Promise<void> {
  const db = await openDatabase();

  if (!db) {
    throw new Error('Database not available');
  }

  return addProject(db, project);
}

export async function saveProject(project: Project, id: string): Promise<void> {
  const db = await openDatabase();

  if (!db) {
    throw new Error('Database not available');
  }

  return updateProject(db, project, id);
}

export async function findProject(id: string): Promise<Project | undefined> {
  const db = await openDatabase();

  if (!db) {
    return undefined;
  }

  return getProjectById(db, id);
}

export async function listProjects(): Promise<Project[]> {
  const db = await openDatabase();

  if (!db) {
    return [];
  }

  return getAllProjects(db);
}

export async function setProjectBranches(projectId: string, branches: Branch[]): Promise<void> {
  const db = await openDatabase();

  if (!db) {
    throw new Error('Database not available');
  }

  return updateProjectBranches(db, projectId, branches);
}

export async function removeProject(id: string): Promise<void> {
  const db = await openDatabase();

  if (!db) {
    throw new Error('Database not available');
  }

  return deleteProjectById(db, id);
}
