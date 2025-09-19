import { useState } from 'react';
import { Users } from 'lucide-react';
import { Button } from '~/components/ui/Button';
import { Dialog, DialogRoot, DialogTitle, DialogDescription } from '~/components/ui/Dialog';
import { Input } from '~/components/ui/Input';
import { Textarea } from '~/components/ui/Textarea';
import { TeamService } from '~/lib/services/teamService';
import type { Team } from '~/components/projects/types';

interface CreateTeamDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateTeam: (team: Team) => void;
  organizationId?: string;
  currentUserId: string;
}

export function CreateTeamDialog({
  isOpen,
  onClose,
  onCreateTeam,
  organizationId,
  currentUserId,
}: CreateTeamDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    if (error) {
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setError('Team name is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const team = await TeamService.createTeam(
        formData.name.trim(),
        formData.description.trim(),
        currentUserId,
        organizationId,
      );

      onCreateTeam(team);

      // Reset form
      setFormData({ name: '', description: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create team');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setFormData({ name: '', description: '' });
      setError(null);
      onClose();
    }
  };

  return (
    <DialogRoot open={isOpen} onOpenChange={handleClose}>
      <Dialog showCloseButton={false}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-bolt-elements-button-primary-background flex items-center justify-center">
              <Users className="w-5 h-5 text-bolt-elements-button-primary-text" />
            </div>
            <div>
              <DialogTitle>Create New Team</DialogTitle>
              <DialogDescription>Start collaborating with your team members</DialogDescription>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Team Name */}
            <div>
              <label className="block text-sm font-medium text-bolt-elements-textPrimary mb-2">Team Name *</label>
              <Input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Enter team name"
                disabled={loading}
                required
                className="bg-transparent focus:bg-transparent"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-bolt-elements-textPrimary mb-2">Description</label>
              <Textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Describe what this team works on..."
                rows={3}
                disabled={loading}
                className="bg-transparent focus:bg-transparent"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4">
              <Button type="button" onClick={handleClose} variant="ghost" disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading || !formData.name.trim()}>
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Creating...
                  </div>
                ) : (
                  'Create Team'
                )}
              </Button>
            </div>
          </form>
        </div>
      </Dialog>
    </DialogRoot>
  );
}
