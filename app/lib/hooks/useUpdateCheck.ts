import { useState, useEffect } from 'react';
import { checkForUpdates, acknowledgeUpdate } from '~/lib/api/updates';
import { getEnvironmentInfo } from '~/lib/environment';

const LAST_ACKNOWLEDGED_VERSION_KEY = 'bolt_last_acknowledged_version';

export const useUpdateCheck = () => {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<string>('');
  const [environmentInfo, setEnvironmentInfo] = useState({ isCloud: false, platform: 'Local' });
  const [lastAcknowledgedVersion, setLastAcknowledgedVersion] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LAST_ACKNOWLEDGED_VERSION_KEY);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    // Get environment info on mount
    setEnvironmentInfo(getEnvironmentInfo());

    // Don't check for updates in cloud environments
    if (environmentInfo.isCloud) {
      return undefined; // Explicitly return undefined for early return
    }

    const checkUpdate = async () => {
      try {
        const { available, version } = await checkForUpdates();
        setCurrentVersion(version);

        // Only show update if it's a new version and hasn't been acknowledged
        setHasUpdate(available && version !== lastAcknowledgedVersion);
      } catch (error) {
        console.error('Failed to check for updates:', error);
      }
    };

    // Check immediately and then every 30 minutes
    checkUpdate();

    const interval = setInterval(checkUpdate, 30 * 60 * 1000);

    // Return cleanup function with consistent return type
    return function cleanup() {
      clearInterval(interval);
    };
  }, [lastAcknowledgedVersion, environmentInfo.isCloud]);

  const handleAcknowledgeUpdate = async () => {
    // Don't process acknowledgments in cloud environments
    if (environmentInfo.isCloud) {
      return;
    }

    try {
      const { version } = await checkForUpdates();
      await acknowledgeUpdate(version);

      // Store in localStorage
      try {
        localStorage.setItem(LAST_ACKNOWLEDGED_VERSION_KEY, version);
      } catch (error) {
        console.error('Failed to persist acknowledged version:', error);
      }

      setLastAcknowledgedVersion(version);
      setHasUpdate(false);
    } catch (error) {
      console.error('Failed to acknowledge update:', error);
    }
  };

  return {
    hasUpdate: environmentInfo.isCloud ? false : hasUpdate,
    currentVersion,
    acknowledgeUpdate: handleAcknowledgeUpdate,
    environmentInfo,
  };
};
