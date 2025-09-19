import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from '@remix-run/react';
import { useStore } from '@nanostores/react';
import { RotateCcw, GitBranch, Zap, BarChart3, Plus, ArrowLeft } from 'lucide-react';
import { isAuthenticated, currentUser } from '~/lib/stores/auth';
import { TeamService } from '~/lib/services/teamService';
import { hasPermission, type TeamMember } from '~/components/projects/types';
import { Button } from '~/components/ui/Button';
import { Tabs, TabsList, TabsTrigger } from '~/components/ui/Tabs';
import { Breadcrumb } from '~/components/projects/components/ui/Breadcrumb';
import { FeatureCard } from '~/components/projects/components/cards/FeatureCard';
import { NewFeatureDialog } from '~/components/projects/components/dialogs/NewFeatureDialog';
import { ProjectChats } from './ProjectChats';
import { CommentsDialog } from '~/components/projects/components/dialogs/CommentsDialog';
import { ActivityFeed } from '~/components/projects/components/panels/ActivityFeed';
import { ReportsPanel } from '~/components/projects/components/dashboard/ReportsPanel';
import { IntegrationsPanel } from '~/components/projects/components/panels/IntegrationsPanel';
import { KanbanBoard } from './KanbanBoard';
import { AddPRDialog } from '~/components/projects/components/dialogs/AddPRDialog';
import { toast } from 'react-toastify';
import type { Project, Feature, NewFeature } from '~/components/projects/types';
import type { ChatHistoryItem } from '~/lib/persistence/useChatHistory';

interface ProjectViewProps {
  project: Project;
  onBack: () => void;
  onRefresh: (gitUrl: string) => void;
  onAddFeature: (projectId: string, feature: NewFeature) => Promise<void>;
  onUpdateFeatureStatus: (projectId: string, featureId: string, status: Feature['status']) => void;
  onStartFeatureTimer?: (projectId: string, featureId: string) => void;
  onStopFeatureTimer?: (projectId: string, featureId: string) => void;
  onStartWorking?: (
    projectId: string,
    featureId: string,
    onSetupComplete?: () => void | Promise<void>,
  ) => Promise<void>;
  getProjectChats: (projectId: string) => Promise<ChatHistoryItem[]>;
}

