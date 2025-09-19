import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import type { Project } from '~/components/projects/types';
import { projectService } from '~/lib/services/projectService';
import { logActivity } from '~/lib/services/activityService';

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);

      const enrichedProjects = await projectService.loadProjectsWithFeatures();
      setProjects(enrichedProjects);
    } catch (error) {
      console.error('Error loading projects:', error);
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, []);

  const addNewProject = useCallback(
    async (project: Project) => {
      try {
        await projectService.createProject(project);
        await loadProjects();
        toast.success(`Project "${project.name}" added successfully`);
      } catch (error) {
        console.error('Error adding project:', error);
        toast.error('Failed to add project');
        throw error;
      }
    },
    [loadProjects],
  );

  const editProject = useCallback(
    async (id: string, updates: Partial<Project>) => {
      try {
        const currentProject = await projectService.findProject(id);

        if (!currentProject) {
          throw new Error('Project not found');
        }

        const updatedProject = { ...currentProject, ...updates };
        await projectService.saveProject(updatedProject, id);
        await loadProjects();
        toast.success('Project updated successfully');
      } catch (error) {
        console.error('Error updating project:', error);
        toast.error('Failed to update project');
        throw error;
      }
    },
    [loadProjects],
  );

  const deleteProject = useCallback(
    async (id: string) => {
      try {
        await projectService.removeProject(id);
        await loadProjects();
        toast.success('Project deleted successfully');

        try {
          await logActivity({
            id: `${Date.now()}-project_deleted-${id}`,
            scopeType: 'project',
            scopeId: id,
            userId: 'local-user',
            action: 'project_deleted',
            details: {},
            timestamp: new Date().toISOString(),
          });
        } catch {
          // ignore logging errors
        }
      } catch (error) {
        console.error('Error deleting project:', error);
        toast.error('Failed to delete project');
        throw error;
      }
    },
    [loadProjects],
  );

  const refreshProject = useCallback(
    async (gitUrl: string) => {
      try {
        setLoading(true);
        await projectService.refreshProject(gitUrl);
        await loadProjects();
      } catch (error) {
        console.error('Error refreshing project:', error);
        toast.error('Failed to refresh project');
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [loadProjects],
  );

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  return {
    projects,
    loading,
    addNewProject,
    editProject,
    deleteProject,
    refreshProject,
    loadProjects,
  };
}
