import { useState } from 'react';
import { UserPlus, Mail, Shield } from 'lucide-react';
import { Button } from '~/components/ui/Button';
import { Dialog, DialogRoot, DialogTitle, DialogDescription } from '~/components/ui/Dialog';
import { Input } from '~/components/ui/Input';
import { TeamService } from '~/lib/services/teamService';
import type { TeamMember, TeamRole, NewTeamMember } from '~/components/projects/types';

interface AddMemberDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAddMember: (member: TeamMember) => void;
  teamId: string;
}

export function AddMemberDialog({ isOpen, onClose, onAddMember, teamId }: AddMemberDialogProps) {
  const [formData, setFormData] = useState({
    email: '',
    role: 'developer' as TeamRole,
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

    if (!formData.email.trim()) {
      setError('Email is required');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(formData.email.trim())) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const newMember: NewTeamMember = {
        email: formData.email.trim(),
        role: formData.role,
      };

      const member = await TeamService.addMember(teamId, newMember);
      onAddMember(member);

      // Reset form
      setFormData({ email: '', role: 'developer' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add member');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setFormData({ email: '', role: 'developer' });
      setError(null);
      onClose();
    }
  };

  const roleOptions = [
    { value: 'viewer', label: 'Viewer', description: 'Can view projects and analytics' },
    { value: 'developer', label: 'Developer', description: 'Can manage features and view analytics' },
    { value: 'admin', label: 'Admin', description: 'Can manage team, features, and settings' },
  ];

  return (
    <DialogRoot open={isOpen} onOpenChange={handleClose}>
      <Dialog showCloseButton={false}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-bolt-elements-button-primary-background flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-bolt-elements-button-primary-text" />
            </div>
            <div>
              <DialogTitle>Add Team Member</DialogTitle>
              <DialogDescription>Invite someone to join your team</DialogDescription>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-bolt-elements-textPrimary mb-2">Email Address *</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-bolt-elements-textSecondary" />
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="user@example.com"
                  className="pl-10 bg-transparent focus:bg-transparent"
                  disabled={loading}
                  required
                />
              </div>
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-bolt-elements-textPrimary mb-2">Role *</label>
              <div className="space-y-3">
                {roleOptions.map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      formData.role === option.value
                        ? 'border-bolt-elements-button-primary-background bg-bolt-elements-button-primary-background/10'
                        : 'border-bolt-elements-borderColor hover:border-bolt-elements-button-primary-background/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={option.value}
                      checked={formData.role === option.value}
                      onChange={(e) => handleInputChange('role', e.target.value)}
                      className="mt-1"
                      disabled={loading}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-bolt-elements-textSecondary" />
                        <span className="font-medium text-bolt-elements-textPrimary">{option.label}</span>
                      </div>
                      <p className="text-sm text-bolt-elements-textSecondary mt-1">{option.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-lg border border-bolt-elements-status-error-border bg-bolt-elements-status-error-background px-3 py-2">
                <p className="text-sm text-bolt-elements-status-error-text">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4">
              <Button type="button" onClick={handleClose} variant="ghost" disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading || !formData.email.trim()}>
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Adding...
                  </div>
                ) : (
                  'Add Member'
                )}
              </Button>
            </div>
          </form>
        </div>
      </Dialog>
    </DialogRoot>
  );
}
