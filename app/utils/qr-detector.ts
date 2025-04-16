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
 * - http://localhost:19006 (Expo web)
 * - http://192.168.1.5:19006 (Expo web)
 */
const EXPO_URL_PATTERNS = [
  // Standard formats for mobile
  /exp:\/\/(\d+\.\d+\.\d+\.\d+):(\d+)/g, // IP address format
  /exp:\/\/([a-zA-Z0-9\-\.]+):(\d+)/g, // Host format
  /exp:\/\/([a-zA-Z0-9\-\.]+\.[a-zA-Z0-9\-\.]+)/g, // Domain format

  // Web formats for Expo
  /https?:\/\/localhost:(\d+)/g, // Local web server
  /https?:\/\/(\d+\.\d+\.\d+\.\d+):(\d+)/g, // IP address web server

  // QR code marker patterns that might appear in terminal output
  /QR Code:.*exp:\/\/[a-zA-Z0-9\.\-_:\/]+/g, // QR code with exp:// URL
  /\› Metro waiting on (exp:\/\/[a-zA-Z0-9\.\-_:\/]+)/g, // Metro bundler format

  // More permissive patterns
  /exp:\/\/[a-zA-Z0-9\.\-_]+\.[a-zA-Z0-9\.\-_]+(?:\/[\w\.\-_\/]*)?/g, // Any domain with optional path

  // Patterns with query parameters
  /exp:\/\/[a-zA-Z0-9\.\-_]+(?::\d+)?(?:\/[\w\.\-_\/]*)?(?:\?[\w\.\-_=&%]+)?/g,
];

/**
 * Check if output is likely from an Expo process
 * @param output Terminal output to check
 * @param command Optional command that generated the output
 * @returns True if the output is related to Expo
 */
function isExpoRelatedOutput(output: string, command?: string): boolean {
  // Debug log to see what output we're checking
  console.log('Checking if Expo-related:', output.substring(0, 100) + '...');

  // If we have a command, check if it's an Expo command
  if (command) {
    if (
      command.includes('expo') ||
      command.includes('npx expo') ||
      command.includes('npm start') ||
      command.includes('yarn start') ||
      command.includes('npm run web') ||
      command.includes('npm run ios') ||
      command.includes('npm run android')
    ) {
      console.log('Expo-related command detected:', command);
      return true;
    }
  }

  // Otherwise check for Expo-related text in the output
  const expoIndicators = [
    'Expo',
    'expo ',
    'expo-cli',
    'Metro Bundler',
    'Metro waiting',
    'Starting project at',
    'Developer tools running',
    'Run instructions for iOS',
    'Run instructions for Android',
    'QR Code',
    'Scan the QR code',
    'Scan this QR code',
    'exp://',
    'Bundled',
    'Bundling',
    'webpack',
    'react-native',
    'localhost:19', // Common Expo port range
    'Web Bundled',
  ];

  for (const indicator of expoIndicators) {
    if (output.includes(indicator)) {
      console.log('Expo indicator found:', indicator);
      return true;
    }
  }

  return false;
}

/**
 * Cleans and normalizes an Expo URL for use with QR codes
 * @param url The raw Expo URL to clean
 * @returns A properly formatted Expo URL
 */
function cleanExpoUrl(url: string): string {
  // First remove any URL encoding
  let cleanUrl = decodeURIComponent(url);

  // For web URLs, keep them as is
  if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
    console.log('Web URL detected, keeping as is:', cleanUrl);
    return cleanUrl;
  }

  // Ensure it has the correct prefix for mobile
  if (!cleanUrl.startsWith('exp://')) {
    cleanUrl = 'exp://' + cleanUrl.replace(/^(https?|exp):\/\//, '');
  }

  /**
   * Replace any problematic characters that might interfere with scanning
   * Remove any trailing slashes that might cause issues
   */
  cleanUrl = cleanUrl.replace(/\/$/, '');

  console.log('Cleaned Expo URL:', cleanUrl);

  return cleanUrl;
}

/**
 * Extracts URLs from terminal output using a more aggressive approach
 * @param output The output to search
 * @returns Array of potential URLs
 */
