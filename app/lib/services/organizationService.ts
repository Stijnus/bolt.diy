import type {
  Organization,
  OrganizationMember,
  OrganizationRole,
  OrganizationPermission,
  OrganizationSettings,
  OrganizationSubscription,
} from '~/components/projects/types';
import { openDatabase } from '~/lib/persistence/db';
import { generateId, generateUniqueSlug } from '~/utils/id';
import { UserService } from './userService';
import { TeamService } from './teamService';

export class OrganizationService {
  /**
   * Create a new organization
   */
  static async createOrganization(name: string, ownerId: string, description?: string): Promise<Organization> {
    const db = await openDatabase();

    if (!db) {
      throw new Error('Database not available');
    }

    // Generate unique slug
    const existingSlugs = await this._getAllSlugs();
    const slug = generateUniqueSlug(name, existingSlugs);

    const organization: Organization = {
      id: generateId(),
      name,
      slug,
      description,
      ownerId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      settings: this._getDefaultSettings(),
      subscription: this._getDefaultSubscription(),
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['organizations', 'organization_members'], 'readwrite');
      const orgsStore = transaction.objectStore('organizations');
      const membersStore = transaction.objectStore('organization_members');

      // Create organization
      orgsStore.put(organization);

      // Add owner as organization member
      const ownerMember: OrganizationMember = {
        id: generateId(),
        userId: ownerId,
        organizationId: organization.id,
        role: 'owner',
        status: 'active',
        joinedAt: new Date().toISOString(),
        permissions: this._getAllPermissions(),
      };

      membersStore.put(ownerMember);

      transaction.oncomplete = () => resolve(organization);
      transaction.onerror = () => reject(new Error('Failed to create organization'));
    });
  }

  /**
   * Get organization by ID
   */
  static async getOrganization(organizationId: string): Promise<Organization | null> {
    const db = await openDatabase();

    if (!db) {
      return null;
    }

    return new Promise((resolve) => {
      const transaction = db.transaction('organizations', 'readonly');
      const store = transaction.objectStore('organizations');
      const request = store.get(organizationId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  }

  /**
   * Get organization by slug
   */
  static async getOrganizationBySlug(slug: string): Promise<Organization | null> {
    const db = await openDatabase();

    if (!db) {
      return null;
    }

    return new Promise((resolve) => {
      const transaction = db.transaction('organizations', 'readonly');
      const store = transaction.objectStore('organizations');
      const index = store.index('slug');
      const request = index.get(slug);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  }

  /**
   * List organizations for a user
   */
  static async listOrganizations(userId?: string): Promise<Organization[]> {
    const db = await openDatabase();

    if (!db) {
      return [];
    }

    if (userId) {
      // Get organizations where user is a member
      return new Promise((resolve) => {
        const transaction = db.transaction(['organizations', 'organization_members'], 'readonly');
        const membersStore = transaction.objectStore('organization_members');

        const membersIndex = membersStore.index('userId');
        const membersRequest = membersIndex.getAll(userId);

        membersRequest.onsuccess = async () => {
          const memberships = membersRequest.result.filter((m: any) => m.status === 'active');
          const orgIds = memberships.map((m: any) => m.organizationId);

          const organizations: Organization[] = [];

          for (const orgId of orgIds) {
            const org = await this.getOrganization(orgId);

            if (org) {
              organizations.push(org);
            }
          }

          resolve(organizations);
        };

        membersRequest.onerror = () => resolve([]);
      });
    } else {
      // Get all organizations
      return new Promise((resolve) => {
        const transaction = db.transaction('organizations', 'readonly');
        const store = transaction.objectStore('organizations');
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
      });
    }
  }

  /**
   * Update organization
   */
  static async updateOrganization(
    organizationId: string,
    updates: Partial<Organization>,
  ): Promise<Organization | null> {
    const db = await openDatabase();

    if (!db) {
      return null;
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('organizations', 'readwrite');
      const store = transaction.objectStore('organizations');

      const getRequest = store.get(organizationId);

      getRequest.onsuccess = () => {
        const org = getRequest.result;

        if (!org) {
          reject(new Error('Organization not found'));
          return;
        }

        const updatedOrg = {
          ...org,
          ...updates,
          id: organizationId, // Ensure ID doesn't change
          updatedAt: new Date().toISOString(),
        };

        const putRequest = store.put(updatedOrg);

        putRequest.onsuccess = () => resolve(updatedOrg);
        putRequest.onerror = () => reject(new Error('Failed to update organization'));
      };

      getRequest.onerror = () => reject(new Error('Failed to find organization'));
    });
  }

  /**
   * Delete organization
   */
  static async deleteOrganization(organizationId: string): Promise<void> {
    const db = await openDatabase();

    if (!db) {
      throw new Error('Database not available');
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['organizations', 'organization_members', 'teams'], 'readwrite');
      const orgsStore = transaction.objectStore('organizations');
      const membersStore = transaction.objectStore('organization_members');
      const teamsStore = transaction.objectStore('teams');

      // Delete organization
      orgsStore.delete(organizationId);

      // Delete all organization members
      const membersIndex = membersStore.index('organizationId');
      const membersRequest = membersIndex.getAll(organizationId);

      membersRequest.onsuccess = () => {
        const members = membersRequest.result;
        members.forEach((member: any) => {
          membersStore.delete(member.id);
        });
      };

      // Delete all teams in organization
      const teamsRequest = teamsStore.getAll();

      teamsRequest.onsuccess = () => {
        const teams = teamsRequest.result.filter((team: any) => team.organizationId === organizationId);

        teams.forEach(async (team: any) => {
          await TeamService.deleteTeam(team.id);
        });
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error('Failed to delete organization'));
    });
  }

  /**
   * Add member to organization
   */
  static async addMember(
    organizationId: string,
    email: string,
    role: OrganizationRole,
    permissions?: OrganizationPermission[],
  ): Promise<OrganizationMember> {
    const db = await openDatabase();

    if (!db) {
      throw new Error('Database not available');
    }

    // Check if user exists
    const user = await UserService.getUserByEmail(email);

    if (!user) {
      throw new Error('User not found');
    }

    // Check if user is already a member
    const existingMember = await this.getOrganizationMember(organizationId, user.id);

    if (existingMember) {
      throw new Error('User is already an organization member');
    }

    const member: OrganizationMember = {
      id: generateId(),
      userId: user.id,
      organizationId,
      role,
      status: 'active',
      joinedAt: new Date().toISOString(),
      permissions: permissions || this._getDefaultPermissions(role),
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('organization_members', 'readwrite');
      const store = transaction.objectStore('organization_members');
      const request = store.put(member);

      request.onsuccess = () => resolve(member);
      request.onerror = () => reject(new Error('Failed to add organization member'));
    });
  }

  /**
   * Remove member from organization
   */
  static async removeMember(organizationId: string, userId: string): Promise<void> {
    const db = await openDatabase();

    if (!db) {
      throw new Error('Database not available');
    }

    const member = await this.getOrganizationMember(organizationId, userId);

    if (!member) {
      throw new Error('Organization member not found');
    }

    // Prevent removing the owner
    if (member.role === 'owner') {
      throw new Error('Cannot remove organization owner');
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('organization_members', 'readwrite');
      const store = transaction.objectStore('organization_members');
      const request = store.delete(member.id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to remove organization member'));
    });
  }

  /**
   * Update member role
   */
  static async updateMemberRole(organizationId: string, userId: string, role: OrganizationRole): Promise<void> {
    await this._updateOrganizationMember(organizationId, userId, {
      role,
      permissions: this._getDefaultPermissions(role),
    });
  }

  /**
   * Update member permissions
   */
  static async updateMemberPermissions(
    organizationId: string,
    userId: string,
    permissions: OrganizationPermission[],
  ): Promise<void> {
    await this._updateOrganizationMember(organizationId, userId, { permissions });
  }

  /**
   * Get organization member
   */
  static async getOrganizationMember(organizationId: string, userId: string): Promise<OrganizationMember | null> {
    const db = await openDatabase();

    if (!db) {
      return null;
    }

    return new Promise((resolve) => {
      const transaction = db.transaction('organization_members', 'readonly');
      const store = transaction.objectStore('organization_members');
      const index = store.index('organizationId');
      const request = index.getAll(organizationId);

      request.onsuccess = () => {
        const members = request.result;
        const member = members.find((m: any) => m.userId === userId);
        resolve(member || null);
      };

      request.onerror = () => resolve(null);
    });
  }

  /**
   * List organization members
   */
  static async getOrganizationMembers(organizationId: string): Promise<OrganizationMember[]> {
    const db = await openDatabase();

    if (!db) {
      return [];
    }

    return new Promise((resolve) => {
      const transaction = db.transaction('organization_members', 'readonly');
      const store = transaction.objectStore('organization_members');
      const index = store.index('organizationId');
      const request = index.getAll(organizationId);

      request.onsuccess = () => {
        const members = request.result.filter((m: any) => m.status === 'active');
        resolve(members);
      };

      request.onerror = () => resolve([]);
    });
  }

  /**
   * Update organization settings
   */
  static async updateSettings(organizationId: string, settings: Partial<OrganizationSettings>): Promise<void> {
    const org = await this.getOrganization(organizationId);

    if (!org) {
      throw new Error('Organization not found');
    }

    const updatedSettings = {
      ...org.settings,
      ...settings,
    };

    await this.updateOrganization(organizationId, { settings: updatedSettings });
  }

  /**
   * Update organization subscription
   */
  static async updateSubscription(
    organizationId: string,
    subscription: Partial<OrganizationSubscription>,
  ): Promise<void> {
    const org = await this.getOrganization(organizationId);

    if (!org) {
      throw new Error('Organization not found');
    }

    const updatedSubscription = {
      plan: 'free' as const,
      status: 'active' as const,
      currentPeriodEnd: new Date().toISOString(),
      maxUsers: 5,
      maxProjects: 10,
      ...org.subscription,
      ...subscription,
    };

    await this.updateOrganization(organizationId, { subscription: updatedSubscription });
  }

  /**
   * Check if slug is available
   */
  static async isSlugAvailable(slug: string, excludeOrgId?: string): Promise<boolean> {
    const org = await this.getOrganizationBySlug(slug);

    if (!org) {
      return true;
    }

    if (excludeOrgId && org.id === excludeOrgId) {
      return true;
    }

    return false;
  }

  /**
   * Get organization statistics
   */
  static async getOrganizationStats(organizationId: string): Promise<{
    totalMembers: number;
    totalTeams: number;
    totalProjects: number;
    activeUsers: number;
  }> {
    const db = await openDatabase();

    if (!db) {
      return { totalMembers: 0, totalTeams: 0, totalProjects: 0, activeUsers: 0 };
    }

    return new Promise((resolve) => {
      const transaction = db.transaction(['organization_members', 'teams', 'projects'], 'readonly');

      let totalMembers = 0;
      let totalTeams = 0;
      let totalProjects = 0;
      let activeUsers = 0;

      // Count members
      const membersStore = transaction.objectStore('organization_members');
      const membersIndex = membersStore.index('organizationId');
      const membersRequest = membersIndex.getAll(organizationId);

      membersRequest.onsuccess = () => {
        const members = membersRequest.result.filter((m: any) => m.status === 'active');
        totalMembers = members.length;

        // For now, consider all members as active users
        activeUsers = totalMembers;
      };

      // Count teams
      const teamsStore = transaction.objectStore('teams');
      const teamsRequest = teamsStore.getAll();

      teamsRequest.onsuccess = () => {
        const teams = teamsRequest.result.filter((team: any) => team.organizationId === organizationId);
        totalTeams = teams.length;
      };

      // Count projects
      const projectsStore = transaction.objectStore('projects');
      const projectsRequest = projectsStore.getAll();

      projectsRequest.onsuccess = () => {
        const projects = projectsRequest.result.filter((_project: any) => {
          /*
           * For now, we'll need to implement organization-project relationship
           * This is a placeholder
           */
          return false;
        });
        totalProjects = projects.length;
      };

      transaction.oncomplete = () => {
        resolve({ totalMembers, totalTeams, totalProjects, activeUsers });
      };

      transaction.onerror = () => {
        resolve({ totalMembers: 0, totalTeams: 0, totalProjects: 0, activeUsers: 0 });
      };
    });
  }

  // Private helper methods

  private static async _updateOrganizationMember(
    organizationId: string,
    userId: string,
    updates: Partial<OrganizationMember>,
  ): Promise<OrganizationMember | null> {
    const db = await openDatabase();

    if (!db) {
      return null;
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('organization_members', 'readwrite');
      const store = transaction.objectStore('organization_members');
      const index = store.index('organizationId');
      const request = index.getAll(organizationId);

      request.onsuccess = () => {
        const members = request.result;
        const member = members.find((m: any) => m.userId === userId);

        if (!member) {
          reject(new Error('Organization member not found'));
          return;
        }

        const updatedMember = { ...member, ...updates };
        const putRequest = store.put(updatedMember);

        putRequest.onsuccess = () => resolve(updatedMember);
        putRequest.onerror = () => reject(new Error('Failed to update organization member'));
      };

      request.onerror = () => reject(new Error('Failed to find organization member'));
    });
  }

  private static async _getAllSlugs(): Promise<string[]> {
    const db = await openDatabase();

    if (!db) {
      return [];
    }

    return new Promise((resolve) => {
      const transaction = db.transaction('organizations', 'readonly');
      const store = transaction.objectStore('organizations');
      const request = store.getAll();

      request.onsuccess = () => {
        const organizations = request.result;
        const slugs = organizations.map((org: any) => org.slug);
        resolve(slugs);
      };

      request.onerror = () => resolve([]);
    });
  }

  private static _getDefaultSettings(): OrganizationSettings {
    return {
      allowPublicProjects: true,
      defaultProjectVisibility: 'private',
      requireTwoFactor: false,
      allowedDomains: [],
      maxTeamSize: 50,
      enableSSO: false,
    };
  }

  private static _getDefaultSubscription(): OrganizationSubscription {
    return {
      plan: 'free',
      status: 'active',
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      maxUsers: 5,
      maxProjects: 10,
    };
  }

  private static _getAllPermissions(): OrganizationPermission[] {
    return [
      'manage_organization',
      'manage_teams',
      'manage_projects',
      'manage_billing',
      'invite_members',
      'view_analytics',
    ];
  }

  private static _getDefaultPermissions(role: OrganizationRole): OrganizationPermission[] {
    switch (role) {
      case 'owner':
        return this._getAllPermissions();
      case 'admin':
        return ['manage_teams', 'manage_projects', 'invite_members', 'view_analytics'];
      case 'member':
        return ['view_analytics'];
      default:
        return [];
    }
  }
}
