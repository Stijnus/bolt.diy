/**
 * Utility for detecting Expo QR code URLs in terminal output
 */

// Local storage key for persisting the QR code URL
const QR_CODE_STORAGE_KEY = 'bolt_expo_qr_code_url';

/**
 * Regex pattern to match Expo URLs in terminal output
 * Matches formats like:
 * - exp://192.168.1.5:19000
 * - exp://localhost:19000
 * - exp://xyz.boltexpo.dev
 */
const EXPO_URL_PATTERNS = [
  // Standard formats
  /exp:\/\/(\d+\.\d+\.\d+\.\d+):(\d+)/g, // IP address format
  /exp:\/\/([a-zA-Z0-9\-\.]+):(\d+)/g, // Host format
  /exp:\/\/([a-zA-Z0-9\-\.]+\.[a-zA-Z0-9\-\.]+)/g, // Domain format

  // More permissive patterns
  /exp:\/\/[a-zA-Z0-9\.\-_]+\.[a-zA-Z0-9\.\-_]+(?:\/[\w\.\-_\/]*)?/g, // Any domain with optional path

  // Patterns with query parameters
  /exp:\/\/[a-zA-Z0-9\.\-_]+(?::\d+)?(?:\/[\w\.\-_\/]*)?(?:\?[\w\.\-_=&%]+)?/g,
];

/**
 * Cleans and normalizes an Expo URL for use with QR codes
 * @param url The raw Expo URL to clean
 * @returns A properly formatted Expo URL
 */
function cleanExpoUrl(url: string): string {
  // First remove any URL encoding
  let cleanUrl = decodeURIComponent(url);

  // Ensure it has the correct prefix
  if (!cleanUrl.startsWith('exp://')) {
    cleanUrl = 'exp://' + cleanUrl.replace(/^(https?|exp):\/\//, '');
  }

  /*
   * Replace any problematic characters that might interfere with scanning
   * Remove any trailing slashes that might cause issues
   */
  cleanUrl = cleanUrl.replace(/\/$/, '');

  console.log('Cleaned Expo URL:', cleanUrl);

  return cleanUrl;
}

/**
 * Checks if the given terminal output contains an Expo URL
 * @param output The terminal output to check
 * @returns The extracted Expo URL or null if none found
 */
export function extractExpoUrl(output: string): string | null {
  console.log('Extracting Expo URL from output:', output.substring(0, 100) + '...');

  // First check for standard Expo QR code URL format
  for (const pattern of EXPO_URL_PATTERNS) {
    pattern.lastIndex = 0; // Reset regex state

    const match = pattern.exec(output);

    if (match) {
      const extractedUrl = match[0];
      console.log('Extracted raw Expo URL:', extractedUrl);

      // Clean the URL to ensure it works with QR codes
      const cleanedUrl = cleanExpoUrl(extractedUrl);

      return cleanedUrl;
    }
  }

  return null;
}

/**
 * Class to monitor terminal output for Expo QR codes
 */
export class ExpoQRDetector {
  private _latestQRUrl: string | null = null;
  private _listeners: Array<(url: string) => void> = [];

  constructor() {
    // Initialize from localStorage if available
    try {
      if (typeof window !== 'undefined') {
        const savedUrl = window.localStorage.getItem(QR_CODE_STORAGE_KEY);

        if (savedUrl) {
          this._latestQRUrl = savedUrl;
          console.log('Loaded QR URL from storage:', savedUrl);
        }
      }
    } catch (error) {
      console.error('Failed to retrieve QR code URL from localStorage', error);
    }
  }

  /**
   * Process terminal output to detect QR code URLs
   * @param output Terminal output text
   */
  processOutput(output: string): void {
    const url = extractExpoUrl(output);

    // Only update and notify if we have a new URL
    if (url && url !== this._latestQRUrl) {
      console.log('New QR code URL detected:', url);
      this._latestQRUrl = url;

      // Save to localStorage for persistence
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(QR_CODE_STORAGE_KEY, url);
          console.log('Saved QR URL to storage:', url);
        }
      } catch (error) {
        console.error('Failed to save QR code URL to localStorage', error);
      }

      this._notifyListeners(url);
    }
  }

  /**
   * Add a listener for QR code URL detection
   * @param listener Callback function to call when a QR code URL is detected
   * @returns Unsubscribe function
   */
  addListener(listener: (url: string) => void): () => void {
    this._listeners.push(listener);

    // If we already have a URL, immediately notify the new listener
    if (this._latestQRUrl) {
      console.log('Notifying new listener with existing URL:', this._latestQRUrl);
      listener(this._latestQRUrl);
    }

    // Return unsubscribe function
    return () => {
      this._listeners = this._listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Get the current QR code URL if available
   */
  getCurrentUrl(): string | null {
    return this._latestQRUrl;
  }

  /**
   * Reset the detector state
   */
  reset(): void {
    this._latestQRUrl = null;

    // Clear from localStorage
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(QR_CODE_STORAGE_KEY);
        console.log('Reset QR URL storage');
      }
    } catch (error) {
      console.error('Failed to remove QR code URL from localStorage', error);
    }
  }

  /**
   * Notify all listeners about a new QR code URL
   * @param url The URL to notify about
   */
  private _notifyListeners(url: string): void {
    console.log('Notifying', this._listeners.length, 'listeners about URL:', url);
    this._listeners.forEach((listener) => listener(url));
  }
}

// Export a singleton instance for app-wide use
export const qrDetector = new ExpoQRDetector();
