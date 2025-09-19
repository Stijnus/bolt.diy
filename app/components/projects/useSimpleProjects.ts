import { useState, useEffect, useCallback } from 'react';
import { openDatabase } from '~/lib/persistence/db';
import { SimpleGitService } from './gitService';
import type {
  SimpleProject,
  NewProject,
  UpdateProject,
  GitInfo,
  ProjectTask,
  NewTask,
  UpdateTask,
} from './simpleTypes';

export function useSimpleProjects() {
  const [projects, setProjects] = useState<SimpleProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load all projects
  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const db = await openDatabase();

      if (!db) {
        throw new Error('Database not available');
      }

      const transaction = db.transaction('projects', 'readonly');
      const store = transaction.objectStore('projects');
      const request = store.getAll();

      request.onsuccess = () => {
        const allProjects = request.result || [];

        // Convert complex projects to simple format
        const simpleProjects: SimpleProject[] = allProjects.map((project: any) => ({
          id: project.id,
          name: project.name,
          gitUrl: project.gitUrl,
          description: project.description,
          createdAt: project.createdAt || new Date().toISOString(),
          lastUpdated: project.lastUpdated,
          gitInfo: project.gitInfo,
          tasks: project.tasks || [],
        }));
        setProjects(simpleProjects);
        setLoading(false);
      };

      request.onerror = () => {
        console.error('Error loading projects:', request.error);
        setError('Failed to load projects');
        setLoading(false);
      };
    } catch (err) {
      console.error('Error loading projects:', err);
      setError('Failed to load projects');
      setLoading(false);
    }
  }, []);

  // Add a new project
  const addProject = useCallback(
    async (newProject: NewProject) => {
      try {
        setError(null);

        const db = await openDatabase();

        if (!db) {
          throw new Error('Database not available');
        }

        const project: SimpleProject = {
          id: `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: newProject.name,
          gitUrl: newProject.gitUrl,
          description: newProject.description,
          createdAt: new Date().toISOString(),
        };

        const transaction = db.transaction('projects', 'readwrite');
        const store = transaction.objectStore('projects');
        const request = store.add(project);

        request.onsuccess = () => {
          console.log('Project added successfully:', project);
          loadProjects(); // Reload the list
        };

        request.onerror = () => {
          console.error('Error adding project:', request.error);
          setError('Failed to add project');
        };
      } catch (err) {
        console.error('Error adding project:', err);
        setError('Failed to add project');
      }
    },
    [loadProjects],
  );

  // Delete a project
  const deleteProject = useCallback(
    async (projectId: string) => {
      try {
        setError(null);

        const db = await openDatabase();

        if (!db) {
          throw new Error('Database not available');
        }

        const transaction = db.transaction('projects', 'readwrite');
        const store = transaction.objectStore('projects');
        const request = store.delete(projectId);

        request.onsuccess = () => {
          console.log('Project deleted successfully:', projectId);
          loadProjects(); // Reload the list
        };

        request.onerror = () => {
          console.error('Error deleting project:', request.error);
          setError('Failed to delete project');
        };
      } catch (err) {
        console.error('Error deleting project:', err);
        setError('Failed to delete project');
      }
    },
    [loadProjects],
  );

  // Update a project
  const updateProject = useCallback(
    async (projectId: string, updates: UpdateProject) => {
      try {
        setError(null);

        const db = await openDatabase();

        if (!db) {
          throw new Error('Database not available');
        }

        // First, get the existing project
        const transaction = db.transaction('projects', 'readwrite');
        const store = transaction.objectStore('projects');
        const getRequest = store.get(projectId);

        getRequest.onsuccess = () => {
          const existingProject = getRequest.result;

          if (!existingProject) {
            setError('Project not found');
            return;
          }

          // Update the project with new values
          const updatedProject: SimpleProject = {
            ...existingProject,
            ...updates,
            lastUpdated: new Date().toISOString(),
          };

          // Save the updated project
          const putRequest = store.put(updatedProject);

          putRequest.onsuccess = () => {
            console.log('Project updated successfully:', updatedProject);
            loadProjects(); // Reload the list
          };

          putRequest.onerror = () => {
            console.error('Error updating project:', putRequest.error);
            setError('Failed to update project');
          };
        };

        getRequest.onerror = () => {
          console.error('Error finding project:', getRequest.error);
          setError('Failed to find project');
        };
      } catch (err) {
        console.error('Error updating project:', err);
        setError('Failed to update project');
      }
    },
    [loadProjects],
  );

  // Check git repository status
  const checkGitStatus = useCallback(
    async (projectId: string, gitUrl: string) => {
      try {
        setError(null);

        // Update local state to show checking status immediately
        setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, gitInfo: { status: 'checking' } } : p)));

        // Check the repository
        const gitInfo = await SimpleGitService.checkGitRepository(gitUrl);

        // Update local state with git info immediately
        setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, gitInfo } : p)));

        // Also update the database
        await updateProject(projectId, { gitInfo } as any);

        console.log('Git status checked for project:', projectId, gitInfo);
      } catch (err) {
        console.error('Error checking git status:', err);

        const errorGitInfo: GitInfo = {
          status: 'inaccessible',
          error: 'Failed to check repository status',
          lastChecked: new Date().toISOString(),
        };

        // Update local state with error info
        setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, gitInfo: errorGitInfo } : p)));

        // Also update the database
        await updateProject(projectId, { gitInfo: errorGitInfo } as any);
      }
    },
    [updateProject],
  );

  // Check git status for all projects
  const checkAllGitStatuses = useCallback(async () => {
    const projectsToCheck = projects.filter((p) => !p.gitInfo || p.gitInfo.status === 'unknown');

    for (const project of projectsToCheck) {
      await checkGitStatus(project.id, project.gitUrl);

      // Add small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }, [projects, checkGitStatus]);

  // Add a task to a project
  const addTask = useCallback(
    async (projectId: string, newTask: NewTask) => {
      try {
        setError(null);

        const task: ProjectTask = {
          id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          title: newTask.title,
          description: newTask.description,
          status: 'todo',
          priority: newTask.priority,
          createdAt: new Date().toISOString(),
          dueDate: newTask.dueDate,
        };

        // Update local state immediately
        setProjects((prev) =>
          prev.map((p) =>
            p.id === projectId
              ? {
                  ...p,
                  tasks: [...(p.tasks || []), task],
                  lastUpdated: new Date().toISOString(),
                }
              : p,
          ),
        );

        // Update database
        const project = projects.find((p) => p.id === projectId);

        if (project) {
          const updatedTasks = [...(project.tasks || []), task];
          await updateProject(projectId, { tasks: updatedTasks } as any);
        }
      } catch (err) {
        console.error('Error adding task:', err);
        setError('Failed to add task');
      }
    },
    [projects, updateProject],
  );

  // Update a task
  const updateTask = useCallback(
    async (projectId: string, taskId: string, updates: UpdateTask) => {
      try {
        setError(null);

        // Update local state immediately
        setProjects((prev) =>
          prev.map((p) =>
            p.id === projectId
              ? {
                  ...p,
                  tasks: (p.tasks || []).map((t) =>
                    t.id === taskId ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t,
                  ),
                  lastUpdated: new Date().toISOString(),
                }
              : p,
          ),
        );

        // Update database
        const project = projects.find((p) => p.id === projectId);

        if (project) {
          const updatedTasks = (project.tasks || []).map((t) =>
            t.id === taskId ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t,
          );
          await updateProject(projectId, { tasks: updatedTasks } as any);
        }
      } catch (err) {
        console.error('Error updating task:', err);
        setError('Failed to update task');
      }
    },
    [projects, updateProject],
  );

  // Delete a task
  const deleteTask = useCallback(
    async (projectId: string, taskId: string) => {
      try {
        setError(null);

        // Update local state immediately
        setProjects((prev) =>
          prev.map((p) =>
            p.id === projectId
              ? {
                  ...p,
                  tasks: (p.tasks || []).filter((t) => t.id !== taskId),
                  lastUpdated: new Date().toISOString(),
                }
              : p,
          ),
        );

        // Update database
        const project = projects.find((p) => p.id === projectId);

        if (project) {
          const updatedTasks = (project.tasks || []).filter((t) => t.id !== taskId);
          await updateProject(projectId, { tasks: updatedTasks } as any);
        }
      } catch (err) {
        console.error('Error deleting task:', err);
        setError('Failed to delete task');
      }
    },
    [projects, updateProject],
  );

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  return {
    projects,
    loading,
    error,
    addProject,
    updateProject,
    deleteProject,
    checkGitStatus,
    checkAllGitStatuses,
    reloadProjects: loadProjects,
    addTask,
    updateTask,
    deleteTask,
  };
}
