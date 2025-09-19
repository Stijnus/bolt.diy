import type { Feature, NewFeature, Project, Branch } from '~/components/projects/types';
import {
  addOrUpdateFeature as addOrUpdateFeatureDb,
  getFeatureById as getFeatureByIdDb,
  getFeaturesByProject as getFeaturesByProjectDb,
  deleteFeatureById as deleteFeatureByIdDb,
  getProjectById,
  getProjectByGitUrl,
  updateProjectBranches,
  openDatabase,
} from '~/lib/persistence/db';
import { toast } from 'react-toastify';
import { gitService, GitRepositoryNotFoundError } from './gitService';
import { timeTrackingService } from './timeTrackingService';
import { projectService } from './projectService';
import { logActivity } from './activityService';

export interface FeatureService {
  upsertFeature(projectId: string, feature: Feature): Promise<void>;
  getFeature(id: string): Promise<(Feature & { projectId: string }) | undefined>;
  listFeaturesByProject(projectId: string): Promise<Array<Feature & { projectId: string }>>;
  removeFeature(projectId: string, id: string): Promise<void>;
  addFeature(projectId: string, newFeature: NewFeature): Promise<void>;
  updateFeatureStatus(projectId: string, featureId: string, status: Feature['status']): Promise<void>;
  updateFeatureAnalytics(projectId: string, featureId: string, analytics: Partial<Feature['analytics']>): Promise<void>;
  startFeatureTimer(projectId: string, featureId: string): Promise<void>;
  stopFeatureTimer(projectId: string, featureId: string): Promise<void>;
  startWorkingOnFeature(projectId: string, featureId: string): Promise<void>;
}

