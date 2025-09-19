import { useState, useEffect } from 'react';
import { ChevronDown, User, X } from 'lucide-react';
import { UserService } from '~/lib/services/userService';
import { TeamService } from '~/lib/services/teamService';
import { currentUser } from '~/lib/stores/auth';
import { useStore } from '@nanostores/react';
import type { User as UserType } from '~/components/projects/types';

interface UserAssigneeSelectProps {
  value?: string; // User ID
  onChange: (userId: string | undefined) => void;
  projectId?: string;
  teamId?: string;
  disabled?: boolean;
  placeholder?: string;
  allowUnassigned?: boolean;
  className?: string;
}

export function UserAssigneeSelect({
  value,
  onChange,
  projectId,
  teamId,
  disabled = false,
  placeholder = 'Select assignee...',
  allowUnassigned = true,
  className = '',
}: UserAssigneeSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);

  const currentUserData = useStore(currentUser);

  useEffect(() => {
    loadUsers();
  }, [projectId, teamId, currentUserData]);

  useEffect(() => {
    if (value && users.length > 0) {
      const user = users.find((u) => u.id === value);
      setSelectedUser(user || null);
    } else {
      setSelectedUser(null);
    }
  }, [value, users]);

  const loadUsers = async () => {
    if (!currentUserData) {
      return;
    }

    setLoading(true);

    try {
      let availableUsers: UserType[] = [];

      if (teamId) {
        // Load users from specific team
        availableUsers = await UserService.getUsersByTeam(teamId);
      } else if (projectId) {
        /*
         * For now, get all users that the current user has access to
         * TODO: Implement project-specific user access when project-team relationships are established
         */
        const userTeams = await TeamService.listTeams(currentUserData.id);
        const allTeamUsers = new Set<UserType>();

        for (const team of userTeams) {
          const teamUsers = await UserService.getUsersByTeam(team.id);
          teamUsers.forEach((user) => allTeamUsers.add(user));
        }

        availableUsers = Array.from(allTeamUsers);
      } else {
        // Fallback: search for users (limited scope for security)
        availableUsers = [currentUserData];
      }

      // Remove duplicates and sort by name
      const uniqueUsers = availableUsers.filter(
        (user, index, self) => index === self.findIndex((u) => u.id === user.id),
      );

      uniqueUsers.sort((a, b) => a.name.localeCompare(b.name));
      setUsers(uniqueUsers);
    } catch (error) {
      console.error('Failed to load users:', error);

      // Fallback to current user only
      if (currentUserData) {
        setUsers([currentUserData]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (userId: string | undefined) => {
    onChange(userId);
    setIsOpen(false);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full flex items-center justify-between p-2 border rounded-md text-left
          ${
            disabled
              ? 'bg-bolt-elements-bg-depth-2 border-bolt-elements-borderColor text-bolt-elements-textTertiary cursor-not-allowed opacity-50'
              : 'bg-bolt-elements-background-depth-2 border-bolt-elements-borderColor text-bolt-elements-textPrimary hover:border-bolt-elements-button-primary-background'
          }
          ${isOpen ? 'border-bolt-elements-button-primary-background' : ''}
        `}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {selectedUser ? (
            <>
              {/* User Avatar */}
              <div className="w-6 h-6 rounded-full bg-bolt-elements-button-primary-background flex items-center justify-center text-xs font-medium text-bolt-elements-button-primary-text flex-shrink-0">
                {selectedUser.avatar ? (
                  <img
                    src={selectedUser.avatar}
                    alt={selectedUser.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  getInitials(selectedUser.name)
                )}
              </div>
              <span className="truncate">{selectedUser.name}</span>
            </>
          ) : (
            <>
              <User className="w-4 h-4 text-bolt-elements-textSecondary flex-shrink-0" />
              <span className="text-bolt-elements-textSecondary truncate">{placeholder}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {selectedUser && allowUnassigned && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSelect(undefined);
              }}
              className="p-1 hover:bg-bolt-elements-background-depth-3 rounded text-bolt-elements-textSecondary"
              title="Clear assignee"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          <ChevronDown
            className={`w-4 h-4 text-bolt-elements-textSecondary transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
          {loading ? (
            <div className="p-3 text-center text-bolt-elements-textSecondary">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-bolt-elements-button-primary-background mx-auto"></div>
            </div>
          ) : (
            <>
              {allowUnassigned && (
                <button
                  type="button"
                  onClick={() => handleSelect(undefined)}
                  className="w-full flex items-center gap-2 p-3 text-left hover:bg-bolt-elements-background-depth-3 transition-colors"
                >
                  <User className="w-6 h-6 text-bolt-elements-textSecondary" />
                  <span className="text-bolt-elements-textSecondary">Unassigned</span>
                </button>
              )}

              {users.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => handleSelect(user.id)}
                  className={`w-full flex items-center gap-3 p-3 text-left hover:bg-bolt-elements-background-depth-3 transition-colors ${
                    selectedUser?.id === user.id ? 'bg-bolt-elements-button-primary-background/10' : ''
                  }`}
                >
                  {/* User Avatar */}
                  <div className="w-6 h-6 rounded-full bg-bolt-elements-button-primary-background flex items-center justify-center text-xs font-medium text-bolt-elements-button-primary-text flex-shrink-0">
                    {user.avatar ? (
                      <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      getInitials(user.name)
                    )}
                  </div>

                  {/* User Info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-bolt-elements-textPrimary truncate">{user.name}</div>
                    <div className="text-sm text-bolt-elements-textSecondary truncate">@{user.username}</div>
                  </div>

                  {currentUserData?.id === user.id && (
                    <span className="text-xs text-bolt-elements-textSecondary bg-bolt-elements-background-depth-3 px-2 py-1 rounded">
                      You
                    </span>
                  )}
                </button>
              ))}

              {users.length === 0 && (
                <div className="p-3 text-center text-bolt-elements-textSecondary">No users available</div>
              )}
            </>
          )}
        </div>
      )}

      {/* Click outside to close */}
      {isOpen && <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />}
    </div>
  );
}
