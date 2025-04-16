import { atom } from 'nanostores';

// Create an atom to store the latest detected QR code URL
export const qrCodeUrlAtom = atom<string | null>(null);

/**
 * Regular expressions to match Expo QR code URLs in terminal output
 */
const EXPO_QR_URL_PATTERNS = [
  // Standard Expo URL patterns
  /exp:\/\/[a-zA-Z0-9\.\-]+:\d+/g, // Local expo URL with IP and port
  /exp:\/\/\w+\.expo\.dev/g, // Production expo URL
  /exp:\/\/\w+\.boltexpo\.dev/g, // Custom domain expo URL

  // More permissive pattern to catch edge cases
  /exp:\/\/[a-zA-Z0-9\.\-_]+\.[a-zA-Z0-9\.\-_]+(?:\/[\w\.\-_\/]*)?/g, // Any domain with optional path

  // Catch URLs with query parameters
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
 * Detects QR code URLs in terminal output
 * @param output The terminal output string to check
 * @returns The detected QR code URL or null if none found
 */
export function detectQRCodeUrl(output: string): string | null {
  console.log('Detecting QR code in output:', output.substring(0, 100) + '...');

  // Try each pattern until we find a match
  for (const pattern of EXPO_QR_URL_PATTERNS) {
    const matches = output.match(pattern);

    if (matches && matches.length > 0) {
      // Return the first match
      const extractedUrl = matches[0];
      console.log('Detected raw QR code URL:', extractedUrl);

      // Clean the URL to ensure it works with QR codes
      const cleanedUrl = cleanExpoUrl(extractedUrl);

      return cleanedUrl;
    }
  }

  return null;
}

/**
 * Updates the QR code URL atom if a new URL is detected
 * @param terminalOutput The terminal output to process
 */
export function processTerminalOutputForQRCode(terminalOutput: string): void {
  const url = detectQRCodeUrl(terminalOutput);

  if (url) {
    console.log('Setting QR code URL atom:', url);

    // Only update if we found a URL
    qrCodeUrlAtom.set(url);
  }
}
