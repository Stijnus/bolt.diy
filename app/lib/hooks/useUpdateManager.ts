/**
 * useUpdateManager hook
 *
 * A centralized hook for managing application updates across different environments:
 * - Handles Electron auto-updates for desktop apps
 * - Manages Git-based updates for local installations
 * - Provides read-only update visibility in cloud environments
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { checkForUpdates, acknowledgeUpdate } from '~/lib/api/updates';
import { useEnvironment } from './useEnvironment';
import { useLocalStorage } from '~/lib/hooks/useLocalStorage';

// Types for update management
type UpdateStage = 'idle' | 'checking' | 'downloading' | 'installing' | 'building' | 'restarting' | 'syncing';

interface UpdateState {
  updateAvailable: boolean;
  updateInProgress: boolean;
  updateStage: UpdateStage;
  updateProgress: number;
  currentVersion: string;
  latestVersion: string;
  lastAcknowledgedVersion: string;
  updateError: string | null;
}

interface UpdateManagerOptions {
  autoCheck?: boolean;
  autoAcknowledge?: boolean;
  checkInterval?: number;
}

// Electron API type declaration
declare global {
  interface Window {
    electron?: {
      ipcRenderer: {
        send: (channel: string, ...args: any[]) => void;
        on: (channel: string, listener: (...args: any[]) => void) => void;
        removeListener: (channel: string, listener: (...args: any[]) => void) => void;
      };
    };
  }
}

/**
 * Hook for managing application updates across different environments
 *
 * Provides functionality for checking, downloading, and installing updates
 * with environment-specific behavior (Electron, Git, etc.)
 */
