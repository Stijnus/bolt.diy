import type {
  User,
  AuthSession,
  LoginCredentials,
  RegisterCredentials,
  UserPreferences,
} from '~/components/projects/types';
import { openDatabase } from '~/lib/persistence/db';
import { generateId } from '~/utils/id';
import { createHash, verifyPassword } from '~/utils/crypto';

// In-memory session storage (in a real app, this would be server-side)
const activeSessions = new Map<string, AuthSession>();

export class AuthService {
  /**
   * Register a new user
   */
  static async register(credentials: RegisterCredentials): Promise<AuthSession> {
    const db = await openDatabase();

    if (!db) {
      throw new Error('Database not available');
    }

    const { email, password, username, name } = credentials;

    // Check if user already exists
    const existingUser = await this._findUserByEmail(email);

    if (existingUser) {
      throw new Error('User already exists with this email');
    }

    const existingUsername = await this._findUserByUsername(username);

    if (existingUsername) {
      throw new Error('Username already taken');
    }

    // Hash password
    const passwordHash = await createHash(password);

    // Create user
    const user: User = {
      id: generateId(),
      email,
      username,
      name,
      createdAt: new Date().toISOString(),
      emailVerified: false,
      isActive: true,
      preferences: this._getDefaultPreferences(),
    };

    // Store user with password hash
    const userRecord = {
      ...user,
      passwordHash,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('users', 'readwrite');
      const store = transaction.objectStore('users');
      const request = store.add(userRecord);

      request.onsuccess = async () => {
        // Create session
        const session = await this._createSession(user);
        resolve(session);
      };

      request.onerror = () => reject(new Error('Failed to create user'));
    });
  }

  /**
   * Login user
   */
  static async login(credentials: LoginCredentials): Promise<AuthSession> {
    const { email, password } = credentials;

    const userRecord = await this._findUserByEmail(email);

    if (!userRecord || !userRecord.isActive) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isValid = await verifyPassword(password, userRecord.passwordHash);

    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    // Update last login
    await this._updateUserLastLogin(userRecord.id);

    // Create session
    const { passwordHash, ...user } = userRecord;

    return this._createSession(user as User);
  }

  /**
   * Logout user
   */
  static async logout(token: string): Promise<void> {
    activeSessions.delete(token);

    // Remove from database
    const db = await openDatabase();

    if (!db) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('auth_sessions', 'readwrite');
      const store = transaction.objectStore('auth_sessions');
      const request = store.delete(token);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to logout'));
    });
  }

  /**
   * Get current session
   */
  static async getCurrentSession(): Promise<AuthSession | null> {
    // Try to get from memory first
    const tokens = Array.from(activeSessions.keys());

    for (const token of tokens) {
      const session = activeSessions.get(token);

      if (session && new Date(session.expiresAt) > new Date()) {
        return session;
      }
    }

    // Check database for valid sessions
    const db = await openDatabase();

    if (!db) {
      return null;
    }

    return new Promise((resolve) => {
      const transaction = db.transaction('auth_sessions', 'readonly');
      const store = transaction.objectStore('auth_sessions');
      const request = store.getAll();

      request.onsuccess = () => {
        const sessions = request.result as AuthSession[];
        const validSession = sessions.find((session) => new Date(session.expiresAt) > new Date());

        if (validSession) {
          activeSessions.set(validSession.token, validSession);
          resolve(validSession);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => resolve(null);
    });
  }

  /**
   * Refresh session token
   */
  static async refreshSession(refreshToken: string): Promise<AuthSession> {
    // Find session by refresh token
    const db = await openDatabase();

    if (!db) {
      throw new Error('Database not available');
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('auth_sessions', 'readonly');
      const store = transaction.objectStore('auth_sessions');
      const request = store.getAll();

      request.onsuccess = async () => {
        const sessions = request.result as AuthSession[];
        const session = sessions.find((s) => s.refreshToken === refreshToken);

        if (!session || new Date(session.expiresAt) <= new Date()) {
          reject(new Error('Invalid or expired refresh token'));
          return;
        }

        // Create new session
        const newSession = await this._createSession(session.user);
        resolve(newSession);
      };

      request.onerror = () => reject(new Error('Failed to refresh session'));
    });
  }

  /**
   * Update user profile
   */
  static async updateUser(userId: string, updates: Partial<User>): Promise<User> {
    const db = await openDatabase();

    if (!db) {
      throw new Error('Database not available');
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('users', 'readwrite');
      const store = transaction.objectStore('users');
      const getRequest = store.get(userId);

      getRequest.onsuccess = () => {
        const userRecord = getRequest.result;

        if (!userRecord) {
          reject(new Error('User not found'));
          return;
        }

        const updatedUser = { ...userRecord, ...updates };
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
   * Change password
   */
  static async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const userRecord = await this._findUserById(userId);

    if (!userRecord) {
      throw new Error('User not found');
    }

    // Verify current password
    const isValid = await verifyPassword(currentPassword, userRecord.passwordHash);

    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const newPasswordHash = await createHash(newPassword);

    // Update password
    const db = await openDatabase();

    if (!db) {
      throw new Error('Database not available');
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('users', 'readwrite');
      const store = transaction.objectStore('users');
      const request = store.put({ ...userRecord, passwordHash: newPasswordHash });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to change password'));
    });
  }

  /**
   * Delete user account
   */
  static async deleteUser(userId: string): Promise<void> {
    const db = await openDatabase();

    if (!db) {
      throw new Error('Database not available');
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['users', 'auth_sessions'], 'readwrite');
      const usersStore = transaction.objectStore('users');
      const sessionsStore = transaction.objectStore('auth_sessions');

      // Delete user
      usersStore.delete(userId);

      // Delete all user sessions
      const sessionsIndex = sessionsStore.index('userId');
      const sessionRequest = sessionsIndex.getAll(userId);

      sessionRequest.onsuccess = () => {
        const sessions = sessionRequest.result as AuthSession[];
        sessions.forEach((session) => {
          sessionsStore.delete(session.token);
          activeSessions.delete(session.token);
        });
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error('Failed to delete user'));
    });
  }

  // Private methods

  private static async _createSession(user: User): Promise<AuthSession> {
    const token = generateId();
    const refreshToken = generateId();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

    const session: AuthSession = {
      user,
      token,
      refreshToken,
      expiresAt,
    };

    // Store in memory
    activeSessions.set(token, session);

    // Store in database
    const db = await openDatabase();

    if (db) {
      const transaction = db.transaction('auth_sessions', 'readwrite');
      const store = transaction.objectStore('auth_sessions');
      store.put(session);
    }

    return session;
  }

  private static async _findUserByEmail(email: string): Promise<any | null> {
    const db = await openDatabase();

    if (!db) {
      return null;
    }

    return new Promise((resolve) => {
      const transaction = db.transaction('users', 'readonly');
      const store = transaction.objectStore('users');
      const index = store.index('email');
      const request = index.get(email);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  }

  private static async _findUserByUsername(username: string): Promise<any | null> {
    const db = await openDatabase();

    if (!db) {
      return null;
    }

    return new Promise((resolve) => {
      const transaction = db.transaction('users', 'readonly');
      const store = transaction.objectStore('users');
      const index = store.index('username');
      const request = index.get(username);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  }

  private static async _findUserById(userId: string): Promise<any | null> {
    const db = await openDatabase();

    if (!db) {
      return null;
    }

    return new Promise((resolve) => {
      const transaction = db.transaction('users', 'readonly');
      const store = transaction.objectStore('users');
      const request = store.get(userId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  }

  private static async _updateUserLastLogin(userId: string): Promise<void> {
    const db = await openDatabase();

    if (!db) {
      return;
    }

    await new Promise<void>((resolve) => {
      const transaction = db.transaction('users', 'readwrite');
      const store = transaction.objectStore('users');
      const getRequest = store.get(userId);

      getRequest.onsuccess = () => {
        const user = getRequest.result;

        if (user) {
          user.lastLoginAt = new Date().toISOString();
          store.put(user);
        }

        resolve();
      };

      getRequest.onerror = () => resolve();
    });
  }

  private static _getDefaultPreferences(): UserPreferences {
    return {
      theme: 'system',
      language: 'en',
      notifications: {
        email: true,
        browser: true,
        teamInvites: true,
        projectUpdates: true,
        featureAssignments: true,
      },
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }
}
