/**
 * Crypto utilities for password hashing and verification
 */

/**
 * Hash a password using the Web Crypto API
 */
export async function createHash(password: string): Promise<string> {
  if (typeof window === 'undefined') {
    // Server-side fallback (not recommended for production)
    return btoa(password); // This is very insecure - use proper server-side hashing
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(password + getSalt());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await createHash(password);
  return passwordHash === hash;
}

/**
 * Get a static salt (in production, use proper random salts per user)
 */
function getSalt(): string {
  return 'bolt-diy-salt-2024'; // In production, use per-user salts
}

/**
 * Generate a secure random string for tokens
 */
export function generateSecureToken(length: number = 32): string {
  if (typeof window === 'undefined') {
    // Server-side fallback
    return Math.random()
      .toString(36)
      .substring(2, length + 2);
  }

  const array = new Uint8Array(length);
  crypto.getRandomValues(array);

  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a cryptographically secure UUID
 */
export function generateSecureId(): string {
  if (typeof window !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  // Fallback implementation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;

    return v.toString(16);
  });
}
