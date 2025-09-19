import { useCallback, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Plus, Folder, Zap, CheckCircle, Save, ArrowLeft } from 'lucide-react';
import { Button } from '~/components/ui/Button';
import { EmptyProjectsList } from './EmptyStates';
import { ProjectCard } from './ProjectCard';
import { ProjectView } from './ProjectView';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { AddProjectDialog } from './AddProjectDialog';
import { useProjectHistory } from '~/lib/persistence/useProjectHistory';
import { workbenchStore } from '~/lib/stores/workbench';
import { useStore } from '@nanostores/react';
import type { Project } from './types';

export const ProjectDashboard = () => {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [analyticsLoading] = useState(false);
  const {
    addNewProject,
    projects,
    refreshProject,
    deleteProject,
    addFeature,
    updateFeatureStatus,
    startFeatureTimer,
    stopFeatureTimer,
    startWorkingOnFeature,
    loading,
    getProjectAssociatedChats,
  } = useProjectHistory(selectedProjectId ?? undefined);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [savingSession, setSavingSession] = useState(false);
  const files = useStore(workbenchStore.files);
  const showWorkbench = useStore(workbenchStore.showWorkbench);

  const hasActiveSession = showWorkbench && Object.keys(files).length > 0;
  const selectedProject = useMemo(() => {
    if (!selectedProjectId) {
      return null;
    }

    return projects.find((project) => project.id === selectedProjectId) ?? null;
  }, [projects, selectedProjectId]);

  const handleProjectAdd = useCallback(
    async (name: string, gitUrl: string, options?: { source?: Project['source']; project?: Project }) => {
      const now = new Date().toISOString();

      const defaultAnalytics: Project['analytics'] = {
        totalCommits: 0,
        totalHoursTracked: 0,
        averageFeatureCompletionTime: 0,
        completionRate: 0,
        activeDevelopers: [],
        lastActivityDate: now,
        velocityTrend: [],
      };

      const defaultSettings: Project['settings'] = {
        defaultPriority: 'medium',
        autoTimeTracking: true,
        notifications: {
          deadlineAlerts: true,
          statusUpdates: true,
          weeklyReports: false,
        },
      };

      const providedProject = options?.project;

      const project: Project = {
        id: providedProject?.id ?? providedProject?.gitUrl ?? gitUrl,
        name: providedProject?.name ?? name,
        gitUrl: providedProject?.gitUrl ?? gitUrl,
        features: providedProject?.features ?? [],
        branches: providedProject?.branches ?? [],
        createdAt: providedProject?.createdAt ?? now,
        ownerId: providedProject?.ownerId ?? 'local-user',
        collaborators: providedProject?.collaborators ?? [],
        analytics: providedProject?.analytics ?? defaultAnalytics,
        settings: providedProject?.settings ?? defaultSettings,
        description: providedProject?.description,
        lastUpdated: providedProject?.lastUpdated,
        source:
          providedProject?.source ?? options?.source ?? (gitUrl.startsWith('webcontainer://') ? 'webcontainer' : 'git'),
        snapshotId: providedProject?.snapshotId,
      };

      await addNewProject(project);

      if (project.source !== 'webcontainer') {
        await refreshProject(project.gitUrl);
      }
    },
    [addNewProject, refreshProject],
  );

  const handleProjectSelect = useCallback((project: Project) => {
    setSelectedProjectId(project.id);
  }, []);

  const handleGlobalBack = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.assign('/');
    }
  }, []);

  const handleBack = useCallback(() => {
    setSelectedProjectId(null);
  }, []);

  const handleRefresh = useCallback(
    async (gitUrl: string) => {
      if (gitUrl.startsWith('webcontainer://')) {
        return;
      }

      await refreshProject(gitUrl);
    },
    [refreshProject],
  );

  const handleDeleteProject = useCallback(
    async (id: string) => {
      if (window.confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
        await deleteProject(id);

        if (selectedProjectId === id) {
          setSelectedProjectId(null);
        }
      }
    },
    [deleteProject, selectedProjectId],
  );

  const handleSaveCurrentSession = useCallback(async () => {
    if (!hasActiveSession) {
      return;
    }

    setSavingSession(true);

    try {
      const project = await workbenchStore.createProjectFromWebContainer();
      await handleProjectAdd(project.name, project.gitUrl, { source: 'webcontainer', project });
    } catch (error) {
      console.error('Failed to save current session:', error);
    } finally {
      setSavingSession(false);
    }
  }, [hasActiveSession, handleProjectAdd]);

  if (loading && projects.length === 0) {
    return (
      <div className="min-h-screen w-full bg-bolt-elements-background-depth-1 flex items-center justify-center">
        <div className="flex items-center gap-3 text-bolt-elements-textSecondary">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading projects...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-bolt-elements-background-depth-1">
      <AnimatePresence mode="wait">
        {!selectedProject ? (
          <motion.div
            key="projects"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full md:px-8"
            style={{ padding: 'var(--bolt-elements-spacing-4xl) var(--bolt-elements-spacing-lg)' }}
          >
            {/* Header Container - Full width with centered content */}
            <div className="w-full mx-auto">
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="icon" onClick={handleGlobalBack} title="Go back" aria-label="Go back">
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                  <h1 className="text-3xl font-bold text-bolt-elements-textPrimary">Projects</h1>
                </div>
                <div className="flex gap-2">
                  {hasActiveSession && (
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Button
                        onClick={handleSaveCurrentSession}
                        disabled={savingSession}
                        variant="outline"
                        className="hover:text-bolt-elements-item-contentAccent hover:border-bolt-elements-item-backgroundAccent hover:bg-bolt-elements-item-backgroundAccent transition-colors"
                      >
                        {savingSession ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4 mr-2" />
                        )}
                        Save Session
                      </Button>
                    </motion.div>
                  )}
                  {projects?.length > 0 && (
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Button
                        onClick={() => setDialogOpen(true)}
                        variant="outline"
                        className="hover:text-bolt-elements-item-contentAccent hover:border-bolt-elements-item-backgroundAccent hover:bg-bolt-elements-item-backgroundAccent transition-colors"
                      >
                        <Plus className="w-5 h-5 mr-2" />
                        Add Project
                      </Button>
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Advanced Analytics Overview */}
              <div className="mb-8">
                <AnalyticsDashboard projects={projects} loading={loading || analyticsLoading} />
              </div>

              {projects?.length === 0 ? (
                <EmptyProjectsList onAddProject={() => setDialogOpen(true)} />
              ) : (
                <>
                  {/* Stats Overview */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div
                      className="border rounded-xl transition-all duration-300"
                      style={{
                        background: 'var(--bolt-elements-card-blue-background)',
                        borderColor: 'var(--bolt-elements-card-blue-border)',
                        padding: 'var(--bolt-elements-component-padding-lg)',
                        boxShadow: 'var(--bolt-elements-shadow-sm)',
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-bolt-elements-textSecondary">Total Projects</span>
                        <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                          <Folder className="w-5 h-5 text-blue-500" />
                        </div>
                      </div>
                      <p className="text-3xl font-bold text-bolt-elements-textPrimary mt-3">{projects.length}</p>
                    </div>

                    <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl p-6 shadow-sm hover:shadow-lg hover:shadow-purple-500/20 transition-all duration-300">
                      <div className="flex items-center justify-between">
                        <span className="text-bolt-elements-textSecondary">Total Features</span>
                        <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                          <Zap className="w-5 h-5 text-purple-500" />
                        </div>
                      </div>
                      <p className="text-3xl font-bold text-bolt-elements-textPrimary mt-3">
                        {projects.reduce((acc, project) => acc + (project.features?.length || 0), 0)}
                      </p>
                    </div>

                    <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl p-6 shadow-sm hover:shadow-lg hover:shadow-green-500/20 transition-all duration-300">
                      <div className="flex items-center justify-between">
                        <span className="text-bolt-elements-textSecondary">Completed</span>
                        <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        </div>
                      </div>
                      <p className="text-3xl font-bold text-bolt-elements-textPrimary mt-3">
                        {projects.reduce(
                          (acc, project) =>
                            acc + (project.features?.filter((f) => f.status === 'completed').length || 0),
                          0,
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Projects Grid */}
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {projects.map((project) => (
                      <ProjectCard
                        key={project.id}
                        project={project}
                        onClick={handleProjectSelect}
                        onRefresh={handleRefresh}
                        onDelete={handleDeleteProject}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="project-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full px-4 py-8 md:px-8"
          >
            <ProjectView
              project={selectedProject}
              onBack={handleBack}
              onRefresh={handleRefresh}
              onAddFeature={addFeature}
              onUpdateFeatureStatus={updateFeatureStatus}
              onStartFeatureTimer={startFeatureTimer}
              onStopFeatureTimer={stopFeatureTimer}
              onStartWorking={startWorkingOnFeature}
              getProjectChats={getProjectAssociatedChats}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AddProjectDialog isOpen={dialogOpen} onClose={() => setDialogOpen(false)} onAdd={handleProjectAdd} />
    </div>
  );
};
