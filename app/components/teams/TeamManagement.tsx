import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, Plus, Settings, UserPlus, Search, Crown, Shield, Code, Eye, Trash2, ArrowRight } from 'lucide-react';
import { Button } from '~/components/ui/Button';
import { Input } from '~/components/ui/Input';
import { CreateTeamDialog } from './CreateTeamDialog';
import { AddMemberDialog } from './AddMemberDialog';
import { TeamSettingsDialog } from './TeamSettingsDialog';
import { TeamService } from '~/lib/services/teamService';
import { currentUser } from '~/lib/stores/auth';
import { useStore } from '@nanostores/react';
import type { Team, TeamMember, TeamRole } from '~/components/projects/types';

interface TeamManagementProps {
  organizationId?: string;
}

export function TeamManagement({ organizationId }: TeamManagementProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [loading, setLoading] = useState(true);

  const user = useStore(currentUser);

  useEffect(() => {
    loadTeams();
  }, [user, organizationId]);

  const loadTeams = async () => {
    if (!user) {
      return;
    }

    setLoading(true);

    try {
      const userTeams = await TeamService.listTeams(user.id, organizationId);
      setTeams(userTeams);
    } catch (error) {
      console.error('Failed to load teams:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTeam = async (team: Team) => {
    setTeams((prev) => [...prev, team]);
    setShowCreateDialog(false);
  };

  const handleAddMember = async (member: TeamMember) => {
    if (selectedTeam) {
      const updatedTeam = {
        ...selectedTeam,
        members: [...selectedTeam.members, member],
      };
      setSelectedTeam(updatedTeam);
      setTeams((prev) => prev.map((t) => (t.id === selectedTeam.id ? updatedTeam : t)));
    }

    setShowAddMemberDialog(false);
  };

  const handleRemoveMember = async (teamId: string, userId: string) => {
    try {
      await TeamService.removeMember(teamId, userId);

      // Update local state
      setTeams((prev) =>
        prev.map((team) =>
          team.id === teamId ? { ...team, members: team.members.filter((m) => m.userId !== userId) } : team,
        ),
      );

      if (selectedTeam && selectedTeam.id === teamId) {
        setSelectedTeam((prev) =>
          prev
            ? {
                ...prev,
                members: prev.members.filter((m) => m.userId !== userId),
              }
            : null,
        );
      }
    } catch (error) {
      console.error('Failed to remove member:', error);
    }
  };

  const handleRoleChange = async (teamId: string, userId: string, role: TeamRole) => {
    try {
      await TeamService.setRole(teamId, userId, role);

      // Update local state
      setTeams((prev) =>
        prev.map((team) =>
          team.id === teamId
            ? {
                ...team,
                members: team.members.map((m) => (m.userId === userId ? { ...m, role } : m)),
              }
            : team,
        ),
      );

      if (selectedTeam && selectedTeam.id === teamId) {
        setSelectedTeam((prev) =>
          prev
            ? {
                ...prev,
                members: prev.members.map((m) => (m.userId === userId ? { ...m, role } : m)),
              }
            : null,
        );
      }
    } catch (error) {
      console.error('Failed to update role:', error);
    }
  };

  const getRoleIcon = (role: TeamRole) => {
    switch (role) {
      case 'owner':
        return <Crown className="w-4 h-4 text-yellow-500" />;
      case 'admin':
        return <Shield className="w-4 h-4 text-blue-500" />;
      case 'developer':
        return <Code className="w-4 h-4 text-green-500" />;
      case 'viewer':
        return <Eye className="w-4 h-4 text-gray-500" />;
      default:
        return null;
    }
  };

  const getRoleName = (role: TeamRole) => {
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  const filteredTeams = teams.filter(
    (team) =>
      team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      team.description?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-bolt-elements-button-primary-background"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col lg:flex-row bg-bolt-elements-background-depth-1">
      {/* Teams List */}
      <div className="w-full lg:w-1/3 border-r border-bolt-elements-borderColor p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-bolt-elements-textPrimary flex items-center gap-2">
            <Users className="w-5 h-5" />
            Teams
          </h2>
          {user && (
            <Button onClick={() => setShowCreateDialog(true)} className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              New Team
            </Button>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-bolt-elements-textSecondary" />
          <Input
            type="text"
            placeholder="Search teams..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-transparent focus:bg-transparent"
          />
        </div>

        {/* Teams List */}
        <div className="space-y-2">
          {filteredTeams.map((team) => (
            <motion.div
              key={team.id}
              whileHover={{ scale: 1.02 }}
              className={`p-4 rounded-lg border cursor-pointer transition-all ${
                selectedTeam?.id === team.id
                  ? 'border-bolt-elements-button-primary-background bg-bolt-elements-button-primary-background/10'
                  : 'border-bolt-elements-borderColor hover:border-bolt-elements-button-primary-background/50'
              }`}
              onClick={() => setSelectedTeam(team)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-bolt-elements-textPrimary">{team.name}</h3>
                  {team.description && (
                    <p className="text-sm text-bolt-elements-textSecondary mt-1">{team.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-bolt-elements-textSecondary bg-bolt-elements-background-depth-3 px-2 py-1 rounded">
                    {team.members.length} members
                  </span>
                </div>
              </div>
            </motion.div>
          ))}

          {filteredTeams.length === 0 && (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-bolt-elements-textSecondary mx-auto mb-4" />
              <p className="text-bolt-elements-textSecondary">{searchQuery ? 'No teams found' : 'No teams yet'}</p>
              {!searchQuery && user && (
                <Button
                  onClick={() => setShowCreateDialog(true)}
                  variant="sidebar-nav"
                  size="lg"
                  className="mt-4 w-full justify-between px-4 py-3"
                >
                  <span className="flex items-center gap-3 text-sm font-medium">
                    <Plus className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" />
                    Create Your First Team
                  </span>
                  <ArrowRight className="w-4 h-4 opacity-60 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0.5" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Team Details */}
      <div className="flex-1 p-6">
        {selectedTeam ? (
          <div>
            {/* Team Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-bolt-elements-textPrimary">{selectedTeam.name}</h1>
                {selectedTeam.description && (
                  <p className="text-bolt-elements-textSecondary mt-1">{selectedTeam.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setShowAddMemberDialog(true)}
                  variant="sidebar-nav"
                  size="md"
                  className="justify-between px-4 py-3"
                >
                  <span className="flex items-center gap-3 text-sm font-medium">
                    <UserPlus className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" />
                    Add Member
                  </span>
                  <ArrowRight className="w-4 h-4 opacity-60 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0.5" />
                </Button>
                <Button
                  onClick={() => setShowSettingsDialog(true)}
                  variant="sidebar-nav"
                  size="md"
                  className="justify-between px-4 py-3"
                >
                  <span className="flex items-center gap-3 text-sm font-medium">
                    <Settings className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" />
                    Settings
                  </span>
                  <ArrowRight className="w-4 h-4 opacity-60 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0.5" />
                </Button>
              </div>
            </div>

            {/* Team Members */}
            <div className="bg-bolt-elements-background-depth-2 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-bolt-elements-textPrimary mb-4">
                Team Members ({selectedTeam.members.length})
              </h3>

              <div className="space-y-3">
                {selectedTeam.members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 bg-bolt-elements-background-depth-1 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-bolt-elements-button-primary-background flex items-center justify-center text-sm font-medium text-bolt-elements-button-primary-text">
                        {member.avatar ? (
                          <img
                            src={member.avatar}
                            alt={member.name}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          member.name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .toUpperCase()
                            .slice(0, 2)
                        )}
                      </div>

                      {/* Member Info */}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-bolt-elements-textPrimary">{member.name}</span>
                          {getRoleIcon(member.role)}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-bolt-elements-textSecondary">
                          <span>{member.email}</span>
                          <span>•</span>
                          <span>{getRoleName(member.role)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    {user && member.userId !== user.id && member.role !== 'owner' && (
                      <div className="flex items-center gap-2">
                        <select
                          value={member.role}
                          onChange={(e) => handleRoleChange(selectedTeam.id, member.userId, e.target.value as TeamRole)}
                          className="text-sm border border-bolt-elements-borderColor rounded px-2 py-1 bg-bolt-elements-background-depth-1 text-bolt-elements-textPrimary"
                        >
                          <option value="viewer">Viewer</option>
                          <option value="developer">Developer</option>
                          <option value="admin">Admin</option>
                        </select>
                        <Button
                          onClick={() => handleRemoveMember(selectedTeam.id, member.userId)}
                          variant="ghost"
                          className="text-red-500 hover:text-red-600 p-2"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Users className="w-16 h-16 text-bolt-elements-textSecondary mx-auto mb-4" />
              <h3 className="text-lg font-medium text-bolt-elements-textPrimary mb-2">Select a Team</h3>
              <p className="text-bolt-elements-textSecondary">
                Choose a team from the sidebar to view details and manage members
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
      {user && (
        <>
          <CreateTeamDialog
            isOpen={showCreateDialog}
            onClose={() => setShowCreateDialog(false)}
            onCreateTeam={handleCreateTeam}
            organizationId={organizationId}
            currentUserId={user.id}
          />

          {selectedTeam && (
            <>
              <AddMemberDialog
                isOpen={showAddMemberDialog}
                onClose={() => setShowAddMemberDialog(false)}
                onAddMember={handleAddMember}
                teamId={selectedTeam.id}
              />

              <TeamSettingsDialog
                isOpen={showSettingsDialog}
                onClose={() => setShowSettingsDialog(false)}
                team={selectedTeam}
                onUpdateTeam={(updatedTeam) => {
                  setSelectedTeam(updatedTeam);
                  setTeams((prev) => prev.map((t) => (t.id === updatedTeam.id ? updatedTeam : t)));
                }}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
