/**
 * Cryptographic utilities for secure random generation
 */

/**
 * Generates a secure random password suitable for Supabase database passwords
 * @param length - Password length (minimum 16, default 24)
 * @returns Secure random password with letters, numbers, and symbols
 */
export function generateSecurePassword(length: number = 24): string {
  if (length < 16) {
    throw new Error('Password length must be at least 16 characters');
  }

  // Character sets for password generation
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';

  const allChars = lowercase + uppercase + numbers + symbols;

  // Use Web Crypto API for secure random generation
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);

  let password = '';

  // Ensure at least one character from each set
  password += lowercase[array[0] % lowercase.length];
  password += uppercase[array[1] % uppercase.length];
  password += numbers[array[2] % numbers.length];
  password += symbols[array[3] % symbols.length];

  // Fill the rest with random characters
  for (let i = 4; i < length; i++) {
    password += allChars[array[i] % allChars.length];
  }

  // Shuffle the password to randomize character positions
  password = shuffleString(password, array);

  return password;
}

/**
 * Shuffles a string using Fisher-Yates algorithm with provided random values
 */
function shuffleString(str: string, randomValues: Uint8Array): string {
  const chars = str.split('');

  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomValues[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}

/**
 * Generates a secure random string for tokens, IDs, etc.
 * @param length - String length
 * @param charset - Character set to use (default: alphanumeric)
 * @returns Secure random string
 */
export function generateRandomString(
  length: number,
  charset: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);

  let result = '';

  for (let i = 0; i < length; i++) {
    result += charset[array[i] % charset.length];
  }

  return result;
}

/**
 * Validates a project name for Supabase requirements
 * @param name - Project name to validate
 * @returns Object with validation result and error message if invalid
 */
export function validateSupabaseProjectName(name: string): { valid: boolean; error?: string } {
  if (!name || name.length < 2) {
    return { valid: false, error: 'Project name must be at least 2 characters long' };
  }

  if (name.length > 63) {
    return { valid: false, error: 'Project name must be at most 63 characters long' };
  }

  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(name)) {
    return {
      valid: false,
      error:
        'Project name must start and end with lowercase letters or numbers, and only contain lowercase letters, numbers, and hyphens',
    };
  }

  return { valid: true };
}

/**
 * Sanitizes a project name to meet Supabase requirements
 * @param name - Raw project name
 * @returns Sanitized project name
 */
export function sanitizeSupabaseProjectName(name: string): string {
  // Convert to lowercase
  let sanitized = name.toLowerCase();

  // Replace spaces and underscores with hyphens
  sanitized = sanitized.replace(/[\s_]+/g, '-');

  // Remove invalid characters
  sanitized = sanitized.replace(/[^a-z0-9-]/g, '');

  // Remove leading/trailing hyphens
  sanitized = sanitized.replace(/^-+|-+$/g, '');

  // Ensure it starts and ends with alphanumeric
  if (sanitized.length > 0 && sanitized[0] === '-') {
    sanitized = sanitized.substring(1);
  }

  if (sanitized.length > 0 && sanitized[sanitized.length - 1] === '-') {
    sanitized = sanitized.substring(0, sanitized.length - 1);
  }

  // Ensure minimum length
  if (sanitized.length < 2) {
    sanitized = 'project-' + generateRandomString(6, 'abcdefghijklmnopqrstuvwxyz0123456789');
  }

  // Ensure maximum length
  if (sanitized.length > 63) {
    sanitized = sanitized.substring(0, 63);
  }

  return sanitized;
}