function extractPotentialUrls(output: string): string[] {
  const urls: string[] = [];

  // First try standard regex patterns
  for (const pattern of EXPO_URL_PATTERNS) {
    pattern.lastIndex = 0; // Reset regex state

    let match;

    while ((match = pattern.exec(output)) !== null) {
      const url = match[0];

      // If a capturing group matched (like in the Metro pattern), use that instead
      const capturedUrl = match[1] ? match[1] : url;
      urls.push(capturedUrl);
    }
  }

  /*
   * Do a more aggressive search for URLs in terminal output
   * Look for lines with localhost or IP addresses
   */
  const lines = output.split('\n');

  for (const line of lines) {
    if (line.includes('http://') || line.includes('https://') || line.includes('exp://')) {
      // Try to extract URLs from the line using a more generic pattern
      const urlMatches = line.match(/(https?:\/\/|exp:\/\/)[a-zA-Z0-9\.\-_:\/]+/g);

      if (urlMatches) {
        urls.push(...urlMatches);
      }
    }
  }

  // Remove duplicates and return
  return [...new Set(urls)];
}

/**
 * Checks if the given terminal output contains an Expo URL
 * @param output The terminal output to check
 * @returns The extracted Expo URL or null if none found
 */
export function extractExpoUrl(output: string): string | null {
  // Skip processing if this doesn't look like Expo output
  if (!isExpoRelatedOutput(output)) {
    return null;
  }

  console.log('Extracting Expo URL from output:', output.substring(0, 100) + '...');

  // Extract all potential URLs
  const potentialUrls = extractPotentialUrls(output);

  if (potentialUrls.length > 0) {
    console.log('Found potential URLs:', potentialUrls);

    // Clean and return the first URL
    const cleanedUrl = cleanExpoUrl(potentialUrls[0]);

    return cleanedUrl;
  }

  return null;
}

/**
 * Class to monitor terminal output for Expo QR codes
 */
export class ExpoQRDetector {
  private _latestQRUrl: string | null = null;
  private _listeners: Array<(url: string, isNewDetection: boolean) => void> = [];
  private _sessionQRUrls: Set<string> = new Set();
  private _debugMode: boolean = true; // Enable more verbose logging

  constructor() {
    // Clear previous QR code to avoid showing old codes on fresh start
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(QR_CODE_STORAGE_KEY);
        console.log('Cleared previous QR URL from storage on fresh start');
      }
    } catch (error) {
      console.error('Failed to clear QR code URL from localStorage', error);
    }
  }

  /**
   * Process terminal output to detect QR code URLs
   * @param output Terminal output text
   * @param command Optional command that generated the output
   */
  processOutput(output: string, command?: string): void {
    // Debug output in console
    if (this._debugMode) {
      console.log(`Processing ${output.length} chars of output. Command: ${command || 'unknown'}`);
    }

    // Skip processing if this doesn't look like Expo output
    if (!isExpoRelatedOutput(output, command)) {
      return;
    }

    const url = extractExpoUrl(output);

    // Only update and notify if we have a new URL
    if (url && url !== this._latestQRUrl) {
      console.log('New QR code URL detected:', url);

      // Check if this URL is newly detected in this session
      const isNewDetection = !this._sessionQRUrls.has(url);

      // Update state
      this._latestQRUrl = url;
      this._sessionQRUrls.add(url);

      // Save to localStorage for persistence
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(QR_CODE_STORAGE_KEY, url);
          console.log('Saved QR URL to storage:', url);
        }
      } catch (error) {
        console.error('Failed to save QR code URL to localStorage', error);
      }

      this._notifyListeners(url, isNewDetection);
    }
  }

  /**
   * Add a listener for QR code URL detection
   * @param listener Callback function to call when a QR code URL is detected
   * @returns Unsubscribe function
   */
  addListener(listener: (url: string, isNewDetection: boolean) => void): () => void {
    this._listeners.push(listener);

    /*
     * If we already have a URL, immediately notify the new listener
     * but mark it as not newly detected
     */
    if (this._latestQRUrl) {
      console.log('Notifying new listener with existing URL:', this._latestQRUrl);
      listener(this._latestQRUrl, false);
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
    this._sessionQRUrls.clear();

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
   * @param isNewDetection Whether this URL was newly detected in this session
   */
  private _notifyListeners(url: string, isNewDetection: boolean): void {
    console.log('Notifying', this._listeners.length, 'listeners about URL:', url, 'isNewDetection:', isNewDetection);
    this._listeners.forEach((listener) => listener(url, isNewDetection));
  }
}

// Export a singleton instance for app-wide use
export const qrDetector = new ExpoQRDetector();