export const featureService: FeatureService = {
  async upsertFeature(projectId: string, feature: Feature): Promise<void> {
    const db = await openDatabase();

    if (!db) {
      throw new Error('Database not available');
    }

    return addOrUpdateFeatureDb(db, projectId, feature);
  },

  async getFeature(id: string): Promise<(Feature & { projectId: string }) | undefined> {
    const db = await openDatabase();

    if (!db) {
      return undefined;
    }

    return getFeatureByIdDb(db, id);
  },

  async listFeaturesByProject(projectId: string): Promise<Array<Feature & { projectId: string }>> {
    const db = await openDatabase();

    if (!db) {
      return [];
    }

    return getFeaturesByProjectDb(db, projectId);
  },

  async removeFeature(projectId: string, id: string): Promise<void> {
    const db = await openDatabase();

    if (!db) {
      throw new Error('Database not available');
    }

    return deleteFeatureByIdDb(db, projectId, id);
  },

  async addFeature(projectId: string, newFeature: NewFeature): Promise<void> {
    // Input validation
    if (!projectId || typeof projectId !== 'string') {
      throw new Error('Invalid project ID provided');
    }

    if (!newFeature || typeof newFeature !== 'object') {
      throw new Error('Invalid feature data provided');
    }

    if (!newFeature.name || typeof newFeature.name !== 'string' || newFeature.name.trim().length === 0) {
      throw new Error('Feature name is required');
    }

    if (!newFeature.branchRef || typeof newFeature.branchRef !== 'string' || newFeature.branchRef.trim().length === 0) {
      throw new Error('Branch reference is required');
    }

    if (
      !newFeature.branchFrom ||
      typeof newFeature.branchFrom !== 'string' ||
      newFeature.branchFrom.trim().length === 0
    ) {
      throw new Error('Source branch is required');
    }

    const db = await openDatabase();

    if (!db) {
      throw new Error('Database is not available. Please check your connection.');
    }

    try {
      const now = new Date().toISOString();
      let project: Project | undefined;

      try {
        project = await getProjectById(db, projectId);
      } catch (dbError) {
        console.error('Database error while fetching project by id:', dbError);
      }

      if (!project) {
        try {
          project = await getProjectByGitUrl(db, projectId);
        } catch (lookupError) {
          console.error('Database error while fetching project by git URL:', lookupError);
        }
      }

      if (!project) {
        throw new Error('Project not found. It may have been deleted.');
      }

      if (!project.gitUrl) {
        throw new Error('Project does not have a valid Git URL configured.');
      }

      const isWebcontainerProject = projectService.isWebContainerProject(project);
      let createdBranch: Branch | undefined;
      let skippedBranchCreation = false;

      if (!isWebcontainerProject) {
        try {
          createdBranch = await gitService.createBranch(project.gitUrl, newFeature.branchRef, newFeature.branchFrom);
        } catch (error) {
          const isMissingRepoError =
            error instanceof GitRepositoryNotFoundError ||
            (typeof error === 'object' &&
              error !== null &&
              'name' in error &&
              (error as { name?: unknown }).name === 'GitRepositoryNotFoundError');

          if (isMissingRepoError) {
            console.warn('Git repository not found for project, proceeding without creating a branch.');
            toast.warn(
              'No Git repository was detected for this project. The feature was added without creating a branch.',
            );
            skippedBranchCreation = true;
          } else {
            console.error('Failed to create git branch:', error);
            throw error;
          }
        }
      }

      const feature: Feature = {
        id: `${Date.now()}`,
        name: newFeature.name,
        branchRef: createdBranch?.name ?? newFeature.branchRef,
        description: newFeature.description || '',
        branchFrom: newFeature.branchFrom,
        status: 'pending',
        head: newFeature.srcOid || '',

        // Initialize time tracking
        timeTracking: {
          createdAt: now,
          estimatedHours: newFeature.estimatedHours,
          lastUpdated: now,
        },

        // Initialize analytics data
        analytics: {
          priority: newFeature.priority || 'medium',
          complexity: newFeature.complexity || 'medium',
          tags: newFeature.tags || [],
          assignee: newFeature.assignee,
          dependencies: newFeature.dependencies || [],
        },
      };

      await addOrUpdateFeatureDb(db, project.id ?? projectId, feature);

      if (createdBranch) {
        try {
          const existingBranches = Array.isArray(project.branches) ? project.branches : [];
          const mergedBranches = [
            ...existingBranches.filter((branch) => branch.name !== createdBranch.name),
            createdBranch,
          ].sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime());

          await updateProjectBranches(db, project.id ?? projectId, mergedBranches);
        } catch (branchUpdateError) {
          console.warn('Failed to persist branch metadata:', branchUpdateError);
        }
      }

      if (createdBranch) {
        const branchNameForMessage = createdBranch.name;
        toast.success(`Feature "${feature.name}" added successfully with branch '${branchNameForMessage}'`);
      } else if (skippedBranchCreation) {
        toast.success(`Feature "${feature.name}" added successfully without creating a Git branch.`);
      } else {
        const branchNameForMessage = newFeature.branchRef;
        toast.success(`Feature "${feature.name}" added successfully with branch '${branchNameForMessage}'`);
      }
    } catch (error) {
      console.error('Error adding feature:', error);

      let errorMessage = 'Failed to add feature';

      if (error instanceof Error) {
        if (error.message.includes('branch')) {
          errorMessage = `Failed to create git branch: ${error.message}`;
        } else if (error.message.includes('Database') || error.message.includes('database')) {
          errorMessage = 'Database error while adding feature. Please try again.';
        } else {
          errorMessage = `Failed to add feature: ${error.message}`;
        }
      }

      toast.error(errorMessage);
      throw error;
    }
  },

  async updateFeatureStatus(projectId: string, featureId: string, status: Feature['status']): Promise<void> {
    const db = await openDatabase();

    if (!db) {
      throw new Error('Database not available');
    }

    try {
      const project = await getProjectById(db, projectId);
      let feature: Feature | undefined;

      try {
        const feat = await getFeatureByIdDb(db, featureId);
        feature = (feat as unknown as Feature) || undefined;
      } catch {
        feature = project.features.find((f) => f.id === featureId);
      }

      if (feature) {
        const now = new Date().toISOString();
        const isWebcontainerProject = projectService.isWebContainerProject(project);
        const updatedTimeTracking = timeTrackingService.updateTimeTracking(feature.timeTracking, status);

        // Handle branch switching when status changes
        if (status === 'in-progress' && feature.status !== 'in-progress') {
          // Starting work - switch to feature branch
          if (!isWebcontainerProject) {
            try {
              await gitService.switchBranch(project.gitUrl, feature.branchRef);
              toast.success(`Switched to branch '${feature.branchRef}' and started working on '${feature.name}'`);
            } catch (error) {
              console.error('Failed to switch to feature branch:', error);
              toast.error(
                `Failed to switch to branch '${feature.branchRef}'. Status updated but you may need to switch manually.`,
              );
            }
          }
        } else if (status === 'completed' && feature.status === 'in-progress') {
          // Completing work
          toast.success(
            `Feature '${feature.name}' completed! Consider merging branch '${feature.branchRef}' back to '${feature.branchFrom}'.`,
          );
        }

        const updatedFeature = {
          ...feature,
          status,
          timeTracking: updatedTimeTracking,
        };

        await addOrUpdateFeatureDb(db, projectId, updatedFeature);

        if (status !== 'in-progress' && status !== 'completed') {
          toast.success(`Feature status updated to ${status}`);
        }

        // Log activity (best-effort)
        try {
          await logActivity({
            id: `${Date.now()}-feature_status-${featureId}`,
            scopeType: 'feature',
            scopeId: featureId,
            userId: 'local-user',
            action: 'feature_status_changed',
            details: { projectId, status },
            timestamp: now,
          });
        } catch {
          // ignore logging errors
        }
      }
    } catch (error) {
      console.error('Error updating feature status:', error);
      toast.error('Failed to update feature status');
      throw error;
    }
  },

  async updateFeatureAnalytics(
    projectId: string,
    featureId: string,
    analytics: Partial<Feature['analytics']>,
  ): Promise<void> {
    const db = await openDatabase();

    if (!db) {
      throw new Error('Database not available');
    }

    try {
      const project = await getProjectById(db, projectId);
      let feature: Feature | undefined;

      try {
        const feat = await getFeatureByIdDb(db, featureId);
        feature = (feat as unknown as Feature) || undefined;
      } catch {
        feature = project.features.find((f) => f.id === featureId);
      }

      if (feature) {
        const updatedFeature = {
          ...feature,
          analytics: {
            ...feature.analytics,
            ...analytics,
          },
          timeTracking: {
            ...feature.timeTracking,
            lastUpdated: new Date().toISOString(),
          },
        };

        await addOrUpdateFeatureDb(db, projectId, updatedFeature);
        toast.success('Feature analytics updated');

        try {
          await logActivity({
            id: `${Date.now()}-feature_updated-${featureId}`,
            scopeType: 'feature',
            scopeId: featureId,
            userId: 'local-user',
            action: 'feature_updated',
            details: { projectId, analytics },
            timestamp: new Date().toISOString(),
          });
        } catch {
          // ignore logging errors
        }
      }
    } catch (error) {
      console.error('Error updating feature analytics:', error);
      toast.error('Failed to update feature analytics');
      throw error;
    }
  },

  async startFeatureTimer(projectId: string, featureId: string): Promise<void> {
    const db = await openDatabase();

    if (!db) {
      throw new Error('Database not available');
    }

    try {
      const project = await getProjectById(db, projectId);
      let feature: Feature | undefined;

      try {
        const feat = await getFeatureByIdDb(db, featureId);
        feature = (feat as unknown as Feature) || undefined;
      } catch {
        feature = project.features.find((f) => f.id === featureId);
      }

      if (feature) {
        const isWebcontainerProject = projectService.isWebContainerProject(project);

        // Switch to feature branch when starting timer
        if (!isWebcontainerProject) {
          try {
            await gitService.switchBranch(project.gitUrl, feature.branchRef);
          } catch (error) {
            console.error('Failed to switch to feature branch:', error);
            toast.warning(
              `Timer started but failed to switch to branch '${feature.branchRef}'. You may need to switch manually.`,
            );
          }
        }

        const now = new Date().toISOString();
        const updatedFeature = {
          ...feature,
          status: 'in-progress' as const,
          timeTracking: timeTrackingService.startTimer(feature),
        };

        await addOrUpdateFeatureDb(db, projectId, updatedFeature);
        toast.success(`Timer started for ${feature.name} on branch '${feature.branchRef}'`);

        try {
          await logActivity({
            id: `${Date.now()}-feature_timer_started-${featureId}`,
            scopeType: 'feature',
            scopeId: featureId,
            userId: 'local-user',
            action: 'feature_timer_started',
            details: { projectId },
            timestamp: now,
          });
        } catch {
          // ignore logging errors
        }
      }
    } catch (error) {
      console.error('Error starting timer:', error);
      toast.error('Failed to start timer');
      throw error;
    }
  },

  async stopFeatureTimer(projectId: string, featureId: string): Promise<void> {
    const db = await openDatabase();

    if (!db) {
      throw new Error('Database not available');
    }

    try {
      const project = await getProjectById(db, projectId);
      let feature: Feature | undefined;

      try {
        const feat = await getFeatureByIdDb(db, featureId);
        feature = (feat as unknown as Feature) || undefined;
      } catch {
        feature = project.features.find((f) => f.id === featureId);
      }

      if (feature && feature.timeTracking?.startedAt) {
        const now = new Date().toISOString();
        const sessionHours = timeTrackingService.calculateSessionHours(feature.timeTracking.startedAt, now);

        const updatedFeature = {
          ...feature,
          status: 'pending' as const,
          timeTracking: timeTrackingService.stopTimer(feature),
        };

        await addOrUpdateFeatureDb(db, projectId, updatedFeature);
        toast.success(`Timer stopped for ${feature.name} (${sessionHours.toFixed(1)}h)`);

        try {
          await logActivity({
            id: `${Date.now()}-feature_timer_stopped-${featureId}`,
            scopeType: 'feature',
            scopeId: featureId,
            userId: 'local-user',
            action: 'feature_timer_stopped',
            details: { projectId, sessionHours },
            timestamp: now,
          });
        } catch {
          // ignore logging errors
        }
      }
    } catch (error) {
      console.error('Error stopping timer:', error);
      toast.error('Failed to stop timer');
      throw error;
    }
  },

  async startWorkingOnFeature(projectId: string, featureId: string): Promise<void> {
    const db = await openDatabase();

    if (!db) {
      toast.error('Database not available');
      return;
    }

    try {
      const project = await getProjectById(db, projectId);
      const feature = project.features.find((f) => f.id === featureId);

      if (!feature) {
        toast.error('Feature not found');
        return;
      }

      toast.info(`Setting up development environment for "${feature.name}"...`, { autoClose: 2000 });

      const isWebcontainerProject = projectService.isWebContainerProject(project);

      if (!isWebcontainerProject) {
        // Step 1: Ensure project is cloned and up to date
        try {
          await projectService.refreshProject(project.gitUrl);
        } catch (error) {
          console.error('Failed to refresh project:', error);
          toast.error('Failed to refresh project. Continuing with existing state...');
        }

        // Step 2: Switch to feature branch and load files
        try {
          await gitService.switchBranch(project.gitUrl, feature.branchRef);
        } catch (error) {
          console.error('Failed to switch to feature branch:', error);
          toast.error(`Failed to switch to branch '${feature.branchRef}'. You may need to switch manually.`);

          // Continue anyway - user can switch manually
        }
      }

      // Step 3: Update feature status to 'in-progress' and start timer
      const now = new Date().toISOString();
      const updatedFeature = {
        ...feature,
        status: 'in-progress' as const,
        timeTracking: {
          ...feature.timeTracking,
          startedAt: now,
          lastUpdated: now,
        },
      };

      await addOrUpdateFeatureDb(db, projectId, updatedFeature);

      toast.success(`🚀 Ready to work on "${feature.name}"! Branch: ${feature.branchRef}`, { autoClose: 4000 });
    } catch (error) {
      console.error('Error starting work on feature:', error);
      toast.error('Failed to start working on feature');
      throw error;
    }
  },
};

// Legacy function exports for backward compatibility
export async function upsertFeature(projectId: string, feature: Feature): Promise<void> {
  return featureService.upsertFeature(projectId, feature);
}

export async function getFeature(id: string): Promise<(Feature & { projectId: string }) | undefined> {
  return featureService.getFeature(id);
}

export async function listFeaturesByProject(projectId: string): Promise<Array<Feature & { projectId: string }>> {
  return featureService.listFeaturesByProject(projectId);
}

export async function removeFeature(projectId: string, id: string): Promise<void> {
  return featureService.removeFeature(projectId, id);
}
