import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, Save, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '~/components/ui/Button';
import { Dialog, DialogRoot, DialogTitle, DialogDescription } from '~/components/ui/Dialog';
import { Input } from '~/components/ui/Input';
import { Textarea } from '~/components/ui/Textarea';
import { Switch } from '~/components/ui/Switch';
import { Label } from '~/components/ui/Label';
import { InlineSelect } from '~/components/ui/InlineSelect';
import { TeamService } from '~/lib/services/teamService';
import type { Team, TeamSettings, TeamRole } from '~/components/projects/types';

interface TeamSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  team: Team;
  onUpdateTeam: (team: Team) => void;
}

export function TeamSettingsDialog({ isOpen, onClose, team, onUpdateTeam }: TeamSettingsDialogProps) {
  const [formData, setFormData] = useState({
    name: team.name,
    description: team.description || '',
  });
  const [settings, setSettings] = useState<TeamSettings>(team.settings);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFormData({
      name: team.name,
      description: team.description || '',
    });
    setSettings(team.settings);
  }, [team]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    if (error) {
      setError(null);
    }
  };

  const handleSettingChange = (field: keyof TeamSettings, value: any) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('Team name is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const updatedTeam = await TeamService.updateTeam(team.id, {
        name: formData.name.trim(),
        description: formData.description.trim(),
      });

      if (updatedTeam) {
        await TeamService.updateSettings(team.id, settings);
        onUpdateTeam({ ...updatedTeam, settings });
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update team');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);

    try {
      await TeamService.deleteTeam(team.id);
      onClose();

      // The parent component should handle removing the team from the list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete team');
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setShowDeleteConfirm(false);
      setError(null);
      onClose();
    }
  };

  const defaultRoleOptions: { value: TeamRole; label: string }[] = [
    { value: 'viewer', label: 'Viewer' },
    { value: 'developer', label: 'Developer' },
    { value: 'admin', label: 'Admin' },
  ];

  return (
    <DialogRoot open={isOpen} onOpenChange={handleClose}>
      <Dialog showCloseButton={false}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-bolt-elements-button-primary-background flex items-center justify-center">
              <Settings className="w-5 h-5 text-bolt-elements-button-primary-text" />
            </div>
            <div>
              <DialogTitle>Team Settings</DialogTitle>
              <DialogDescription>Configure team details and permissions</DialogDescription>
            </div>
          </div>

          <div className="relative flex flex-col gap-10">
            <div className="grid gap-10 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
              {/* Basic Information */}
              <section className="space-y-6">
                <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-bolt-elements-textSecondary">
                  Basic Information
                </h3>

                <div className="space-y-5">
                  <div className="space-y-2.5">
                    <Label htmlFor="team-name" className="text-sm font-medium text-bolt-elements-textPrimary">
                      Team Name *
                    </Label>
                    <Input
                      id="team-name"
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      placeholder="Enter team name"
                      disabled={loading}
                      required
                      className="bg-transparent focus:bg-transparent"
                    />
                  </div>

                  <div className="space-y-2.5">
                    <Label htmlFor="team-description" className="text-sm font-medium text-bolt-elements-textPrimary">
                      Description
                    </Label>
                    <Textarea
                      id="team-description"
                      value={formData.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      placeholder="Describe what this team works on..."
                      rows={5}
                      disabled={loading}
                      className="bg-transparent focus:bg-transparent"
                    />
                  </div>
                </div>
              </section>

              {/* Team Settings */}
              <section className="space-y-6">
                <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-bolt-elements-textSecondary">
                  Team Settings
                </h3>

                <div className="space-y-6">
                  <div className="flex items-start justify-between gap-6">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-bolt-elements-textPrimary">Allow Invites</p>
                      <p className="mt-1 text-sm text-bolt-elements-textSecondary">
                        Team members can invite new members
                      </p>
                    </div>
                    <Switch
                      id="allow-invites"
                      checked={settings.allowInvites}
                      onCheckedChange={(checked) => handleSettingChange('allowInvites', checked)}
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-2.5">
                    <Label
                      htmlFor="team-default-role"
                      id="team-default-role-label"
                      className="text-sm font-medium text-bolt-elements-textPrimary"
                    >
                      Default Role for New Members
                    </Label>
                    <InlineSelect
                      id="team-default-role"
                      name="team-default-role"
                      value={settings.defaultRole}
                      onChange={(value) => handleSettingChange('defaultRole', value as TeamRole)}
                      options={defaultRoleOptions}
                      disabled={loading}
                      placeholder="Select a role"
                    />
                  </div>

                  <div className="flex items-start justify-between gap-6">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-bolt-elements-textPrimary">
                        Require Approval for New Members
                      </p>
                      <p className="mt-1 text-sm text-bolt-elements-textSecondary">
                        New members need approval before joining
                      </p>
                    </div>
                    <Switch
                      id="require-approval"
                      checked={settings.requireApprovalForNewMembers}
                      onCheckedChange={(checked) => handleSettingChange('requireApprovalForNewMembers', checked)}
                      disabled={loading}
                    />
                  </div>

                  <div className="flex items-start justify-between gap-6">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-bolt-elements-textPrimary">Enable Time Tracking</p>
                      <p className="mt-1 text-sm text-bolt-elements-textSecondary">
                        Track time spent on features and projects
                      </p>
                    </div>
                    <Switch
                      id="enable-time-tracking"
                      checked={settings.enableTimeTracking}
                      onCheckedChange={(checked) => handleSettingChange('enableTimeTracking', checked)}
                      disabled={loading}
                    />
                  </div>

                  <div className="flex items-start justify-between gap-6">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-bolt-elements-textPrimary">Enable Analytics</p>
                      <p className="mt-1 text-sm text-bolt-elements-textSecondary">
                        View team performance and productivity metrics
                      </p>
                    </div>
                    <Switch
                      id="enable-analytics"
                      checked={settings.enableAnalytics}
                      onCheckedChange={(checked) => handleSettingChange('enableAnalytics', checked)}
                      disabled={loading}
                    />
                  </div>
                </div>
              </section>
            </div>

            {/* Danger Zone */}
            <section className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-red-500">Danger Zone</h3>

              <div className="rounded-xl border border-[rgba(255,99,99,0.35)] bg-[linear-gradient(180deg,rgba(255,99,99,0.12),rgba(255,54,54,0.08))] p-4 md:p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  <div className="flex flex-col gap-2 md:flex-1 md:gap-1.5">
                    <h4 className="text-sm font-semibold text-red-400">Delete Team</h4>
                    <p className="text-xs md:text-sm text-red-300">
                      Once you delete a team, there is no going back. All team data, including members and settings,
                      will be permanently deleted.
                    </p>
                  </div>
                  <Button
                    onClick={() => setShowDeleteConfirm(true)}
                    variant="destructive"
                    className="flex w-full items-center justify-center gap-2 md:w-auto"
                    disabled={loading}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Team
                  </Button>
                </div>
              </div>
            </section>

            {/* Error Message */}
            {error && (
              <div className="rounded-lg border border-bolt-elements-status-error-border bg-bolt-elements-status-error-background px-3 py-2">
                <p className="text-sm text-bolt-elements-status-error-text">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-4 pt-6 border-t border-bolt-elements-borderColor">
              <Button onClick={handleClose} variant="ghost" disabled={loading}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={loading || !formData.name.trim()}>
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                    Saving...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Save className="w-4 h-4" />
                    Save Changes
                  </div>
                )}
              </Button>
            </div>
          </div>

          {/* Delete Confirmation Dialog */}
          {showDeleteConfirm && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4 rounded-lg">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-bolt-elements-background-depth-2 rounded-lg p-6 max-w-sm w-full border border-bolt-elements-borderColor"
              >
                <div className="flex items-center gap-3 mb-4">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                  <h3 className="text-lg font-semibold text-bolt-elements-textPrimary">Delete Team</h3>
                </div>
                <p className="text-sm text-bolt-elements-textSecondary mb-6">
                  Are you sure you want to delete "{team.name}"? This action cannot be undone.
                </p>
                <div className="flex items-center gap-3">
                  <Button
                    onClick={() => setShowDeleteConfirm(false)}
                    variant="ghost"
                    className="flex-1"
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleDelete} className="flex-1 bg-red-600 hover:bg-red-700" disabled={loading}>
                    {loading ? 'Deleting...' : 'Delete'}
                  </Button>
                </div>
              </motion.div>
            </div>
          )}
        </div>
      </Dialog>
    </DialogRoot>
  );
}
