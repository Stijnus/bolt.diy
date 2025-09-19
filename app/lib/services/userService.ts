import type { User, UserPreferences } from '~/components/projects/types';
import { openDatabase } from '~/lib/persistence/db';

export class UserService {
  /**
   * Get user by ID
   */
  static async getUserById(userId: string): Promise<User | null> {
    const db = await openDatabase();

    if (!db) {
      return null;
    }

    return new Promise((resolve) => {
      const transaction = db.transaction('users', 'readonly');
      const store = transaction.objectStore('users');
      const request = store.get(userId);

      request.onsuccess = () => {
        const result = request.result;

        if (result) {
          const { passwordHash, ...user } = result;
          resolve(user as User);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => resolve(null);
    });
  }

  /**
   * Get user by email
   */
  static async getUserByEmail(email: string): Promise<User | null> {
    const db = await openDatabase();

    if (!db) {
      return null;
    }

    return new Promise((resolve) => {
      const transaction = db.transaction('users', 'readonly');
      const store = transaction.objectStore('users');
      const index = store.index('email');
      const request = index.get(email);

      request.onsuccess = () => {
        const result = request.result;

        if (result) {
          const { passwordHash, ...user } = result;
          resolve(user as User);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => resolve(null);
    });
  }

  /**
   * Get user by username
   */
  static async getUserByUsername(username: string): Promise<User | null> {
    const db = await openDatabase();

    if (!db) {
      return null;
    }

    return new Promise((resolve) => {
      const transaction = db.transaction('users', 'readonly');
      const store = transaction.objectStore('users');
      const index = store.index('username');
      const request = index.get(username);

      request.onsuccess = () => {
        const result = request.result;

        if (result) {
          const { passwordHash, ...user } = result;
          resolve(user as User);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => resolve(null);
    });
  }

  /**
   * Get all users (admin function)
   */
  static async getAllUsers(): Promise<User[]> {
    const db = await openDatabase();

    if (!db) {
      return [];
    }

    return new Promise((resolve) => {
      const transaction = db.transaction('users', 'readonly');
      const store = transaction.objectStore('users');
      const request = store.getAll();

      request.onsuccess = () => {
        const users = request.result.map((user: any) => {
          const { passwordHash, ...userWithoutPassword } = user;
          return userWithoutPassword as User;
        });
        resolve(users);
      };

      request.onerror = () => resolve([]);
    });
  }

  /**
   * Search users by name or username
   */
  static async searchUsers(query: string, limit: number = 10): Promise<User[]> {
    const db = await openDatabase();

    if (!db) {
      return [];
    }

    return new Promise((resolve) => {
      const transaction = db.transaction('users', 'readonly');
      const store = transaction.objectStore('users');
      const request = store.getAll();

      request.onsuccess = () => {
        const allUsers = request.result.map((user: any) => {
          const { passwordHash, ...userWithoutPassword } = user;
          return userWithoutPassword as User;
        });

        const filteredUsers = allUsers
          .filter(
            (user) =>
              user.isActive &&
              (user.name.toLowerCase().includes(query.toLowerCase()) ||
                user.username.toLowerCase().includes(query.toLowerCase()) ||
                user.email.toLowerCase().includes(query.toLowerCase())),
          )
          .slice(0, limit);

        resolve(filteredUsers);
      };

      request.onerror = () => resolve([]);
    });
  }

  /**
   * Update user profile
   */
  static async updateUser(userId: string, updates: Partial<User>): Promise<User | null> {
    const db = await openDatabase();

    if (!db) {
      return null;
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('users', 'readwrite');
      const store = transaction.objectStore('users');

      // First get the current user data
      const getRequest = store.get(userId);

      getRequest.onsuccess = () => {
        const currentUser = getRequest.result;

        if (!currentUser) {
          reject(new Error('User not found'));
          return;
        }

        // Merge updates with current data
        const updatedUser = {
          ...currentUser,
          ...updates,
          id: userId, // Ensure ID doesn't change
        };

        // Save updated user
        const putRequest = store.put(updatedUser);

        putRequest.onsuccess = () => {
          const { passwordHash, ...user } = updatedUser;
          resolve(user as User);
        };

        putRequest.onerror = () => reject(new Error('Failed to update user'));
      };

      getRequest.onerror = () => reject(new Error('Failed to find user'));
    });
  }

  /**
   * Update user preferences
   */
  static async updateUserPreferences(userId: string, preferences: Partial<UserPreferences>): Promise<void> {
    const user = await this.getUserById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    const updatedPreferences = {
      ...user.preferences,
      ...preferences,
    };

    await this.updateUser(userId, { preferences: updatedPreferences });
  }

  /**
   * Deactivate user account
   */
  static async deactivateUser(userId: string): Promise<void> {
    await this.updateUser(userId, { isActive: false });
  }

  /**
   * Reactivate user account
   */
  static async reactivateUser(userId: string): Promise<void> {
    await this.updateUser(userId, { isActive: true });
  }

  /**
   * Get users by organization
   */
  static async getUsersByOrganization(organizationId: string): Promise<User[]> {
    const db = await openDatabase();

    if (!db) {
      return [];
    }

    return new Promise((resolve) => {
      const transaction = db.transaction(['users', 'organization_members'], 'readonly');
      const orgMembersStore = transaction.objectStore('organization_members');
      const usersStore = transaction.objectStore('users');

      // Get all organization members
      const orgMembersIndex = orgMembersStore.index('organizationId');
      const orgMembersRequest = orgMembersIndex.getAll(organizationId);

      orgMembersRequest.onsuccess = async () => {
        const orgMembers = orgMembersRequest.result;
        const userIds = orgMembers.map((member: any) => member.userId);

        const users: User[] = [];
        let completed = 0;

        if (userIds.length === 0) {
          resolve([]);
          return;
        }

        // Get each user
        userIds.forEach((userId: string) => {
          const userRequest = usersStore.get(userId);

          userRequest.onsuccess = () => {
            completed++;

            if (userRequest.result) {
              const { passwordHash, ...user } = userRequest.result;
              users.push(user as User);
            }

            if (completed === userIds.length) {
              resolve(users.filter((user) => user.isActive));
            }
          };

          userRequest.onerror = () => {
            completed++;

            if (completed === userIds.length) {
              resolve(users.filter((user) => user.isActive));
            }
          };
        });
      };

      orgMembersRequest.onerror = () => resolve([]);
    });
  }

  /**
   * Get users by team
   */
  static async getUsersByTeam(teamId: string): Promise<User[]> {
    const db = await openDatabase();

    if (!db) {
      return [];
    }

    return new Promise((resolve) => {
      const transaction = db.transaction(['users', 'team_members'], 'readonly');
      const teamMembersStore = transaction.objectStore('team_members');
      const usersStore = transaction.objectStore('users');

      // Get all team members
      const teamMembersIndex = teamMembersStore.index('teamId');
      const teamMembersRequest = teamMembersIndex.getAll(teamId);

      teamMembersRequest.onsuccess = async () => {
        const teamMembers = teamMembersRequest.result;
        const userIds = teamMembers
          .filter((member: any) => member.status === 'active')
          .map((member: any) => member.userId);

        const users: User[] = [];
        let completed = 0;

        if (userIds.length === 0) {
          resolve([]);
          return;
        }

        // Get each user
        userIds.forEach((userId: string) => {
          const userRequest = usersStore.get(userId);

          userRequest.onsuccess = () => {
            completed++;

            if (userRequest.result) {
              const { passwordHash, ...user } = userRequest.result;
              users.push(user as User);
            }

            if (completed === userIds.length) {
              resolve(users.filter((user) => user.isActive));
            }
          };

          userRequest.onerror = () => {
            completed++;

            if (completed === userIds.length) {
              resolve(users.filter((user) => user.isActive));
            }
          };
        });
      };

      teamMembersRequest.onerror = () => resolve([]);
    });
  }

  /**
   * Check if username is available
   */
  static async isUsernameAvailable(username: string, excludeUserId?: string): Promise<boolean> {
    const user = await this.getUserByUsername(username);

    if (!user) {
      return true;
    }

    if (excludeUserId && user.id === excludeUserId) {
      return true;
    }

    return false;
  }

  /**
   * Check if email is available
   */
  static async isEmailAvailable(email: string, excludeUserId?: string): Promise<boolean> {
    const user = await this.getUserByEmail(email);

    if (!user) {
      return true;
    }

    if (excludeUserId && user.id === excludeUserId) {
      return true;
    }

    return false;
  }

  /**
   * Get user activity statistics
   */
  static async getUserStats(userId: string): Promise<{
    totalProjects: number;
    totalFeatures: number;
    completedFeatures: number;
    activeTeams: number;
    lastActivity: string | null;
  }> {
    const db = await openDatabase();

    if (!db) {
      return {
        totalProjects: 0,
        totalFeatures: 0,
        completedFeatures: 0,
        activeTeams: 0,
        lastActivity: null,
      };
    }

    return new Promise((resolve) => {
      const transaction = db.transaction(['projects', 'features', 'team_members'], 'readonly');

      let totalProjects = 0;
      let totalFeatures = 0;
      let completedFeatures = 0;
      let activeTeams = 0;
      let lastActivity: string | null = null;

      // Count projects where user is owner or collaborator
      const projectsStore = transaction.objectStore('projects');
      const projectsRequest = projectsStore.getAll();

      projectsRequest.onsuccess = () => {
        const projects = projectsRequest.result;
        totalProjects = projects.filter(
          (project: any) =>
            project.ownerId === userId || (project.collaborators && project.collaborators.includes(userId)),
        ).length;

        // Get most recent project activity
        const userProjects = projects.filter(
          (project: any) =>
            project.ownerId === userId || (project.collaborators && project.collaborators.includes(userId)),
        );

        if (userProjects.length > 0) {
          lastActivity =
            userProjects
              .map((p: any) => p.lastUpdated)
              .filter(Boolean)
              .sort()
              .pop() || null;
        }
      };

      // Count features assigned to user
      const featuresStore = transaction.objectStore('features');
      const featuresIndex = featuresStore.index('assignee');
      const featuresRequest = featuresIndex.getAll(userId);

      featuresRequest.onsuccess = () => {
        const features = featuresRequest.result;
        totalFeatures = features.length;
        completedFeatures = features.filter((feature: any) => feature.status === 'completed').length;
      };

      // Count active teams
      const teamMembersStore = transaction.objectStore('team_members');
      const teamMembersIndex = teamMembersStore.index('userId');
      const teamMembersRequest = teamMembersIndex.getAll(userId);

      teamMembersRequest.onsuccess = () => {
        const memberships = teamMembersRequest.result;
        activeTeams = memberships.filter((membership: any) => membership.status === 'active').length;
      };

      transaction.oncomplete = () => {
        resolve({
          totalProjects,
          totalFeatures,
          completedFeatures,
          activeTeams,
          lastActivity,
        });
      };

      transaction.onerror = () => {
        resolve({
          totalProjects: 0,
          totalFeatures: 0,
          completedFeatures: 0,
          activeTeams: 0,
          lastActivity: null,
        });
      };
    });
  }
}
