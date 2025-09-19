import { useState } from 'react';
import {
  ArrowLeft,
  ExternalLink,
  Calendar,
  Edit2,
  Save,
  X,
  GitBranch,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { Button } from '~/components/ui/Button';
import { useSimpleProjects } from './useSimpleProjects';
import { SimpleGitService } from './gitService';
import { TaskList } from './TaskList';
import type { SimpleProject, UpdateProject } from './simpleTypes';

interface ProjectDetailsProps {
  project: SimpleProject;
  onBack: () => void;
}

export function ProjectDetails({ project, onBack }: ProjectDetailsProps) {
  const { updateProject, checkGitStatus, error, projects, addTask, updateTask, deleteTask } = useSimpleProjects();

  // Get the current project from the projects list to ensure we have the latest data
  const currentProject = projects.find((p) => p.id === project.id) || project;
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<UpdateProject>({
    name: currentProject.name,
    gitUrl: currentProject.gitUrl,
    description: currentProject.description || '',
  });
  const [saving, setSaving] = useState(false);

  const handleEdit = () => {
    setIsEditing(true);

    // Reset edit data to current project values
    setEditData({
      name: currentProject.name,
      gitUrl: currentProject.gitUrl,
      description: currentProject.description || '',
    });
  };

  const handleCancel = () => {
    setIsEditing(false);

    // Reset edit data
    setEditData({
      name: currentProject.name,
      gitUrl: currentProject.gitUrl,
      description: currentProject.description || '',
    });
  };

  const handleSave = async () => {
    if (!editData.name?.trim() || !editData.gitUrl?.trim()) {
      alert('Name and Git URL are required');
      return;
    }

    setSaving(true);

    try {
      await updateProject(currentProject.id, editData);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save project:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCheckGitStatus = async () => {
    if (currentProject.gitUrl) {
      await checkGitStatus(currentProject.id, currentProject.gitUrl);
    }
  };

  const getGitStatusIcon = () => {
    if (!currentProject.gitInfo) {
      return <Clock className="w-4 h-4 text-bolt-elements-status-neutral-text" />;
    }

    switch (currentProject.gitInfo.status) {
      case 'accessible':
        return <CheckCircle className="w-4 h-4 text-bolt-elements-status-success-text" />;
      case 'inaccessible':
        return <AlertCircle className="w-4 h-4 text-bolt-elements-status-error-text" />;
      case 'checking':
        return <RefreshCw className="w-4 h-4 text-bolt-elements-status-warning-text animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-bolt-elements-status-neutral-text" />;
    }
  };

  return (
    <div className="min-h-screen bg-bolt-elements-background-depth-1 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header with back button */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              onClick={onBack}
              variant="secondary"
              size="sm"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Projects
            </Button>
            <h1 className="text-3xl font-bold text-bolt-elements-textPrimary">
              {isEditing ? 'Edit Project' : currentProject.name}
            </h1>
          </div>
          {!isEditing && (
            <Button
              onClick={handleEdit}
              variant="primary"
            >
              <Edit2 className="w-4 h-4 mr-2" />
              Edit Project
            </Button>
          )}
        </div>

        {/* Error display */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Project Details Card */}
        <div className="bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-xl p-8 shadow-lg hover:shadow-xl transition-shadow duration-300">
          <div className="space-y-8">
            {/* Project Name */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-bolt-elements-textSecondary">Project Name *</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.name || ''}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor rounded-lg text-bolt-elements-textPrimary focus:border-bolt-elements-button-primary-text focus:ring-2 focus:ring-bolt-elements-button-primary-background/20 transition-all duration-200 font-semibold text-lg"
                  placeholder="Project name"
                  required
                />
              ) : (
                <p className="text-2xl font-bold text-bolt-elements-textPrimary">{currentProject.name}</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-bolt-elements-textSecondary">Description</label>
              {isEditing ? (
                <textarea
                  value={editData.description || ''}
                  onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                  className="w-full px-4 py-3 bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor rounded-lg text-bolt-elements-textPrimary focus:border-bolt-elements-button-primary-text focus:ring-2 focus:ring-bolt-elements-button-primary-background/20 transition-all duration-200 resize-none"
                  placeholder="Optional description"
                  rows={4}
                />
              ) : (
                <div className="p-4 bg-bolt-elements-background-depth-1 rounded-lg border border-bolt-elements-borderColor/30">
                  <p className="text-bolt-elements-textPrimary leading-relaxed">
                    {currentProject.description || (
                      <span className="text-bolt-elements-textTertiary italic">No description provided</span>
                    )}
                  </p>
                </div>
              )}
            </div>

            {/* Git URL */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-bolt-elements-textSecondary">
                Repository URL *
              </label>
              {isEditing ? (
                <input
                  type="url"
                  value={editData.gitUrl || ''}
                  onChange={(e) => setEditData({ ...editData, gitUrl: e.target.value })}
                  className="w-full px-4 py-3 bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor rounded-lg text-bolt-elements-textPrimary focus:border-bolt-elements-button-primary-text focus:ring-2 focus:ring-bolt-elements-button-primary-background/20 transition-all duration-200 font-mono"
                  placeholder="https://github.com/user/repo"
                  required
                />
              ) : (
                <div className="flex items-center gap-3 p-4 bg-bolt-elements-background-depth-1 rounded-lg border border-bolt-elements-borderColor/30">
                  <ExternalLink className="w-5 h-5 text-bolt-elements-textSecondary flex-shrink-0" />
                  <a
                    href={currentProject.gitUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-bolt-elements-textPrimary hover:text-bolt-elements-button-primary-text hover:underline font-mono text-sm transition-colors duration-200 break-all"
                  >
                    {currentProject.gitUrl}
                  </a>
                </div>
              )}
            </div>

            {/* Created Date */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-bolt-elements-textSecondary">Created</label>
              <div className="flex items-center gap-3 p-4 bg-bolt-elements-background-depth-1 rounded-lg border border-bolt-elements-borderColor/30">
                <Calendar className="w-5 h-5 text-bolt-elements-textSecondary" />
                <span className="text-bolt-elements-textPrimary font-medium">
                  {new Date(currentProject.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>

            {/* Last Updated */}
            {currentProject.lastUpdated && (
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-bolt-elements-textSecondary">Last Updated</label>
                <div className="flex items-center gap-3 p-4 bg-bolt-elements-background-depth-1 rounded-lg border border-bolt-elements-borderColor/30">
                  <Calendar className="w-5 h-5 text-bolt-elements-textSecondary" />
                  <span className="text-bolt-elements-textPrimary font-medium">
                    {new Date(currentProject.lastUpdated!).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            )}

            {/* Git Information */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-semibold text-bolt-elements-textSecondary">Repository Status</label>
                <Button
                  onClick={handleCheckGitStatus}
                  disabled={currentProject.gitInfo?.status === 'checking'}
                  variant="secondary"
                  size="sm"
                  className="text-xs"
                >
                  <RefreshCw
                    className={`w-3 h-3 mr-1 ${currentProject.gitInfo?.status === 'checking' ? 'animate-spin' : ''}`}
                  />
                  Check Status
                </Button>
              </div>

              <div className="bg-bolt-elements-background-depth-1 rounded-lg p-6 border border-bolt-elements-borderColor/30 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  {getGitStatusIcon()}
                  <span className="text-bolt-elements-textPrimary font-medium text-lg">
                    {currentProject.gitInfo
                      ? SimpleGitService.getStatusMessage(currentProject.gitInfo)
                      : 'Status unknown'}
                  </span>
                </div>

                {currentProject.gitInfo?.defaultBranch && (
                  <div className="flex items-center gap-3 mb-4 p-3 bg-bolt-elements-background-depth-2 rounded-lg">
                    <GitBranch className="w-5 h-5 text-bolt-elements-textSecondary" />
                    <span className="text-bolt-elements-textSecondary font-medium">
                      Default branch:{' '}
                      <code className="text-bolt-elements-textPrimary bg-bolt-elements-background-depth-3 px-2 py-1 rounded font-mono text-sm">
                        {currentProject.gitInfo.defaultBranch}
                      </code>
                    </span>
                  </div>
                )}

                {currentProject.gitInfo?.branches && currentProject.gitInfo.branches.length > 0 && (
                  <div className="p-3 bg-bolt-elements-background-depth-2 rounded-lg">
                    <span className="text-sm text-bolt-elements-textSecondary font-semibold block mb-3">
                      {currentProject.gitInfo.branches.length} branch{currentProject.gitInfo.branches.length !== 1 ? 'es' : ''}{' '}
                      available
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {currentProject.gitInfo.branches.slice(0, 5).map((branch) => (
                        <span
                          key={branch}
                          className="text-xs bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary px-3 py-1.5 rounded-full font-mono border border-bolt-elements-borderColor/30"
                        >
                          {branch}
                        </span>
                      ))}
                      {currentProject.gitInfo.branches.length > 5 && (
                        <span className="text-xs text-bolt-elements-textTertiary px-3 py-1.5 bg-bolt-elements-background-depth-3 rounded-full border border-bolt-elements-borderColor/30">
                          +{currentProject.gitInfo.branches.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {currentProject.gitInfo?.lastChecked && (
                  <div className="text-xs text-bolt-elements-textTertiary mt-4 p-2 bg-bolt-elements-background-depth-2 rounded font-mono">
                    Last checked: {new Date(currentProject.gitInfo.lastChecked).toLocaleString()}
                  </div>
                )}
              </div>
            </div>

            {/* Project ID (for debugging) */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-bolt-elements-textSecondary">Project ID</label>
              <code className="text-sm text-bolt-elements-textTertiary bg-bolt-elements-background-depth-3 px-4 py-3 rounded-lg font-mono border border-bolt-elements-borderColor/30 block">
                {currentProject.id}
              </code>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-8 pt-6 border-t border-bolt-elements-borderColor/50">
            {isEditing ? (
              <div className="flex gap-4">
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  variant="primary"
                  className="bg-bolt-elements-status-success-background hover:bg-bolt-elements-status-success-border text-bolt-elements-status-success-text shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                >
                  {saving ? (
                    <>
                      <span className="w-4 h-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleCancel}
                  disabled={saving}
                  variant="outline"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex gap-4">
                <Button
                  onClick={() => window.open(currentProject.gitUrl, '_blank')}
                  variant="secondary"
                  className="shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open Repository
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Tasks Section */}
        <div className="mt-8">
          <TaskList
            projectId={currentProject.id}
            tasks={currentProject.tasks || []}
            onAddTask={(newTask) => addTask(currentProject.id, newTask)}
            onUpdateTask={(taskId, updates) => updateTask(currentProject.id, taskId, updates)}
            onDeleteTask={(taskId) => deleteTask(currentProject.id, taskId)}
          />
        </div>
      </div>
    </div>
  );
}