export function useUpdateManager({
  autoCheck = true,
  autoAcknowledge = false,
  checkInterval = 3600000, // 1 hour
}: UpdateManagerOptions = {}) {
  const environment = useEnvironment();

  // Store the last acknowledged version in localStorage
  const [lastAcknowledgedVersion, setLastAcknowledgedVersion] = useLocalStorage<string>(
    'lastAcknowledgedUpdateVersion',
    '',
  );

  // State for update management
  const [updateState, setUpdateState] = useState<UpdateState>({
    updateAvailable: false,
    updateInProgress: false,
    updateStage: 'idle',
    updateProgress: 0,
    currentVersion: '',
    latestVersion: '',
    lastAcknowledgedVersion,
    updateError: null,
  });

  // Refs for event source and interval
  const eventSourceRef = useRef<EventSource | null>(null);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Utility function for consistent error handling
  const handleUpdateError = useCallback((error: unknown, context: string) => {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const fullMessage = `${context}: ${errorMessage}`;

    console.error(fullMessage);

    // toast.error(fullMessage); // Assuming toast is not defined in this scope

    setUpdateState((prev) => ({
      ...prev,
      updateError: fullMessage,
      updateStage: 'idle',
      updateInProgress: false,
    }));
  }, []);

  // Reset update state
  const resetUpdateState = useCallback(() => {
    setUpdateState((prev) => ({
      ...prev,
      updateInProgress: false,
      updateProgress: 0,
      updateStage: 'idle',
      updateError: null,
    }));
  }, []);

  // Debug logging utility
  const logUpdate = useCallback((message: string, data?: any) => {
    console.log(`[UpdateManager] ${message}`, data);
  }, []);

  // Check for updates
  const checkForUpdate = useCallback(async () => {
    logUpdate('Checking for updates');

    try {
      setUpdateState((prev) => ({ ...prev, updateStage: 'checking' }));

      const { available, version } = await checkForUpdates();
      logUpdate('Update check completed', { available, version });

      setUpdateState((prev) => ({
        ...prev,
        updateAvailable: available,
        currentVersion: version,
        latestVersion: available ? version : prev.latestVersion,
        updateStage: 'idle',
      }));
    } catch (error) {
      handleUpdateError(error, 'Error checking for updates');
    }
  }, [handleUpdateError, logUpdate]);

  // Acknowledge current update
  const acknowledgeCurrentUpdate = useCallback(async () => {
    if (!updateState.latestVersion) {
      return;
    }

    try {
      await acknowledgeUpdate(updateState.latestVersion);
      setLastAcknowledgedVersion(updateState.latestVersion);
      setUpdateState((prev) => ({ ...prev, updateAvailable: false }));
    } catch (error) {
      handleUpdateError(error, 'Error acknowledging update');
    }
  }, [updateState.latestVersion, setLastAcknowledgedVersion, handleUpdateError]);

  // Auto-acknowledge updates when configured
  useEffect(() => {
    if (
      autoAcknowledge &&
      updateState.updateAvailable &&
      updateState.latestVersion !== updateState.lastAcknowledgedVersion
    ) {
      acknowledgeCurrentUpdate();
    }
  }, [
    autoAcknowledge,
    updateState.updateAvailable,
    updateState.latestVersion,
    updateState.lastAcknowledgedVersion,
    acknowledgeCurrentUpdate,
  ]);

  // Enhanced EventSource handling
  const handleEventSource = useCallback(() => {
    const eventSource = new EventSource('/api/updates/progress');
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.complete) {
          setUpdateState((prev) => ({
            ...prev,
            updateStage: 'installing',
            updateProgress: 100,
          }));

          eventSource.close();
          eventSourceRef.current = null;

          // Redirect to reload the application
          setTimeout(() => {
            window.location.reload();
          }, 2000);

          return;
        }

        // Handle progress updates
        const progressData = data.lines.find(
          (line: string) => line.includes('Receiving objects:') || line.includes('Resolving deltas:'),
        );

        if (progressData) {
          const match = progressData.match(/(\d+)%/);

          if (match && match[1]) {
            const progress = parseInt(match[1], 10);
            setUpdateState((prev) => ({
              ...prev,
              updateProgress: progress,
            }));
          }
        }
      } catch (error) {
        handleUpdateError(error, 'Error processing update progress');
        eventSource.close();
        eventSourceRef.current = null;
      }
    };

    eventSource.onerror = () => {
      handleUpdateError(null, 'Error receiving update progress');
      eventSource.close();
      eventSourceRef.current = null;
    };

    return eventSource;
  }, [handleUpdateError]);

  // Start update process
  const startUpdate = useCallback(async () => {
    logUpdate('Starting update process', { environment });

    try {
      // Reset any previous errors
      setUpdateState((prev) => ({ ...prev, updateError: null }));

      if (environment.isElectron) {
        logUpdate('Starting Electron update');
        setUpdateState((prev) => ({
          ...prev,
          updateInProgress: true,
          updateStage: 'downloading',
        }));

        window.electron?.ipcRenderer.send('start-update');
      } else if (environment.gitSupported) {
        logUpdate('Starting Git update');
        setUpdateState((prev) => ({
          ...prev,
          updateInProgress: true,
          updateStage: 'downloading',
          updateProgress: 0,
        }));

        const response = await fetch('/api/updates/start', {
          method: 'POST',
        });
        logUpdate('Git update started', { status: response.status });

        if (!response.ok) {
          throw new Error(`Failed to start update: ${response.status}`);
        }

        handleEventSource();
      } else if (environment.isCloud) {
        logUpdate('Reloading cloud environment');
        setUpdateState((prev) => ({
          ...prev,
          updateStage: 'restarting',
          updateProgress: 100,
        }));

        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } catch (error) {
      handleUpdateError(error, 'Error starting update');
    }
  }, [environment, handleEventSource, handleUpdateError, logUpdate]);

  // Cancel update process
  const cancelUpdate = useCallback(() => {
    // Close EventSource if it exists
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    resetUpdateState();

    return null;
  }, [resetUpdateState]);

  // Set up automatic update checking
  useEffect(() => {
    if (autoCheck) {
      // Check immediately on mount
      checkForUpdate();

      // Set up interval for periodic checks
      checkIntervalRef.current = setInterval(checkForUpdate, checkInterval);
    }

    return () => {
      // Clean up interval on unmount
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }

      // Close EventSource if it exists
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [autoCheck, checkForUpdate, checkInterval]);

  // Update lastAcknowledgedVersion in state when it changes in localStorage
  useEffect(() => {
    setUpdateState((prev) => ({
      ...prev,
      lastAcknowledgedVersion,
    }));
  }, [lastAcknowledgedVersion]);

  return {
    // State
    updateAvailable: updateState.updateAvailable,
    updateInProgress: updateState.updateInProgress,
    updateStage: updateState.updateStage,
    updateProgress: updateState.updateProgress,
    currentVersion: updateState.currentVersion,
    latestVersion: updateState.latestVersion,
    lastAcknowledgedVersion: updateState.lastAcknowledgedVersion,
    updateError: updateState.updateError,

    // Actions
    checkForUpdate,
    acknowledgeUpdate: acknowledgeCurrentUpdate,
    startUpdate,
    cancelUpdate,
  };
}

export type { UpdateState, UpdateStage };
