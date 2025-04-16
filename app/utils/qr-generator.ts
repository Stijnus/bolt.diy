import QRCode from 'qrcode';

/**
 * Generates a QR code data URL for the given Expo URL
 * @param url The Expo URL to encode in the QR code
 * @returns A Promise resolving to a data URL containing the QR code image
 */
export async function generateQRCode(url: string): Promise<string> {
  try {
    // Log the URL for debugging
    console.log('Generating QR code for URL:', url);

    /*
     * Ensure the URL is properly formatted
     * Remove any encoding that might have been applied already
     */
    const cleanUrl = decodeURIComponent(url);
    console.log('Clean URL:', cleanUrl);

    /**
     * Handle different URL formats
     *
     * In some cases, Expo Go expects a very specific format
     * Format 1: The original URL as detected from terminal
     * Format A uses just the URL as-is
     * Format B prefixes with 'exp://' if needed
     * Format C ensures URL has proper scheme prefix
     */

    let expUrl = cleanUrl;

    // Make sure it starts with exp://
    if (!expUrl.startsWith('exp://')) {
      expUrl = 'exp://' + expUrl.replace(/^(https?|exp):\/\//, '');
    }

    console.log('Final URL for QR code:', expUrl);

    // Generate QR code as data URL with exact text
    const qrDataUrl = await QRCode.toDataURL(expUrl, {
      errorCorrectionLevel: 'H',
      margin: 1,
      scale: 8,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

    return qrDataUrl;
  } catch (error) {
    console.error('Failed to generate QR code:', error);
    throw error;
  }
}
