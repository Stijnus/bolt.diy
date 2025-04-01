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
type UpdateStage = 'idle' | 'checking' | 'downloading' | 'installing' | 'restarting';

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

  // Check for updates
  const checkForUpdate = useCallback(async () => {
    try {
      setUpdateState((prev) => ({ ...prev, updateStage: 'checking' }));

      const { available, version } = await checkForUpdates();

      setUpdateState((prev) => ({
        ...prev,
        updateAvailable: available,
        currentVersion: version,
        latestVersion: available ? version : prev.latestVersion,
        updateStage: 'idle',
      }));
    } catch (error) {
      setUpdateState((prev) => ({
        ...prev,
        updateStage: 'idle',
        updateError: `Error checking for updates: ${error instanceof Error ? error.message : String(error)}`,
      }));
    }
  }, []);

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
      setUpdateState((prev) => ({
        ...prev,
        updateError: `Error acknowledging update: ${error instanceof Error ? error.message : String(error)}`,
      }));
    }
  }, [updateState.latestVersion, setLastAcknowledgedVersion]);

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

  // Start update process
  const startUpdate = useCallback(async () => {
    // Reset any previous errors
    setUpdateState((prev) => ({ ...prev, updateError: null }));

    try {
      // Start the update process based on environment
      if (environment.isElectron) {
        // Electron update process
        setUpdateState((prev) => ({
          ...prev,
          updateInProgress: true,
          updateStage: 'downloading',
        }));

        /*
         * In Electron, we would use IPC to communicate with the main process
         * This is a placeholder for the actual Electron implementation
         */
        (window as any).electron?.ipcRenderer.send('start-update');
      } else if (environment.gitSupported) {
        // Git-based update process
        setUpdateState((prev) => ({
          ...prev,
          updateInProgress: true,
          updateStage: 'downloading',
          updateProgress: 0,
        }));

        // Start Git update via API
        const response = await fetch('/api/updates/start', {
          method: 'POST',
        });

        if (!response.ok) {
          throw new Error(`Failed to start update: ${response.status}`);
        }

        // Set up EventSource for progress updates
        const eventSource = new EventSource('/api/updates/progress');
        eventSourceRef.current = eventSource;

        eventSource.onmessage = (event) => {
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

          // Find progress information in the output
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
        };

        eventSource.onerror = () => {
          setUpdateState((prev) => ({
            ...prev,
            updateError: 'Error receiving update progress',
            updateInProgress: false,
            updateStage: 'idle',
          }));

          eventSource.close();
          eventSourceRef.current = null;
        };
      } else if (environment.isCloud) {
        // Cloud environment - just reload the page
        setUpdateState((prev) => ({
          ...prev,
          updateInProgress: true,
          updateStage: 'restarting',
        }));

        // Reload after a short delay
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        // Unsupported environment
        throw new Error('Updates are not supported in this environment');
      }
    } catch (error) {
      setUpdateState((prev) => ({
        ...prev,
        updateError: `Error starting update: ${error instanceof Error ? error.message : String(error)}`,
        updateInProgress: false,
        updateStage: 'idle',
      }));
    }

    return null;
  }, [environment]);

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
