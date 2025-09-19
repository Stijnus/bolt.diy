import { useState } from 'react';
import { Loader2, Plus, Trash2, ExternalLink, Eye, Folder } from 'lucide-react';
import { Button } from '~/components/ui/Button';
import { useSimpleProjects } from './useSimpleProjects';
import { ProjectDetails } from './ProjectDetails';
import type { NewProject, SimpleProject } from './simpleTypes';

export function SimpleProjectsList() {
  const { projects, loading, error, addProject, deleteProject, checkAllGitStatuses } = useSimpleProjects();
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedProject, setSelectedProject] = useState<SimpleProject | null>(null);
  const [formData, setFormData] = useState<NewProject>({
    name: '',
    gitUrl: '',
    description: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.gitUrl.trim()) {
      alert('Please fill in name and git URL');
      return;
    }

    await addProject(formData);
    setFormData({ name: '', gitUrl: '', description: '' });
    setShowAddForm(false);
  };

  const handleDelete = async (projectId: string, projectName: string) => {
    if (confirm(`Are you sure you want to delete "${projectName}"?`)) {
      await deleteProject(projectId);
    }
  };

  const handleProjectClick = (project: SimpleProject) => {
    setSelectedProject(project);
  };

  const handleBackToList = () => {
    setSelectedProject(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center gap-2 text-bolt-elements-textSecondary">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading projects...</span>
        </div>
      </div>
    );
  }

  // Show project details if a project is selected
  if (selectedProject) {
    return <ProjectDetails project={selectedProject} onBack={handleBackToList} />;
  }

  return (
    <div className="min-h-screen bg-bolt-elements-background-depth-1 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold text-bolt-elements-textPrimary mb-2">Projects</h1>
            <p className="text-bolt-elements-textSecondary">Manage your development projects</p>
          </div>
          <Button
            onClick={() => setShowAddForm(!showAddForm)}
            variant="primary"
            className="shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Project
          </Button>
        </div>

        {error && (
          <div className="bg-bolt-elements-status-error-background border border-bolt-elements-status-error-border rounded-lg p-4 mb-6 shadow-sm">
            <p className="text-bolt-elements-status-error-text font-medium">{error}</p>
          </div>
        )}

        {showAddForm && (
          <div className="bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-xl p-8 mb-8 shadow-lg hover:shadow-xl transition-shadow duration-300">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-bolt-elements-button-primary-background/15 rounded-xl flex items-center justify-center ring-1 ring-bolt-elements-button-primary-background/20">
                <Plus className="w-6 h-6 text-bolt-elements-button-primary-text" />
              </div>
              <h2 className="text-2xl font-semibold text-bolt-elements-textPrimary">Add New Project</h2>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-bolt-elements-textSecondary">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor rounded-lg text-bolt-elements-textPrimary focus:border-bolt-elements-button-primary-text focus:ring-2 focus:ring-bolt-elements-button-primary-background/20 transition-all duration-200 hover:border-bolt-elements-borderColorActive"
                    placeholder="My Awesome Project"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-bolt-elements-textSecondary">Git URL *</label>
                  <input
                    type="url"
                    value={formData.gitUrl}
                    onChange={(e) => setFormData({ ...formData, gitUrl: e.target.value })}
                    className="w-full px-4 py-3 bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor rounded-lg text-bolt-elements-textPrimary focus:border-bolt-elements-button-primary-text focus:ring-2 focus:ring-bolt-elements-button-primary-background/20 transition-all duration-200 hover:border-bolt-elements-borderColorActive"
                    placeholder="https://github.com/user/repo"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-bolt-elements-textSecondary">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor rounded-lg text-bolt-elements-textPrimary focus:border-bolt-elements-button-primary-text focus:ring-2 focus:ring-bolt-elements-button-primary-background/20 transition-all duration-200 resize-none hover:border-bolt-elements-borderColorActive"
                  placeholder="Tell us about your project..."
                  rows={4}
                />
              </div>
              <div className="flex gap-3 pt-6 border-t border-bolt-elements-borderColor/50">
                <Button
                  type="submit"
                  variant="primary"
                  className="shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 font-semibold"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Project
                </Button>
                <Button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  variant="outline"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}

        {projects.length === 0 ? (
          <div className="text-center py-20">
            <div className="max-w-md mx-auto">
              <div className="w-24 h-24 bg-bolt-elements-button-primary-background/15 rounded-2xl flex items-center justify-center mx-auto mb-6 ring-1 ring-bolt-elements-button-primary-background/20 shadow-lg">
                <Folder className="w-12 h-12 text-bolt-elements-button-primary-text" />
              </div>
              <h3 className="text-2xl font-semibold text-bolt-elements-textPrimary mb-3">No projects yet</h3>
              <p className="text-bolt-elements-textSecondary mb-8 leading-relaxed">
                Get started by creating your first project. Connect your Git repositories and start managing your
                development workflow.
              </p>
              <Button
                onClick={() => setShowAddForm(true)}
                variant="primary"
                className="shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Project
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <div
                key={project.id}
                className="group bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-xl p-6 hover:bg-bolt-elements-background-depth-3 hover:border-bolt-elements-button-primary-background/40 hover:shadow-xl hover:shadow-bolt-elements-button-primary-background/15 transition-all duration-300 cursor-pointer transform hover:-translate-y-2 hover:scale-[1.02] ring-1 ring-bolt-elements-borderColor/50 hover:ring-bolt-elements-button-primary-background/30"
                onClick={() => handleProjectClick(project)}
              >
                <div className="flex flex-col h-full">
                  {/* Project Header */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="text-xl font-semibold text-bolt-elements-textPrimary group-hover:text-bolt-elements-button-primary-text transition-colors duration-200">
                        {project.name}
                      </h3>
                      <div className="flex gap-2 flex-shrink-0">
                        {project.gitInfo && (
                          <span
                            className={`text-xs px-2.5 py-1 rounded-full font-medium shadow-sm ${
                              project.gitInfo.status === 'accessible'
                                ? 'text-bolt-elements-status-success-text bg-bolt-elements-status-success-background border border-bolt-elements-status-success-border'
                                : project.gitInfo.status === 'inaccessible'
                                  ? 'text-bolt-elements-status-error-text bg-bolt-elements-status-error-background border border-bolt-elements-status-error-border'
                                  : project.gitInfo.status === 'checking'
                                    ? 'text-bolt-elements-status-warning-text bg-bolt-elements-status-warning-background border border-bolt-elements-status-warning-border animate-pulse'
                                    : 'text-bolt-elements-status-neutral-text bg-bolt-elements-status-neutral-background border border-bolt-elements-status-neutral-border'
                            }`}
                          >
                            {project.gitInfo.status === 'accessible' && '✓ Connected'}
                            {project.gitInfo.status === 'inaccessible' && '✗ Offline'}
                            {project.gitInfo.status === 'checking' && '⟳ Checking'}
                            {project.gitInfo.status === 'unknown' && '? Unknown'}
                          </span>
                        )}
                        {project.lastUpdated && (
                          <span className="text-xs text-bolt-elements-textTertiary bg-bolt-elements-background-depth-3 px-2.5 py-1 rounded-full font-medium shadow-sm">
                            Updated
                          </span>
                        )}
                      </div>
                    </div>

                    {project.description ? (
                      <p className="text-bolt-elements-textSecondary mb-4 line-clamp-2 leading-relaxed">
                        {project.description}
                      </p>
                    ) : (
                      <p className="text-bolt-elements-textTertiary mb-4 italic">No description provided</p>
                    )}

                    {/* Tasks Summary */}
                    {project.tasks && project.tasks.length > 0 && (
                      <div className="flex items-center gap-4 text-xs text-bolt-elements-textSecondary mb-4 p-3 bg-bolt-elements-background-depth-1 rounded-lg border border-bolt-elements-borderColor/30">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 bg-bolt-elements-status-neutral-text rounded-full shadow-sm"></span>
                          <span className="font-medium">{project.tasks.filter(t => t.status === 'todo').length} Todo</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 bg-bolt-elements-status-warning-text rounded-full shadow-sm"></span>
                          <span className="font-medium">{project.tasks.filter(t => t.status === 'in-progress').length} In Progress</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 bg-bolt-elements-status-success-text rounded-full shadow-sm"></span>
                          <span className="font-medium">{project.tasks.filter(t => t.status === 'done').length} Done</span>
                        </div>
                      </div>
                    )}

                    {/* Git URL */}
                    <div className="flex items-center gap-2 text-sm text-bolt-elements-textTertiary mb-4 p-2 bg-bolt-elements-background-depth-1 rounded-md border border-bolt-elements-borderColor/20">
                      <ExternalLink className="w-4 h-4 flex-shrink-0 text-bolt-elements-textSecondary" />
                      <a
                        href={project.gitUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-bolt-elements-textSecondary hover:underline truncate transition-colors duration-150 font-mono text-xs"
                        onClick={(e) => e.stopPropagation()}
                        title={project.gitUrl}
                      >
                        {project.gitUrl}
                      </a>
                    </div>
                  </div>

                  {/* Project Footer */}
                  <div className="pt-4 border-t border-bolt-elements-borderColor/50">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-bolt-elements-textTertiary space-y-1">
                        <div className="font-medium">Created: {new Date(project.createdAt).toLocaleDateString()}</div>
                        {project.lastUpdated && (
                          <div>Updated: {new Date(project.lastUpdated).toLocaleDateString()}</div>
                        )}
                      </div>

                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleProjectClick(project);
                          }}
                          variant="primary"
                          size="sm"
                          className="shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(project.id, project.name);
                          }}
                          variant="destructive"
                          size="sm"
                          className="shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
