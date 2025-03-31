/**
 * Environment detection utility for Bolt application
 * Detects whether the application is running in a cloud environment
 * or locally, and provides information about the environment.
 */

// Function to detect if running in a cloud environment
export const isCloudEnvironment = (): boolean => {
  try {
    // Check for common cloud platform environment variables
    if (typeof process !== 'undefined' && process.env) {
      // Cloudflare detection
      if (process.env.CF_PAGES || process.env.CLOUDFLARE_WORKER) {
        return true;
      }

      // Vercel detection
      if (process.env.VERCEL || process.env.VERCEL_ENV) {
        return true;
      }

      // Netlify detection
      if (process.env.NETLIFY || process.env.NETLIFY_DEV) {
        return true;
      }

      // Render detection
      if (process.env.RENDER || process.env.IS_RENDER) {
        return true;
      }

      // Railway detection
      if (process.env.RAILWAY_ENVIRONMENT) {
        return true;
      }
    }

    // Check for runtime-specific flags
    if (
      typeof window !== 'undefined' &&
      (window.location.hostname.includes('.pages.dev') || // Cloudflare Pages
        window.location.hostname.includes('.vercel.app') || // Vercel
        window.location.hostname.includes('.netlify.app')) // Netlify
    ) {
      return true;
    }

    return false;
  } catch (error) {
    // If there's an error in detection, assume we're not in a cloud environment
    console.error('Error detecting environment:', error);
    return false;
  }
};

// Get detailed environment information
export const getEnvironmentInfo = () => {
  try {
    let platform = 'Local';

    if (typeof process !== 'undefined' && process.env) {
      if (process.env.CF_PAGES || process.env.CLOUDFLARE_WORKER) {
        platform = 'Cloudflare';
      } else if (process.env.VERCEL || process.env.VERCEL_ENV) {
        platform = 'Vercel';
      } else if (process.env.NETLIFY || process.env.NETLIFY_DEV) {
        platform = 'Netlify';
      } else if (process.env.RENDER || process.env.IS_RENDER) {
        platform = 'Render';
      } else if (process.env.RAILWAY_ENVIRONMENT) {
        platform = 'Railway';
      }
    }

    // Additional hostname-based detection
    if (platform === 'Local' && typeof window !== 'undefined') {
      if (window.location.hostname.includes('.pages.dev')) {
        platform = 'Cloudflare';
      } else if (window.location.hostname.includes('.vercel.app')) {
        platform = 'Vercel';
      } else if (window.location.hostname.includes('.netlify.app')) {
        platform = 'Netlify';
      }
    }

    return {
      isCloud: isCloudEnvironment(),
      platform,
      isRunningLocalServer: typeof process !== 'undefined' && process.env.NODE_ENV === 'development',
    };
  } catch (error) {
    console.error('Error getting environment info:', error);
    return {
      isCloud: false,
      platform: 'Local',
      isRunningLocalServer: false,
    };
  }
};
