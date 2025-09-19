import { useState } from 'react';
import { X, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'react-toastify';
import { Dialog, DialogRoot, DialogTitle, DialogDescription } from '~/components/ui/Dialog';
import { Button } from '~/components/ui/Button';
import { Input } from '~/components/ui/Input';
import { Textarea } from '~/components/ui/Textarea';
import { Select } from '~/components/ui/Select';
import { Label } from '~/components/ui/Label';
import { UserAssigneeSelect } from '~/components/ui/UserAssigneeSelect';
import type { Branch, NewFeature, Project } from './types';

interface NewFeatureDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (feature: NewFeature) => void;
  branches: Branch[];
  project?: Project;
}

export const NewFeatureDialog = ({ isOpen, onClose, onAdd, branches, project }: NewFeatureDialogProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [branchRef, setBranchRef] = useState('');
  const [branchFrom, setBranchFrom] = useState('main');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [complexity, setComplexity] = useState<'simple' | 'medium' | 'complex' | 'epic'>('medium');
  const [estimatedHours, setEstimatedHours] = useState<string>('');
  const [assignee, setAssignee] = useState('');
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(false);
  const [enhancing, setEnhancing] = useState(false);

  const enhanceFeature = async () => {
    if (!name.trim()) {
      toast.error('Please enter a feature name first');
      return;
    }

    setEnhancing(true);

    try {
      // Create project-aware prompt for enhancement
      const promptContext = [
        `Please enhance this feature request for a ${project?.name ? `project called "${project.name}"` : 'software project'}.`,
        project?.description ? `Project description: ${project.description}` : '',
        project?.gitUrl ? `Repository: ${project.gitUrl}` : '',
        '',
        'Current feature details:',
        `Name: ${name}`,
        description ? `Description: ${description}` : 'Description: (not provided)',
        '',
        'Please provide:',
        '1. An enhanced, detailed description of what this feature should do',
        '2. Suggest appropriate tags (comma-separated)',
        '3. Recommend priority level (low, medium, high, critical)',
        '4. Estimate complexity (simple, medium, complex, epic)',
        '5. Suggest estimated hours for completion',
        '',
        'Format your response as:',
        'Description: [enhanced description]',
        'Tags: [tag1, tag2, tag3]',
        'Priority: [priority level]',
        'Complexity: [complexity level]',
        'Estimated Hours: [number]',
      ]
        .filter(Boolean)
        .join('\n');

      const response = await fetch('/api/enhancer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: promptContext,
          model: 'claude-3-5-sonnet-20241022',
          provider: { name: 'anthropic' },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');

        if (response.status === 401) {
          throw new Error('Authentication failed. Please check your API keys in settings.');
        } else if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please try again in a few minutes.');
        } else if (response.status >= 500) {
          throw new Error('Server error. Please try again later.');
        } else {
          throw new Error(`Failed to enhance feature: ${errorText}`);
        }
      }

      // Stream the response
      const reader = response.body?.getReader();
      let enhancedText = '';

      if (!reader) {
        throw new Error('No response body received from enhancement service');
      }

      try {
        const timeout = setTimeout(() => {
          reader.cancel();
          throw new Error('Enhancement request timed out');
        }, 30000); // 30 second timeout

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          const chunk = new TextDecoder().decode(value);
          enhancedText += chunk;
        }

        clearTimeout(timeout);
      } catch (streamError) {
        console.error('Stream reading error:', streamError);
        throw new Error('Failed to read enhancement response');
      }

      if (!enhancedText.trim()) {
        throw new Error('Enhancement service returned empty response');
      }

      // Parse the enhanced response
      parseEnhancedFeature(enhancedText);
      toast.success('Feature enhanced with AI! Please review and adjust the fields as needed.');
    } catch (error) {
      console.error('Error enhancing feature:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Failed to enhance feature: ${errorMessage}`);
    } finally {
      setEnhancing(false);
    }
  };

  const parseEnhancedFeature = (enhancedText: string) => {
    const lines = enhancedText.split('\n');

    lines.forEach((line) => {
      const trimmedLine = line.trim();

      if (trimmedLine.startsWith('Description:')) {
        const desc = trimmedLine.replace('Description:', '').trim();

        if (desc) {
          setDescription(desc);
        }
      } else if (trimmedLine.startsWith('Tags:')) {
        const tagsText = trimmedLine.replace('Tags:', '').trim();

        if (tagsText) {
          setTags(tagsText);
        }
      } else if (trimmedLine.startsWith('Priority:')) {
        const priorityText = trimmedLine.replace('Priority:', '').trim().toLowerCase();

        if (['low', 'medium', 'high', 'critical'].includes(priorityText)) {
          setPriority(priorityText as any);
        }
      } else if (trimmedLine.startsWith('Complexity:')) {
        const complexityText = trimmedLine.replace('Complexity:', '').trim().toLowerCase();

        if (['simple', 'medium', 'complex', 'epic'].includes(complexityText)) {
          setComplexity(complexityText as any);
        }
      } else if (trimmedLine.startsWith('Estimated Hours:')) {
        const hoursText = trimmedLine.replace('Estimated Hours:', '').trim();
        const hours = parseFloat(hoursText);

        if (!isNaN(hours)) {
          setEstimatedHours(hours.toString());
        }
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !branchRef.trim()) {
      toast.error('Please fill in required fields');
      return;
    }

    setLoading(true);

    try {
      const newFeature: NewFeature = {
        name: name.trim(),
        description: description.trim(),
        branchRef: branchRef.trim(),
        branchFrom: branchFrom.trim(),
        priority,
        complexity,
        estimatedHours: estimatedHours ? parseFloat(estimatedHours) : undefined,
        assignee: assignee.trim() || undefined,
        tags: tags.trim()
          ? tags
              .split(',')
              .map((tag) => tag.trim())
              .filter(Boolean)
          : undefined,
      };

      await onAdd(newFeature);

      // Reset form
      setName('');
      setDescription('');
      setBranchRef('');
      setBranchFrom('main');
      setPriority('medium');
      setComplexity('medium');
      setEstimatedHours('');
      setAssignee('');
      setTags('');
      onClose();
    } catch (error) {
      console.error('Error adding feature:', error);
      toast.error('Failed to add feature');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setName('');
      setDescription('');
      setBranchRef('');
      setBranchFrom('main');
      setPriority('medium');
      setComplexity('medium');
      setEstimatedHours('');
      setAssignee('');
      setTags('');
      onClose();
    }
  };

  // Generate branch name suggestion from feature name
  const generateBranchName = (featureName: string) => {
    return featureName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 50);
  };

  const handleNameChange = (value: string) => {
    setName(value);

    if (!branchRef && value) {
      setBranchRef(`feature/${generateBranchName(value)}`);
    }
  };

  const availableBranches = branches.length > 0 ? branches.map((b) => b.name) : ['main', 'develop'];

  return (
    <DialogRoot open={isOpen} onOpenChange={handleClose}>
      <Dialog showCloseButton={false} className="max-w-md">
        <div style={{ padding: 'var(--bolt-elements-component-padding-lg)' }}>
          <div
            className="flex items-center justify-between"
            style={{ marginBottom: 'var(--bolt-elements-spacing-2xl)' }}
          >
            <DialogTitle>Add New Feature</DialogTitle>
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
            Create a new feature with a descriptive name and branch information.
          </DialogDescription>

          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--bolt-elements-spacing-lg)' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--bolt-elements-spacing-sm)' }}>
              <Label htmlFor="feature-name" className="text-bolt-elements-textPrimary">
                Feature Name *
              </Label>
              <Input
                id="feature-name"
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="User Authentication"
                disabled={loading}
                required
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--bolt-elements-spacing-sm)' }}>
              <div className="flex items-center justify-between">
                <Label htmlFor="feature-description" className="text-bolt-elements-textPrimary">
                  Description
                </Label>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={enhanceFeature}
                  disabled={loading || enhancing || !name.trim()}
                  className="inline-flex items-center text-xs h-auto"
                  style={{
                    gap: 'var(--bolt-elements-spacing-xs)',
                    padding: 'var(--bolt-elements-spacing-xs) var(--bolt-elements-spacing-sm)',
                  }}
                >
                  {enhancing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  {enhancing ? 'Enhancing...' : 'Enhance with AI'}
                </Button>
              </div>
              <Textarea
                id="feature-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this feature does..."
                disabled={loading || enhancing}
                rows={4}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--bolt-elements-spacing-sm)' }}>
              <Label htmlFor="branch-ref" className="text-bolt-elements-textPrimary">
                Branch Name *
              </Label>
              <Input
                id="branch-ref"
                type="text"
                value={branchRef}
                onChange={(e) => setBranchRef(e.target.value)}
                placeholder="feature/user-authentication"
                disabled={loading}
                className="font-mono text-sm"
                required
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--bolt-elements-spacing-sm)' }}>
              <Label htmlFor="branch-from" className="text-bolt-elements-textPrimary">
                Branch From
              </Label>
              <Select
                id="branch-from"
                value={branchFrom}
                onChange={(e) => setBranchFrom(e.target.value)}
                disabled={loading}
              >
                {availableBranches.map((branch) => (
                  <option key={branch} value={branch}>
                    {branch}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-bolt-elements-textSecondary">Base branch to create the feature branch from</p>
            </div>

            {/* Enhanced fields */}
            <div className="grid grid-cols-2" style={{ gap: 'var(--bolt-elements-spacing-lg)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--bolt-elements-spacing-sm)' }}>
                <Label htmlFor="priority" className="text-bolt-elements-textPrimary">
                  Priority
                </Label>
                <Select
                  id="priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  disabled={loading}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </Select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--bolt-elements-spacing-sm)' }}>
                <Label htmlFor="complexity" className="text-bolt-elements-textPrimary">
                  Complexity
                </Label>
                <Select
                  id="complexity"
                  value={complexity}
                  onChange={(e) => setComplexity(e.target.value as any)}
                  disabled={loading}
                >
                  <option value="simple">Simple</option>
                  <option value="medium">Medium</option>
                  <option value="complex">Complex</option>
                  <option value="epic">Epic</option>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2" style={{ gap: 'var(--bolt-elements-spacing-lg)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--bolt-elements-spacing-sm)' }}>
                <Label htmlFor="estimated-hours" className="text-bolt-elements-textPrimary">
                  Estimated Hours
                </Label>
                <Input
                  id="estimated-hours"
                  type="number"
                  step="0.5"
                  min="0"
                  value={estimatedHours}
                  onChange={(e) => setEstimatedHours(e.target.value)}
                  placeholder="8"
                  disabled={loading}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--bolt-elements-spacing-sm)' }}>
                <Label htmlFor="assignee" className="text-bolt-elements-textPrimary">
                  Assignee
                </Label>
                <UserAssigneeSelect
                  value={assignee || undefined}
                  onChange={(userId) => setAssignee(userId || '')}
                  projectId={project?.id}
                  teamId={project?.teamId}
                  disabled={loading}
                  placeholder="Assign to team member..."
                  allowUnassigned={true}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--bolt-elements-spacing-sm)' }}>
              <Label htmlFor="tags" className="text-bolt-elements-textPrimary">
                Tags
              </Label>
              <Input
                id="tags"
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="frontend, ui, auth"
                disabled={loading}
              />
              <p className="text-xs text-bolt-elements-textSecondary">Comma-separated tags for organization</p>
            </div>

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
                  {loading ? 'Adding...' : 'Add Feature'}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </Dialog>
    </DialogRoot>
  );
};
