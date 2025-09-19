import { useState } from 'react';
import { X, Loader2, Code, GitBranch, Github, GitlabIcon } from 'lucide-react';
import { toast } from 'react-toastify';
import { Dialog, DialogRoot, DialogTitle, DialogDescription } from '~/components/ui/Dialog';
import { Button } from '~/components/ui/Button';
import { Input } from '~/components/ui/Input';
import { Label } from '~/components/ui/Label';
import { workbenchStore } from '~/lib/stores/workbench';
import type { Project } from './types';

type ProjectSource = 'github-url' | 'gitlab-url' | 'git-url' | 'webcontainer' | 'github-template' | 'gitlab-template';

interface AddProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (name: string, gitUrl: string, options?: { source?: Project['source']; project?: Project }) => void;
}

export const AddProjectDialog = ({ isOpen, onClose, onAdd }: AddProjectDialogProps) => {
  const [name, setName] = useState('');
  const [gitUrl, setGitUrl] = useState('');
  const [source, setSource] = useState<ProjectSource>('github-url');
  const [loading, setLoading] = useState(false);

  const normalizeHostedGitUrl = (input: string, host: 'github.com' | 'gitlab.com') => {
    const value = input.trim();

    if (!value) {
      return null;
    }

    if (value.startsWith('git@') || value.startsWith('ssh://git@')) {
      return value;
    }

    if (value.startsWith('http://') || value.startsWith('https://')) {
      if (!value.includes(host)) {
        return null;
      }

      return value.endsWith('.git') ? value : `${value}.git`;
    }

    const ownerRepo = value.replace(/^\/+|\/+$/g, '');
    const trimmedOwnerRepo = ownerRepo.startsWith(`${host}/`) ? ownerRepo.slice(host.length + 1) : ownerRepo;

    if (!trimmedOwnerRepo || !trimmedOwnerRepo.includes('/')) {
      return null;
    }

    return `https://${host}/${trimmedOwnerRepo}${trimmedOwnerRepo.endsWith('.git') ? '' : '.git'}`;
  };

  const handleSourceChange = (value: ProjectSource) => {
    setSource(value);

    if (value === 'webcontainer') {
      setGitUrl('');
      setName((prev) => prev || 'Current Workspace');
    }
  };

  const mapToProjectSource = (value: ProjectSource): Project['source'] => {
    if (value === 'webcontainer') {
      return 'webcontainer';
    }

    if (value === 'github-template' || value === 'gitlab-template') {
      return 'template';
    }

    return 'git';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (source === 'webcontainer') {
      if (!name.trim()) {
        toast.error('Please provide a project name');
        return;
      }

      setLoading(true);

      try {
        const project = await workbenchStore.createProjectFromWebContainer(name.trim());
        await onAdd(project.name, project.gitUrl, { source: 'webcontainer', project });
        setName('');
        setGitUrl('');
        onClose();
      } catch (error) {
        console.error('Error creating project from WebContainer:', error);
        toast.error('Failed to create project from current session');
      } finally {
        setLoading(false);
      }

      return;
    }

    if (
      (source === 'github-url' || source === 'gitlab-url' || source === 'git-url') &&
      (!name.trim() || !gitUrl.trim())
    ) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);

    try {
      if (source === 'github-template' || source === 'gitlab-template') {
        // Handle template imports
        const apiEndpoint =
          source === 'github-template'
            ? `/api/github-template?repo=${encodeURIComponent(gitUrl.trim())}`
            : `/api/gitlab-template?repo=${encodeURIComponent(gitUrl.trim())}`;

        const response = await fetch(apiEndpoint);

        if (!response.ok) {
          throw new Error(`Failed to fetch template: ${response.statusText}`);
        }

        const templateFiles = (await response.json()) as Array<{ path: string; content: string }>;

        // Create template project URL
        const templateUrl =
          source === 'github-template'
            ? `https://github.com/${gitUrl.trim()}.git`
            : `https://gitlab.com/${gitUrl.trim()}.git`;

        await onAdd(name.trim(), templateUrl, { source: mapToProjectSource(source) });

        // Load template files into workbench
        const fileMap: Record<string, any> = {};
        templateFiles.forEach((file) => {
          fileMap[file.path] = {
            type: 'file',
            content: file.content,
          };
        });

        workbenchStore.files.set(fileMap);
        workbenchStore.showWorkbench.set(true);

        toast.success(`Template "${name.trim()}" imported successfully!`);
      } else if (source === 'github-url' || source === 'gitlab-url') {
        const host = source === 'github-url' ? 'github.com' : 'gitlab.com';
        const normalizedUrl = normalizeHostedGitUrl(gitUrl, host);

        if (!normalizedUrl) {
          toast.error(`Please enter a valid ${host === 'github.com' ? 'GitHub' : 'GitLab'} repository`);
          return;
        }

        await onAdd(name.trim(), normalizedUrl, { source: mapToProjectSource(source) });
      } else {
        // Handle regular git URL
        const gitUrlRegex =
          /^https?:\/\/.*\.git$|^git@.*\.git$|^https?:\/\/github\.com\/.*\/.*$|^https?:\/\/gitlab\.com\/.*\/.*$/;

        if (!gitUrlRegex.test(gitUrl.trim())) {
          toast.error('Please enter a valid git repository URL');
          return;
        }

        await onAdd(name.trim(), gitUrl.trim(), { source: mapToProjectSource(source) });
      }

      setName('');
      setGitUrl('');
      onClose();
    } catch (error) {
      console.error('Error adding project:', error);
      toast.error('Failed to add project');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setName('');
      setGitUrl('');
      setSource('github-url');
      onClose();
    }
  };

  const sourceOptions = [
    { value: 'github-url', label: 'GitHub Repository', icon: Github },
    { value: 'gitlab-url', label: 'GitLab Repository', icon: GitlabIcon },
    { value: 'git-url', label: 'Generic Git URL', icon: GitBranch },
    { value: 'webcontainer', label: 'Current Session', icon: Code },
    { value: 'github-template', label: 'GitHub Template', icon: Github },
    { value: 'gitlab-template', label: 'GitLab Template', icon: GitlabIcon },
  ];

  return (
    <DialogRoot open={isOpen} onOpenChange={handleClose}>
      <Dialog showCloseButton={false} className="max-w-md">
        <div style={{ padding: 'var(--bolt-elements-component-padding-lg)' }}>
          <div
            className="flex items-center justify-between"
            style={{ marginBottom: 'var(--bolt-elements-spacing-2xl)' }}
          >
            <DialogTitle>Add New Project</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              disabled={loading}
              className="text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          <DialogDescription style={{ marginBottom: 'var(--bolt-elements-spacing-lg)' }}>
            Add a new project from a Git repository, template, or capture your current workspace as a snapshot.
          </DialogDescription>

          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--bolt-elements-spacing-lg)' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--bolt-elements-spacing-sm)' }}>
              <Label htmlFor="source-select" className="text-sm font-medium text-bolt-elements-textPrimary">
                Project Source
              </Label>
              <select
                id="source-select"
                value={source}
                onChange={(e) => handleSourceChange(e.target.value as ProjectSource)}
                disabled={loading}
                className="flex h-10 w-full rounded-md border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 px-3 py-2 text-sm text-bolt-elements-textPrimary ring-offset-bolt-elements-background-depth-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bolt-elements-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sourceOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--bolt-elements-spacing-sm)' }}>
              <Label htmlFor="project-name" className="text-sm font-medium text-bolt-elements-textPrimary">
                Project Name
              </Label>
              <Input
                id="project-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={source === 'webcontainer' ? 'Current Workspace Snapshot' : 'My Awesome Project'}
                disabled={loading}
                required
              />
              {source === 'webcontainer' && (
                <p className="text-xs text-bolt-elements-textSecondary">
                  Choose a name for this snapshot of your current workspace.
                </p>
              )}
            </div>

            {source === 'webcontainer' ? (
              <div
                className="border border-bolt-elements-borderColor rounded-lg bg-bolt-elements-background-depth-1"
                style={{ padding: 'var(--bolt-elements-spacing-lg)' }}
              >
                <div
                  className="flex items-center text-bolt-elements-textSecondary"
                  style={{ gap: 'var(--bolt-elements-spacing-sm)', marginBottom: 'var(--bolt-elements-spacing-sm)' }}
                >
                  <Code className="w-4 h-4" />
                  <span className="text-sm">Save current WebContainer session as a project</span>
                </div>
                <ul
                  className="text-xs text-bolt-elements-textSecondary"
                  style={{ display: 'flex', flexDirection: 'column', gap: 'var(--bolt-elements-spacing-xs)' }}
                >
                  <li>• All open workspace files are captured in this project snapshot.</li>
                  <li>• You can reopen the project later without linking a remote repository.</li>
                  <li>• Add a git repository later by editing the project settings.</li>
                </ul>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--bolt-elements-spacing-sm)' }}>
                <Label htmlFor="git-url" className="text-sm font-medium text-bolt-elements-textPrimary">
                  {source === 'github-url'
                    ? 'GitHub Repository'
                    : source === 'gitlab-url'
                      ? 'GitLab Repository'
                      : source === 'git-url'
                        ? 'Git Repository URL'
                        : source === 'github-template'
                          ? 'GitHub Repository (owner/repo)'
                          : 'GitLab Repository (owner/repo)'}
                </Label>
                <Input
                  id="git-url"
                  type="text"
                  value={gitUrl}
                  onChange={(e) => setGitUrl(e.target.value)}
                  placeholder={
                    source === 'github-url'
                      ? 'owner/repo or https://github.com/owner/repo.git'
                      : source === 'gitlab-url'
                        ? 'group/project or https://gitlab.com/group/project.git'
                        : source === 'git-url'
                          ? 'https://example.com/username/repo.git'
                          : source === 'github-template'
                            ? 'owner/repo'
                            : 'owner/repo'
                  }
                  disabled={loading}
                  required
                />
                <p className="text-xs text-bolt-elements-textSecondary">
                  {source === 'github-url'
                    ? 'Use a public GitHub repository. owner/repo or full URL are supported.'
                    : source === 'gitlab-url'
                      ? 'Use a public GitLab repository. group/project or full URL are supported.'
                      : source === 'git-url'
                        ? 'GitHub, GitLab, or any public git repository URL'
                        : source === 'github-template'
                          ? 'Import files from a GitHub repository as template'
                          : 'Import files from a GitLab repository as template'}
                </p>
              </div>
            )}

            <div
              className="flex"
              style={{ gap: 'var(--bolt-elements-spacing-md)', paddingTop: 'var(--bolt-elements-spacing-lg)' }}
            >
              <div className="flex-1">
                <Button type="button" variant="outline" onClick={handleClose} disabled={loading} className="w-full">
                  Cancel
                </Button>
              </div>
              <div className="flex-1">
                <Button type="submit" disabled={loading} variant="primary" className="w-full">
                  {loading && (
                    <Loader2 className="w-4 h-4" style={{ marginRight: 'var(--bolt-elements-spacing-sm)' }} />
                  )}
                  {loading ? 'Adding...' : 'Add Project'}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </Dialog>
    </DialogRoot>
  );
};
