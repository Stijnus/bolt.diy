/**
 * useEnvironment hook
 *
 * Centralized hook for accessing environment information:
 * - isCloud: Whether the app is running in a cloud environment
 * - platform: The specific platform (Vercel, Cloudflare, Local, etc.)
 * - isElectron: Whether the app is running in Electron
 * - gitSupported: Whether Git operations are supported
 * - simulateEnv: For development testing of different environments
 */

import { useState, useEffect } from 'react';
import { getEnvironmentInfo, isCloudEnvironment } from '~/lib/environment';

export interface EnvironmentInfo {
  isCloud: boolean;
  platform: string;
  isElectron: boolean;
  gitSupported: boolean;
  isRunningLocalServer: boolean;
}

// Check if running in Electron
const checkIsElectron = (): boolean => {
  // Check if window.electron exists (injected by Electron preload script)
  if (typeof window !== 'undefined' && 'electron' in window) {
    return true;
  }

  // Alternative detection method
  if (
    typeof window !== 'undefined' &&
    typeof window.process === 'object' &&
    (window.process as any)?.type === 'renderer'
  ) {
    return true;
  }

  return false;
};

// Check if Git is supported in the current environment
const checkGitSupported = async (): Promise<boolean> => {
  // In cloud environments, Git operations are not supported
  if (isCloudEnvironment()) {
    return false;
  }

  try {
    // Try to execute a simple Git command to check if Git is available
    const response = await fetch('/api/git-check', {
      method: 'GET',
    });

    if (!response.ok) {
      return false;
    }

    const data = (await response.json()) as { isAvailable: boolean };

    return data.isAvailable === true;
  } catch (error) {
    console.error('Error checking Git availability:', error);
    return false;
  }
};

export const useEnvironment = (simulateEnv?: {
  isCloud?: boolean;
  platform?: string;
  isElectron?: boolean;
  gitSupported?: boolean;
}) => {
  const [environmentInfo, setEnvironmentInfo] = useState<EnvironmentInfo>(() => {
    const baseInfo = getEnvironmentInfo();
    const isElectron = checkIsElectron();

    return {
      isCloud: simulateEnv?.isCloud ?? baseInfo.isCloud,
      platform: simulateEnv?.platform ?? baseInfo.platform,
      isElectron: simulateEnv?.isElectron ?? isElectron,
      gitSupported: simulateEnv?.gitSupported ?? !baseInfo.isCloud, // Initial assumption
      isRunningLocalServer: baseInfo.isRunningLocalServer,
    };
  });

  useEffect(() => {
    // Only check Git support if not simulating and not in cloud
    if (simulateEnv?.gitSupported === undefined && !environmentInfo.isCloud) {
      checkGitSupported().then((supported) => {
        setEnvironmentInfo((prev) => ({
          ...prev,
          gitSupported: supported,
        }));
      });
    }
  }, [simulateEnv?.gitSupported, environmentInfo.isCloud]);

  // Update if simulation values change
  useEffect(() => {
    if (simulateEnv) {
      setEnvironmentInfo((prev) => ({
        ...prev,
        isCloud: simulateEnv.isCloud ?? prev.isCloud,
        platform: simulateEnv.platform ?? prev.platform,
        isElectron: simulateEnv.isElectron ?? prev.isElectron,
        gitSupported: simulateEnv.gitSupported ?? prev.gitSupported,
      }));
    }
  }, [simulateEnv]);

  return environmentInfo;
};
