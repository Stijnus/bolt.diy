import type {
  Team,
  TeamMember,
  TeamPermission,
  TeamRole,
  NewTeamMember,
  TeamSettings,
  TeamActivity,
  TeamActivityType,
} from '~/components/projects/types';
import { openDatabase } from '~/lib/persistence/db';
import { generateId } from '~/utils/id';
import { UserService } from './userService';

export class TeamService {
  /**
   * Create a new team
   */
  static async createTeam(name: string, description: string, ownerId: string, organizationId?: string): Promise<Team> {
    const db = await openDatabase();

    if (!db) {
      throw new Error('Database not available');
    }

    const ownerUser = await UserService.getUserById(ownerId);

    if (!ownerUser) {
      throw new Error('Team owner not found');
    }

    const now = new Date().toISOString();
    const normalizedDescription = description?.trim() || undefined;

    const team: Team = {
      id: generateId(),
      name,
      description: normalizedDescription,
      ownerId,
      organizationId,
      members: [],
      createdAt: now,
      updatedAt: now,
      projects: [],
      settings: this._getDefaultSettings(),
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['teams', 'team_members'], 'readwrite');
      const teamsStore = transaction.objectStore('teams');
      const membersStore = transaction.objectStore('team_members');

      // Create team
      teamsStore.put(team);

      // Add owner as team member
      const ownerMember = {
        id: generateId(),
        userId: ownerId,
        teamId: team.id,
        role: 'owner' as TeamRole,
        status: 'active' as const,
        joinedAt: now,
        permissions: [],
        email: ownerUser.email,
        name: ownerUser.name,
        avatar: ownerUser.avatar,
        lastActive: ownerUser.lastLoginAt,
        projects: [] as string[],
      };

      membersStore.put(ownerMember);

      transaction.oncomplete = async () => {
        await this._logActivity(team.id, ownerId, 'team_created', { teamName: name });

        try {
          const createdTeam = await this.getTeam(team.id);

          if (createdTeam) {
            resolve(createdTeam);
            return;
          }
        } catch (error) {
          console.error('Failed to load newly created team:', error);
        }

        resolve({
          ...team,
          members: [
            {
              ...ownerMember,
            },
          ],
        });
      };

      transaction.onerror = () => reject(new Error('Failed to create team'));
    });
  }

  /**
   * Get team by ID
   */
  static async getTeam(teamId: string): Promise<Team | null> {
    const db = await openDatabase();

    if (!db) {
      return null;
    }

    return new Promise((resolve) => {
      const transaction = db.transaction(['teams', 'team_members'], 'readonly');
      const teamsStore = transaction.objectStore('teams');
      const membersStore = transaction.objectStore('team_members');

      const teamRequest = teamsStore.get(teamId);

      teamRequest.onsuccess = () => {
        const team = teamRequest.result;

        if (!team) {
          resolve(null);
          return;
        }

        // Get team members
        const membersIndex = membersStore.index('teamId');
        const membersRequest = membersIndex.getAll(teamId);

        membersRequest.onsuccess = async () => {
          const members = membersRequest.result;

          // Populate member details
          const populatedMembers: TeamMember[] = [];

          for (const member of members) {
            const user = await UserService.getUserById(member.userId);

            if (user) {
              populatedMembers.push({
                ...member,
                email: user.email,
                name: user.name,
                avatar: user.avatar,
                lastActive: user.lastLoginAt,
                projects: [], // TODO: Get user's projects in this team
              });
            }
          }

          resolve({
            ...team,
            members: populatedMembers,
          });
        };

        membersRequest.onerror = () => resolve(team);
      };

      teamRequest.onerror = () => resolve(null);
    });
  }

  /**
   * List teams for a user
   */
  static async listTeams(userId?: string, organizationId?: string): Promise<Team[]> {
    const db = await openDatabase();

    if (!db) {
      return [];
    }

    return new Promise((resolve) => {
      const transaction = db.transaction(['teams', 'team_members'], 'readonly');
      const teamsStore = transaction.objectStore('teams');
      const membersStore = transaction.objectStore('team_members');

      if (userId) {
        // Get teams where user is a member
        const membersIndex = membersStore.index('userId');
        const membersRequest = membersIndex.getAll(userId);

        membersRequest.onsuccess = async () => {
          const memberships = membersRequest.result.filter((m: any) => m.status === 'active');
          const teamIds = memberships.map((m: any) => m.teamId);

          const teams: Team[] = [];

          for (const teamId of teamIds) {
            const team = await this.getTeam(teamId);

            if (team && (!organizationId || team.organizationId === organizationId)) {
              teams.push(team);
            }
          }

          resolve(teams);
        };

        membersRequest.onerror = () => resolve([]);
      } else {
        // Get all teams
        const teamsRequest = teamsStore.getAll();

        teamsRequest.onsuccess = async () => {
          const allTeams = teamsRequest.result;
          const filteredTeams = organizationId
            ? allTeams.filter((team: any) => team.organizationId === organizationId)
            : allTeams;

          const teams: Team[] = [];

          for (const team of filteredTeams) {
            const fullTeam = await this.getTeam(team.id);

            if (fullTeam) {
              teams.push(fullTeam);
            }
          }

          resolve(teams);
        };

        teamsRequest.onerror = () => resolve([]);
      }
    });
  }

  /**
   * Update team
   */
  static async updateTeam(teamId: string, updates: Partial<Team>): Promise<Team | null> {
    const db = await openDatabase();

    if (!db) {
      return null;
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('teams', 'readwrite');
      const store = transaction.objectStore('teams');

      const getRequest = store.get(teamId);

      getRequest.onsuccess = () => {
        const team = getRequest.result;

        if (!team) {
          reject(new Error('Team not found'));
          return;
        }

        const updatedTeam = {
          ...team,
          ...updates,
          id: teamId, // Ensure ID doesn't change
          updatedAt: new Date().toISOString(),
        };

        const putRequest = store.put(updatedTeam);

        putRequest.onsuccess = async () => {
          const fullTeam = await this.getTeam(teamId);
          resolve(fullTeam);
        };

        putRequest.onerror = () => reject(new Error('Failed to update team'));
      };

      getRequest.onerror = () => reject(new Error('Failed to find team'));
    });
  }

  /**
   * Delete team
   */
  static async deleteTeam(teamId: string): Promise<void> {
    const db = await openDatabase();

    if (!db) {
      throw new Error('Database not available');
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['teams', 'team_members', 'team_invitations'], 'readwrite');
      const teamsStore = transaction.objectStore('teams');
      const membersStore = transaction.objectStore('team_members');
      const invitationsStore = transaction.objectStore('team_invitations');

      // Delete team
      teamsStore.delete(teamId);

      // Delete all team members
      const membersIndex = membersStore.index('teamId');
      const membersRequest = membersIndex.getAll(teamId);

      membersRequest.onsuccess = () => {
        const members = membersRequest.result;
        members.forEach((member: any) => {
          membersStore.delete(member.id);
        });
      };

      // Delete all team invitations
      const invitationsIndex = invitationsStore.index('teamId');
      const invitationsRequest = invitationsIndex.getAll(teamId);

      invitationsRequest.onsuccess = () => {
        const invitations = invitationsRequest.result;
        invitations.forEach((invitation: any) => {
          invitationsStore.delete(invitation.id);
        });
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error('Failed to delete team'));
    });
  }

  /**
   * Add member to team
   */
  static async addMember(teamId: string, newMember: NewTeamMember): Promise<TeamMember> {
    const db = await openDatabase();

    if (!db) {
      throw new Error('Database not available');
    }

    // Check if user exists
    const user = await UserService.getUserByEmail(newMember.email);

    if (!user) {
      throw new Error('User not found');
    }

    // Check if user is already a member
    const existingMember = await this.getTeamMember(teamId, user.id);

    if (existingMember) {
      throw new Error('User is already a team member');
    }

    const member = {
      id: generateId(),
      userId: user.id,
      teamId,
      role: newMember.role,
      status: 'active' as const,
      joinedAt: new Date().toISOString(),
      permissions: newMember.permissions || [],
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      lastActive: user.lastLoginAt,
      projects: [],
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('team_members', 'readwrite');
      const store = transaction.objectStore('team_members');
      const request = store.put(member);

      request.onsuccess = () => {
        this._logActivity(teamId, user.id, 'member_joined', { memberName: user.name });
        resolve(member);
      };

      request.onerror = () => reject(new Error('Failed to add team member'));
    });
  }

  /**
   * Remove member from team
   */
  static async removeMember(teamId: string, userId: string): Promise<void> {
    const db = await openDatabase();

    if (!db) {
      throw new Error('Database not available');
    }

    const member = await this.getTeamMember(teamId, userId);

    if (!member) {
      throw new Error('Team member not found');
    }

    // Prevent removing the owner
    if (member.role === 'owner') {
      throw new Error('Cannot remove team owner');
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('team_members', 'readwrite');
      const store = transaction.objectStore('team_members');
      const request = store.delete(member.id);

      request.onsuccess = () => {
        this._logActivity(teamId, userId, 'member_left', { memberName: member.name ?? 'Member' });
        resolve();
      };

      request.onerror = () => reject(new Error('Failed to remove team member'));
    });
  }

  /**
   * Update member role
   */
  static async setRole(teamId: string, userId: string, role: TeamRole): Promise<void> {
    const member = await this.getTeamMember(teamId, userId);

    if (!member) {
      throw new Error('Team member not found');
    }

    await this.updateTeamMember(teamId, userId, { role });
    this._logActivity(teamId, userId, 'member_role_changed', { newRole: role });
  }

  /**
   * Update member permissions
   */
  static async setPermissions(teamId: string, userId: string, permissions: TeamPermission[]): Promise<void> {
    await this.updateTeamMember(teamId, userId, { permissions });
  }

  /**
   * Get team member
   */
  static async getTeamMember(teamId: string, userId: string): Promise<TeamMember | null> {
    const db = await openDatabase();

    if (!db) {
      return null;
    }

    return new Promise((resolve) => {
      const transaction = db.transaction('team_members', 'readonly');
      const store = transaction.objectStore('team_members');
      const index = store.index('teamId');
      const request = index.getAll(teamId);

      request.onsuccess = () => {
        const members = request.result;
        const member = members.find((m: any) => m.userId === userId);
        resolve(member || null);
      };

      request.onerror = () => resolve(null);
    });
  }

  /**
   * Update team member
   */
  static async updateTeamMember(
    teamId: string,
    userId: string,
    updates: Partial<TeamMember>,
  ): Promise<TeamMember | null> {
    const db = await openDatabase();

    if (!db) {
      return null;
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('team_members', 'readwrite');
      const store = transaction.objectStore('team_members');
      const index = store.index('teamId');
      const request = index.getAll(teamId);

      request.onsuccess = () => {
        const members = request.result;
        const member = members.find((m: any) => m.userId === userId);

        if (!member) {
          reject(new Error('Team member not found'));
          return;
        }

        const updatedMember = { ...member, ...updates };
        const putRequest = store.put(updatedMember);

        putRequest.onsuccess = () => resolve(updatedMember);
        putRequest.onerror = () => reject(new Error('Failed to update team member'));
      };

      request.onerror = () => reject(new Error('Failed to find team member'));
    });
  }

  /**
   * Update team settings
   */
  static async updateSettings(teamId: string, settings: Partial<TeamSettings>): Promise<void> {
    const team = await this.getTeam(teamId);

    if (!team) {
      throw new Error('Team not found');
    }

    const updatedSettings = {
      ...team.settings,
      ...settings,
    };

    await this.updateTeam(teamId, { settings: updatedSettings });
  }

  /**
   * Get team activity
   */
  static async getTeamActivity(teamId: string, limit: number = 50): Promise<TeamActivity[]> {
    const db = await openDatabase();

    if (!db) {
      return [];
    }

    return new Promise((resolve) => {
      const transaction = db.transaction('activities', 'readonly');
      const store = transaction.objectStore('activities');
      const request = store.getAll();

      request.onsuccess = () => {
        const activities = request.result
          .filter((activity: any) => activity.scopeType === 'team' && activity.scopeId === teamId)
          .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, limit);

        resolve(activities);
      };

      request.onerror = () => resolve([]);
    });
  }

  // Private helper methods

  private static async _logActivity(
    teamId: string,
    userId: string,
    action: TeamActivityType,
    details: Record<string, any>,
  ): Promise<void> {
    const db = await openDatabase();

    if (!db) {
      return;
    }

    const user = await UserService.getUserById(userId);

    if (!user) {
      return;
    }

    const activity = {
      id: generateId(),
      scopeType: 'team',
      scopeId: teamId,
      userId,
      userName: user.name,
      action,
      details,
      timestamp: new Date().toISOString(),
    };

    const transaction = db.transaction('activities', 'readwrite');
    const store = transaction.objectStore('activities');
    store.put(activity);
  }

  private static _getDefaultSettings(): TeamSettings {
    return {
      allowInvites: true,
      defaultRole: 'developer',
      requireApprovalForNewMembers: false,
      enableTimeTracking: true,
      enableAnalytics: true,
    };
  }
}

// Export for backward compatibility
export async function listTeams(userId?: string): Promise<Team[]> {
  return TeamService.listTeams(userId);
}

export async function getTeam(id: string): Promise<Team | undefined> {
  const team = await TeamService.getTeam(id);
  return team || undefined;
}

export async function addMember(teamId: string, member: NewTeamMember): Promise<void> {
  await TeamService.addMember(teamId, member);
}

export async function setRole(teamId: string, userId: string, role: TeamRole): Promise<void> {
  await TeamService.setRole(teamId, userId, role);
}

export async function setPermissions(teamId: string, userId: string, permissions: TeamPermission[]): Promise<void> {
  await TeamService.setPermissions(teamId, userId, permissions);
}
