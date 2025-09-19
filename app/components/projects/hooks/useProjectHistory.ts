import { useState, useEffect, useCallback } from 'react';
import type { Project } from '~/components/projects/types';
import type { ChatHistoryItem } from '~/lib/persistence/useChatHistory';
import { getProjectChats } from '~/lib/persistence/db';
import { openDatabase } from '~/lib/persistence/db';
import { useProjects } from './useProjects';
import { useFeatures } from './useFeatures';
import { useGitOperations } from './useGitOperations';
import { useTimeTracking } from './useTimeTracking';

/**
 * Composite hook that provides all project history functionality
 * This replaces the original monolithic useProjectHistory hook
 */
export function useProjectHistory(selectedProjectId?: string) {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // Use the focused hooks
  const projectHooks = useProjects();
  const featureHooks = useFeatures();
  const gitHooks = useGitOperations();
  const timeTrackingHooks = useTimeTracking();

  const getProjectAssociatedChats = useCallback(async (projectId: string): Promise<ChatHistoryItem[]> => {
    const db = await openDatabase();

    if (db) {
      try {
        return await getProjectChats(db, projectId);
      } catch (error) {
        console.error('Error getting project chats:', error);
        return [];
      }
    }

    return [];
  }, []);

  // Load selected project details
  useEffect(() => {
    if (selectedProjectId) {
      const project = projectHooks.projects.find((p) => p.id === selectedProjectId);
      setSelectedProject(project || null);
    } else {
      setSelectedProject(null);
    }
  }, [selectedProjectId, projectHooks.projects]);

  return {
    // Project management
    projects: projectHooks.projects,
    loading: projectHooks.loading,
    selectedProject,
    addNewProject: projectHooks.addNewProject,
    editProject: projectHooks.editProject,
    deleteProject: projectHooks.deleteProject,
    refreshProject: projectHooks.refreshProject,
    loadProjects: projectHooks.loadProjects,

    // Feature management
    addFeature: featureHooks.addFeature,
    updateFeatureStatus: featureHooks.updateFeatureStatus,
    updateFeatureAnalytics: featureHooks.updateFeatureAnalytics,
    startWorkingOnFeature: featureHooks.startWorkingOnFeature,

    // Git operations
    createGitBranch: gitHooks.createGitBranch,
    switchToBranch: gitHooks.switchToBranch,

    // Time tracking
    startFeatureTimer: timeTrackingHooks.startFeatureTimer,
    stopFeatureTimer: timeTrackingHooks.stopFeatureTimer,

    // Other utilities
    getProjectAssociatedChats,
  };
}
