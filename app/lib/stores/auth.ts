import { atom, computed } from 'nanostores';
import type { User, AuthSession } from '~/components/projects/types';
import { AuthService } from '~/lib/services/authService';

// Auth state
export const authSession = atom<AuthSession | null>(null);
export const isAuthLoading = atom<boolean>(true);
export const authError = atom<string | null>(null);

// Computed values
export const currentUser = computed(authSession, (session) => session?.user || null);
export const isAuthenticated = computed(authSession, (session) => {
  if (!session) {
    return false;
  }

  return new Date(session.expiresAt) > new Date();
});

/**
 * Initialize authentication state
 */
export async function initAuth(): Promise<void> {
  isAuthLoading.set(true);
  authError.set(null);

  try {
    const session = await AuthService.getCurrentSession();
    authSession.set(session);
  } catch (error) {
    console.error('Failed to initialize auth:', error);
    authError.set(error instanceof Error ? error.message : 'Authentication error');
  } finally {
    isAuthLoading.set(false);
  }
}

/**
 * Login user
 */
export async function login(email: string, password: string): Promise<void> {
  isAuthLoading.set(true);
  authError.set(null);

  try {
    const session = await AuthService.login({ email, password });
    authSession.set(session);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed';
    authError.set(message);
    throw error;
  } finally {
    isAuthLoading.set(false);
  }
}

/**
 * Register new user
 */
export async function register(email: string, password: string, username: string, name: string): Promise<void> {
  isAuthLoading.set(true);
  authError.set(null);

  try {
    const session = await AuthService.register({ email, password, username, name });
    authSession.set(session);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed';
    authError.set(message);
    throw error;
  } finally {
    isAuthLoading.set(false);
  }
}

/**
 * Logout user
 */
export async function logout(): Promise<void> {
  const session = authSession.get();

  if (!session) {
    return;
  }

  try {
    await AuthService.logout(session.token);
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    authSession.set(null);
    authError.set(null);
  }
}

/**
 * Update user profile
 */
export async function updateUserProfile(updates: Partial<User>): Promise<void> {
  const session = authSession.get();

  if (!session) {
    throw new Error('Not authenticated');
  }

  try {
    const updatedUser = await AuthService.updateUser(session.user.id, updates);
    authSession.set({
      ...session,
      user: updatedUser,
    });
  } catch (error) {
    authError.set(error instanceof Error ? error.message : 'Update failed');
    throw error;
  }
}

/**
 * Change password
 */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const session = authSession.get();

  if (!session) {
    throw new Error('Not authenticated');
  }

  try {
    await AuthService.changePassword(session.user.id, currentPassword, newPassword);
  } catch (error) {
    authError.set(error instanceof Error ? error.message : 'Password change failed');
    throw error;
  }
}

/**
 * Refresh session if needed
 */
export async function refreshSession(): Promise<void> {
  const session = authSession.get();

  if (!session) {
    return;
  }

  // Check if session is expiring soon (within 1 hour)
  const expirationTime = new Date(session.expiresAt).getTime();
  const oneHourFromNow = Date.now() + 60 * 60 * 1000;

  if (expirationTime < oneHourFromNow) {
    try {
      const newSession = await AuthService.refreshSession(session.refreshToken);
      authSession.set(newSession);
    } catch (error) {
      console.error('Session refresh failed:', error);

      // If refresh fails, logout the user
      await logout();
    }
  }
}

/**
 * Clear auth error
 */
export function clearAuthError(): void {
  authError.set(null);
}

// Auto-refresh session every 30 minutes
if (typeof window !== 'undefined') {
  setInterval(refreshSession, 30 * 60 * 1000);
}