export const ProjectView = ({
  project,
  onBack,
  onRefresh,
  onAddFeature,
  onUpdateFeatureStatus,
  onStartFeatureTimer,
  onStopFeatureTimer,
  onStartWorking,
  getProjectChats,
}: ProjectViewProps) => {
  const [showNewFeatureDialog, setShowNewFeatureDialog] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentsFeature, setCommentsFeature] = useState<Feature | null>(null);
  const [prOpen, setPrOpen] = useState(false);
  const [prFeature, setPrFeature] = useState<Feature | null>(null);
  const [chatLoadingFeature, setChatLoadingFeature] = useState<string | null>(null);
  const [startWorkingFeature, setStartWorkingFeature] = useState<string | null>(null);
  const [userTeamMember, setUserTeamMember] = useState<TeamMember | null>(null);
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const navigate = useNavigate();
  const authed = useStore(isAuthenticated);
  const user = useStore(currentUser);
  const isWebcontainer = project.source === 'webcontainer' || project.gitUrl.startsWith('webcontainer://');

  // Check user permissions for this project
  useEffect(() => {
    const checkPermissions = async () => {
      if (!user?.id || !project.teamId) {
        setPermissionsLoading(false);
        return;
      }

      try {
        const teamMember = await TeamService.getTeamMember(project.teamId, user.id);
        setUserTeamMember(teamMember);
      } catch (error) {
        console.error('Failed to check team permissions:', error);
        toast.warn('Unable to verify permissions. Some features may be limited.', {
          autoClose: 3000,
        });
        setUserTeamMember(null);
      } finally {
        setPermissionsLoading(false);
      }
    };

    checkPermissions();
  }, [user?.id, project.teamId]);

  // Helper function to check if user can start chats
  const canStartChats = () => {
    // Project owner can always start chats
    if (user?.id === project.ownerId) {
      return true;
    }

    // If no team, only owner can start chats
    if (!project.teamId) {
      return false;
    }

    // Check team permissions
    if (userTeamMember) {
      return hasPermission(userTeamMember, 'start_chats');
    }

    // Loading or no permission
    return false;
  };

  const handleRefresh = () => {
    if (isWebcontainer) {
      toast.info('Current session projects do not have a remote repository to refresh.');
      return;
    }

    onRefresh(project.gitUrl);
  };

  const handleAddFeature = async (feature: NewFeature) => {
    await onAddFeature(project.id, feature);
    setShowNewFeatureDialog(false);
  };

  const handleFeatureStatusChange = (featureId: string, status: Feature['status']) => {
    onUpdateFeatureStatus(project.id, featureId, status);
  };

  const handleStartTimer = (featureId: string) => {
    if (onStartFeatureTimer) {
      onStartFeatureTimer(project.id, featureId);
    }
  };

  const handleStopTimer = (featureId: string) => {
    if (onStopFeatureTimer) {
      onStopFeatureTimer(project.id, featureId);
    }
  };

  const handleStartWorking = async (featureId: string) => {
    if (!onStartWorking) {
      return;
    }

    // Check if user can start chats (for the combined workflow)
    const canChat = canStartChats();

    setStartWorkingFeature(featureId);

    try {
      // Start working with optional chat opening callback
      await onStartWorking(
        project.id,
        featureId,
        canChat
          ? async () => {
              // Open chat after successful environment setup
              try {
                await handleOpenChat(featureId);
              } catch (chatError) {
                console.error('Failed to open chat after environment setup:', chatError);

                // This error is already handled in the callback error handling in useProjectHistory
                throw chatError;
              }
            }
          : undefined,
      );
    } catch (error) {
      console.error('Error starting work:', error);

      // Provide more specific error messages
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      let userMessage = 'Failed to start working on feature';

      if (errorMessage.includes('git') || errorMessage.includes('clone') || errorMessage.includes('branch')) {
        userMessage = 'Failed to set up Git environment. Please check your repository access.';
      } else if (errorMessage.includes('permission') || errorMessage.includes('auth')) {
        userMessage = 'Permission denied. Please check your access rights.';
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        userMessage = 'Network error. Please check your connection and try again.';
      }

      toast.error(
        <div>
          <div>{userMessage}</div>
          <div className="text-xs mt-1 opacity-75">Error: {errorMessage}</div>
        </div>,
        { autoClose: 6000 },
      );
    } finally {
      setStartWorkingFeature(null);
    }
  };

  const handleOpenChat = async (featureId: string) => {
    // Check permissions first
    if (!canStartChats()) {
      const message =
        user?.id === project.ownerId
          ? 'Unable to verify chat permissions. Please try again.'
          : project.teamId
            ? 'You need "start_chats" permission to open feature chats in this team project.'
            : 'Only the project owner can start chats for this project.';

      toast.error(message, { autoClose: 5000 });
      throw new Error(`Chat permission denied: ${message}`);
    }

    // Set loading state for visual feedback
    setChatLoadingFeature(featureId);

    try {
      // Find the feature to get its details
      const feature = project.features?.find((f) => f.id === featureId);

      if (!feature) {
        toast.error('Feature not found');
        setChatLoadingFeature(null);

        return;
      }

      // Navigate to new chat and store the intent to associate with project
      const chatMetadata = {
        gitUrl: project.gitUrl,
        gitBranch: feature.branchRef,
        projectId: project.id,
        featureId: feature.id,
        featureName: feature.name,
        featureDescription: feature.description,
        featureStatus: feature.status,
        projectName: project.name,
        projectDescription: project.description,
      };

      // Store the metadata in sessionStorage to apply once chat is created
      sessionStorage.setItem('pendingChatMetadata', JSON.stringify(chatMetadata));

      // Navigate to appropriate chat route based on authentication
      const chatRoute = authed ? '/chat' : '/';
      navigate(chatRoute, { replace: false });

      toast.success(`Starting new chat for feature: ${feature.name}`);

      // Clear loading state after navigation
      setTimeout(() => setChatLoadingFeature(null), 1000);
    } catch (error) {
      console.error('Error creating feature chat:', error);

      // Provide more specific error messages
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      let userMessage = 'Failed to start feature chat';

      if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        userMessage = 'Network error. Please check your connection and try again.';
      } else if (errorMessage.includes('permission') || errorMessage.includes('auth')) {
        userMessage = 'Authentication error. Please refresh the page and try again.';
      } else if (errorMessage.includes('not found')) {
        userMessage = 'Feature or project not found. Please refresh the page.';
      }

      toast.error(
        <div>
          <div>{userMessage}</div>
          <div className="text-xs mt-1 opacity-75">Error: {errorMessage}</div>
        </div>,
        { autoClose: 6000 },
      );

      setChatLoadingFeature(null);
    }
  };

  const handleOpenComments = (featureId: string) => {
    const feature = project.features?.find((f) => f.id === featureId) || null;
    setCommentsFeature(feature);
    setCommentsOpen(true);
  };

  const handleOpenPR = (featureId: string) => {
    const feature = project.features?.find((f) => f.id === featureId) || null;
    setPrFeature(feature);
    setPrOpen(true);
  };

  const completedFeatures = project.features?.filter((f) => f.status === 'completed').length || 0;
  const totalFeatures = project.features?.length || 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="w-full"
    >
      <div
        className="flex items-center"
        style={{ gap: 'var(--bolt-elements-spacing-md)', marginBottom: 'var(--bolt-elements-spacing-lg)' }}
      >
        <Button variant="outline" size="icon" onClick={onBack} title="Back to projects" aria-label="Back to projects">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <Breadcrumb items={[{ label: 'Projects', onClick: onBack }, { label: project.name }]} />
      </div>

      {/* Project Header */}
      <div
        className="border rounded-xl transition-all duration-300"
        style={{
          background: 'var(--bolt-elements-card-blue-background)',
          borderColor: 'var(--bolt-elements-card-blue-border)',
          padding: 'var(--bolt-elements-component-padding-lg)',
          marginBottom: 'var(--bolt-elements-spacing-2xl)',
          boxShadow: 'var(--bolt-elements-shadow-sm)',
        }}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-bolt-elements-textPrimary">{project.name}</h1>
              {isWebcontainer && (
                <span className="inline-flex items-center rounded-full bg-blue-500/10 text-blue-500 text-xs font-medium px-2 py-0.5">
                  Current Session
                </span>
              )}
            </div>
            <p className="text-bolt-elements-textSecondary font-mono text-sm mb-3">
              {isWebcontainer ? 'Current Workspace Snapshot' : project.gitUrl}
            </p>
            {project.description && <p className="text-bolt-elements-textSecondary">{project.description}</p>}
          </div>

          <Button onClick={handleRefresh} variant="outline" disabled={isWebcontainer}>
            <RotateCcw className="w-4 h-4" style={{ marginRight: 'var(--bolt-elements-spacing-sm)' }} />
            Refresh
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            className="border rounded-lg transition-all duration-300"
            style={{
              background: 'var(--bolt-elements-card-green-background)',
              borderColor: 'var(--bolt-elements-card-green-border)',
              padding: 'var(--bolt-elements-spacing-lg)',
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-bolt-elements-textSecondary text-sm">Branches</span>
              <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                <GitBranch className="w-4 h-4 text-green-500" />
              </div>
            </div>
            <p className="text-2xl font-bold text-bolt-elements-textPrimary mt-2">{project.branches?.length || 0}</p>
          </div>

          <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-4 hover:shadow-lg hover:shadow-purple-500/10 transition-all duration-300">
            <div className="flex items-center justify-between">
              <span className="text-bolt-elements-textSecondary text-sm">Features</span>
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Zap className="w-4 h-4 text-purple-500" />
              </div>
            </div>
            <p className="text-2xl font-bold text-bolt-elements-textPrimary mt-2">{totalFeatures}</p>
          </div>

          <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300">
            <div className="flex items-center justify-between">
              <span className="text-bolt-elements-textSecondary text-sm">Progress</span>
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-blue-500" />
              </div>
            </div>
            <div className="mt-2">
              <p className="text-2xl font-bold text-bolt-elements-textPrimary">
                {totalFeatures > 0 ? Math.round((completedFeatures / totalFeatures) * 100) : 0}%
              </p>
              <div className="w-full h-2 bg-bolt-elements-background-depth-1 rounded-full mt-2">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${totalFeatures > 0 ? (completedFeatures / totalFeatures) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-bolt-elements-background-depth-1 rounded-xl shadow-sm border border-bolt-elements-borderColor">
        <div className="p-6 border-b border-bolt-elements-borderColor">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-bolt-elements-textPrimary">Features</h2>
            <div className="flex items-center gap-2">
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'list' | 'kanban')}>
                <TabsList>
                  <TabsTrigger value="list">List</TabsTrigger>
                  <TabsTrigger value="kanban">Kanban</TabsTrigger>
                </TabsList>
              </Tabs>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  onClick={() => setShowNewFeatureDialog(true)}
                  size="sm"
                  variant="outline"
                  className="hover:text-bolt-elements-item-contentAccent hover:border-bolt-elements-item-backgroundAccent hover:bg-bolt-elements-item-backgroundAccent transition-colors"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Feature
                </Button>
              </motion.div>
            </div>
          </div>
        </div>

        <div className="p-6">
          {viewMode === 'kanban' ? (
            <KanbanBoard
              project={project}
              onStatusChange={(featureId, status) => handleFeatureStatusChange(featureId, status)}
            />
          ) : project.features && project.features.length > 0 ? (
            <div className="grid gap-4">
              {project.features.map((feature) => (
                <FeatureCard
                  key={feature.id}
                  feature={feature}
                  onStatusChange={handleFeatureStatusChange}
                  onOpenChat={handleOpenChat}
                  onOpenComments={handleOpenComments}
                  onOpenPRDialog={handleOpenPR}
                  gitUrl={project.gitUrl}
                  onStartTimer={handleStartTimer}
                  onStopTimer={handleStopTimer}
                  onStartWorking={handleStartWorking}
                  chatLoading={chatLoadingFeature === feature.id}
                  canStartChat={canStartChats()}
                  permissionsLoading={permissionsLoading}
                  startWorkingLoading={startWorkingFeature === feature.id}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-bolt-elements-background-depth-2 flex items-center justify-center">
                <Zap className="w-8 h-8 text-bolt-elements-textTertiary" />
              </div>
              <h3 className="text-lg font-medium text-bolt-elements-textPrimary mb-2">No Features Yet</h3>
              <p className="text-bolt-elements-textSecondary mb-4">
                Start by adding your first feature to this project.
              </p>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  onClick={() => setShowNewFeatureDialog(true)}
                  variant="outline"
                  className="hover:text-bolt-elements-item-contentAccent hover:border-bolt-elements-item-backgroundAccent hover:bg-bolt-elements-item-backgroundAccent transition-colors"
                >
                  Add Your First Feature
                </Button>
              </motion.div>
            </div>
          )}
        </div>
      </div>

      {/* Branches Section */}
      {project.branches && project.branches.length > 0 && (
        <div className="bg-bolt-elements-background-depth-1 rounded-xl shadow-sm border border-bolt-elements-borderColor mt-6">
          <div className="p-6 border-b border-bolt-elements-borderColor">
            <h2 className="text-lg font-semibold text-bolt-elements-textPrimary">Branches</h2>
          </div>
          <div className="p-6">
            <div className="grid gap-3">
              {project.branches.map((branch, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-bolt-elements-background-depth-2 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <GitBranch className="w-4 h-4 text-bolt-elements-item-contentAccent" />
                    <span className="font-mono text-sm text-bolt-elements-textPrimary">{branch.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-bolt-elements-textSecondary">by {branch.author}</p>
                    <p className="text-xs text-bolt-elements-textTertiary">
                      {new Date(branch.updated).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Associated Chats Section */}
      <ProjectChats project={project} getProjectChats={getProjectChats} />

      {/* Activity Feed */}
      <ActivityFeed project={project} />

      {/* Reports */}
      <ReportsPanel project={project} />

      {/* Integrations */}
      <IntegrationsPanel project={project} />

      <NewFeatureDialog
        isOpen={showNewFeatureDialog}
        onClose={() => setShowNewFeatureDialog(false)}
        onAdd={handleAddFeature}
        branches={project.branches || []}
        project={project}
      />

      <CommentsDialog
        isOpen={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        project={project}
        feature={commentsFeature}
      />

      <AddPRDialog isOpen={prOpen} onClose={() => setPrOpen(false)} project={project} feature={prFeature} />
    </motion.div>
  );
};
