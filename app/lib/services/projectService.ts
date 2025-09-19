import type { Project, Branch } from '~/components/projects/types';
import {
  addProject,
  updateProject,
  getProjectById,
  getAllProjects,
  updateProjectBranches,
  deleteProjectById,
  openDatabase,
  getFeaturesByProject,
} from '~/lib/persistence/db';
import FS from '@isomorphic-git/lightning-fs';
import http from 'isomorphic-git/http/web';
import git from 'isomorphic-git';
import { toast } from 'react-toastify';

const gitHttpOptions = { http, corsProxy: '/api/git-proxy' } as const;

export interface ProjectService {
  createProject(project: Project): Promise<void>;
  saveProject(project: Project, id: string): Promise<void>;
  findProject(id: string): Promise<Project | undefined>;
  listProjects(): Promise<Project[]>;
  setProjectBranches(projectId: string, branches: Branch[]): Promise<void>;
  removeProject(id: string): Promise<void>;
  refreshProject(gitUrl: string): Promise<void>;
  isWebContainerProject(project: Project): boolean;
  loadProjectsWithFeatures(): Promise<Project[]>;
}

// Utility functions
const getGitAuthOptions = (_gitUrl: string) => {
  /*
   * This should be imported from gitService, but to avoid circular dependency,
   * we'll keep it simple here or refactor later
   */
  const headers: Record<string, string> = { 'User-Agent': 'bolt.diy' };
  return { headers };
};

export const projectService: ProjectService = {
  async createProject(project: Project): Promise<void> {
    const db = await openDatabase();

    if (!db) {
      throw new Error('Database not available');
    }

    return addProject(db, project);
  },

  async saveProject(project: Project, id: string): Promise<void> {
    const db = await openDatabase();

    if (!db) {
      throw new Error('Database not available');
    }

    return updateProject(db, project, id);
  },

  async findProject(id: string): Promise<Project | undefined> {
    const db = await openDatabase();

    if (!db) {
      return undefined;
    }

    return getProjectById(db, id);
  },

  async listProjects(): Promise<Project[]> {
    const db = await openDatabase();

    if (!db) {
      return [];
    }

    return getAllProjects(db);
  },

  async setProjectBranches(projectId: string, branches: Branch[]): Promise<void> {
    const db = await openDatabase();

    if (!db) {
      throw new Error('Database not available');
    }

    return updateProjectBranches(db, projectId, branches);
  },

  async removeProject(id: string): Promise<void> {
    const db = await openDatabase();

    if (!db) {
      throw new Error('Database not available');
    }

    return deleteProjectById(db, id);
  },

  async loadProjectsWithFeatures(): Promise<Project[]> {
    const db = await openDatabase();

    if (!db) {
      return [];
    }

    try {
      const allProjects = await getAllProjects(db);

      const enriched = await Promise.all(
        (allProjects || []).map(async (p) => {
          try {
            const feats = await getFeaturesByProject(db, p.id);
            return { ...p, features: (feats as any) ?? p.features };
          } catch {
            return p;
          }
        }),
      );

      return enriched;
    } catch (error) {
      console.error('Error loading projects:', error);
      throw new Error('Failed to load projects');
    }
  },

  isWebContainerProject(project: Project): boolean {
    // Check for explicit WebContainer indicators
    if (project.source === 'webcontainer' || project.source === 'template') {
      console.log(`Project "${project.name}" detected as WebContainer: source = ${project.source}`);
      return true;
    }

    // Check for WebContainer URL patterns
    if (project.gitUrl) {
      if (
        project.gitUrl.startsWith('webcontainer://') ||
        project.gitUrl.startsWith('file://') ||
        project.gitUrl.includes('/home/project/') ||
        project.gitUrl.startsWith('/home/project/')
      ) {
        console.log(`Project "${project.name}" detected as WebContainer: gitUrl = ${project.gitUrl}`);
        return true;
      }

      // If it's not a valid remote Git URL, it's likely a WebContainer project
      if (!project.gitUrl.match(/^https?:\/\/|^git@|^ssh:\/\//)) {
        console.log(`Project "${project.name}" detected as WebContainer: invalid remote URL = ${project.gitUrl}`);
        return true;
      }

      console.log(`Project "${project.name}" detected as Git project: gitUrl = ${project.gitUrl}`);
    } else {
      // No Git URL means it's likely a WebContainer project
      console.log(`Project "${project.name}" detected as WebContainer: no gitUrl`);
      return true;
    }

    return false;
  },

  async refreshProject(gitUrl: string): Promise<void> {
    if (!gitUrl) {
      return;
    }

    try {
      // Initialize filesystem
      const fs = new FS('ProjectFS');
      const projectName = gitUrl.split('/').pop()?.replace('.git', '') || 'unknown';
      const dir = `/${projectName}`;
      const authOptions = getGitAuthOptions(gitUrl);

      try {
        // Try to check if directory exists and has .git folder
        await fs.promises.stat(`${dir}/.git`);
        console.log('Repository already cloned, pulling latest changes...');

        // Pull latest changes
        await git.pull({
          fs,
          dir,
          author: {
            name: 'bolt.diy',
            email: 'user@bolt.diy',
          },
          ...gitHttpOptions,
          ...authOptions,
        });
      } catch {
        console.log('Cloning repository...');

        // Clone the repository
        await git.clone({
          fs,
          dir,
          url: gitUrl,
          depth: 1,
          ...gitHttpOptions,
          ...authOptions,
        });
      }

      // Get branches
      const branches: Branch[] = [];

      try {
        const remoteBranches = await git.listBranches({
          fs,
          dir,
          remote: 'origin',
        });

        const seenBranches = new Set<string>();

        for (const branch of remoteBranches) {
          if (!branch || branch.toUpperCase() === 'HEAD' || seenBranches.has(branch)) {
            continue;
          }

          try {
            const commits = await git.log({
              fs,
              dir,
              ref: `origin/${branch}`,
              depth: 1,
            });

            if (commits.length > 0) {
              const commit = commits[0];
              seenBranches.add(branch);
              branches.push({
                name: branch,
                author: commit.commit.author.name,
                updated: new Date(commit.commit.author.timestamp * 1000).toISOString(),
                commitHash: commit.oid,
              });
            }
          } catch (error) {
            console.warn(`Failed to get info for branch ${branch}:`, error);
          }
        }
      } catch (error) {
        console.error('Error getting branches:', error);
      }

      const db = await openDatabase();

      if (db) {
        await updateProjectBranches(db, gitUrl, branches);
      }

      toast.success('Project refreshed successfully');
    } catch (error) {
      console.error('Error refreshing project:', error);
      toast.error('Failed to refresh project');
      throw error;
    }
  },
};

// Legacy function exports for backward compatibility
export async function createProject(project: Project): Promise<void> {
  return projectService.createProject(project);
}

export async function saveProject(project: Project, id: string): Promise<void> {
  return projectService.saveProject(project, id);
}

export async function findProject(id: string): Promise<Project | undefined> {
  return projectService.findProject(id);
}

export async function listProjects(): Promise<Project[]> {
  return projectService.listProjects();
}

export async function setProjectBranches(projectId: string, branches: Branch[]): Promise<void> {
  return projectService.setProjectBranches(projectId, branches);
}

export async function removeProject(id: string): Promise<void> {
  return projectService.removeProject(id);
}
