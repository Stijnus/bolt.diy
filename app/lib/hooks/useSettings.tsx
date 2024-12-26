import { useStore } from '@nanostores/react';
import {
  isDebugMode,
  isEventLogsEnabled,
  isLocalModelsEnabled,
  LOCAL_PROVIDERS,
  promptStore,
  providersStore,
  latestBranchStore,
  isUpdatesEnabled,
} from '~/lib/stores/settings';
import { useCallback, useEffect, useState } from 'react';
import Cookies from 'js-cookie';
import type { IProviderSetting, ProviderInfo } from '~/types/model';
import { logStore } from '~/lib/stores/logs';

interface CommitData {
  commit: string;
  version?: string;
}

declare const __COMMIT_HASH: string;
declare const __APP_VERSION: string;

const versionData: CommitData = {
  commit: __COMMIT_HASH,
  version: __APP_VERSION,
};

export function useSettings() {
  const providers = useStore(providersStore);
  const debug = useStore(isDebugMode);
  const eventLogs = useStore(isEventLogsEnabled);
  const promptId = useStore(promptStore);
  const isLocalModel = useStore(isLocalModelsEnabled);
  const isLatestBranch = useStore(latestBranchStore);
  const updatesEnabled = useStore(isUpdatesEnabled);
  const [activeProviders, setActiveProviders] = useState<ProviderInfo[]>([]);
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState<boolean>(false);

  // Function to check if we're on stable version
  const checkIsStableVersion = async () => {
    try {
      const response = await fetch(
        `https://api.github.com/repos/stackblitz-labs/bolt.diy/git/refs/tags/v${versionData.version}`,
      );
      const data: { object: { sha: string } } = await response.json();

      return versionData.commit.slice(0, 7) === data.object.sha.slice(0, 7);
    } catch (error) {
      console.warn('Error checking stable version:', error);
      return false;
    }
  };

  // reading values from cookies on mount
  useEffect(() => {
    const savedProviders = Cookies.get('providers');

    if (savedProviders) {
      try {
        const parsedProviders: Record<string, IProviderSetting> = JSON.parse(savedProviders);
        Object.keys(providers).forEach((provider) => {
          const currentProviderSettings = parsedProviders[provider];

          if (currentProviderSettings) {
            providersStore.setKey(provider, {
              ...providers[provider],
              settings: {
                ...currentProviderSettings,
                enabled: currentProviderSettings.enabled ?? true,
              },
            });
          }
        });
      } catch (error) {
        console.error('Failed to parse providers from cookies:', error);
      }
    }

    // load debug mode from cookies
    const savedDebugMode = Cookies.get('isDebugEnabled');

    if (savedDebugMode) {
      isDebugMode.set(savedDebugMode === 'true');
    }

    // load event logs from cookies
    const savedEventLogs = Cookies.get('isEventLogsEnabled');

    if (savedEventLogs) {
      isEventLogsEnabled.set(savedEventLogs === 'true');
    }

    // load local models from cookies
    const savedLocalModels = Cookies.get('isLocalModelsEnabled');

    if (savedLocalModels) {
      isLocalModelsEnabled.set(savedLocalModels === 'true');
    }

    const promptId = Cookies.get('promptId');

    if (promptId) {
      promptStore.set(promptId);
    }

    // load latest branch setting from cookies or determine based on version
    const savedLatestBranch = Cookies.get('isLatestBranch');
    let checkCommit = Cookies.get('commitHash');

    if (checkCommit === undefined) {
      checkCommit = versionData.commit;
    }

    if (savedLatestBranch === undefined || checkCommit !== versionData.commit) {
      // If setting hasn't been set by user, check version
      checkIsStableVersion().then((isStable) => {
        const shouldUseLatest = !isStable;
        latestBranchStore.set(shouldUseLatest);
        Cookies.set('isLatestBranch', String(shouldUseLatest));
        Cookies.set('commitHash', String(versionData.commit));
      });
    } else {
      latestBranchStore.set(savedLatestBranch === 'true');
    }

    // load auto update setting from cookies
    const savedAutoUpdate = Cookies.get('autoUpdateEnabled');

    if (savedAutoUpdate) {
      setAutoUpdateEnabled(savedAutoUpdate === 'true');
    }

    // load updates enabled setting from cookies
    const savedUpdatesEnabled = Cookies.get('updatesEnabled');

    if (savedUpdatesEnabled) {
      isUpdatesEnabled.set(savedUpdatesEnabled === 'true');
    }
  }, []);

  // writing values to cookies on change
  useEffect(() => {
    const providerSetting: Record<string, IProviderSetting> = {};
    Object.keys(providers).forEach((provider) => {
      providerSetting[provider] = providers[provider].settings;
    });
    Cookies.set('providers', JSON.stringify(providerSetting));
  }, [providers]);

  useEffect(() => {
    let active = Object.entries(providers)
      .filter(([_key, provider]: [string, ProviderInfo & { settings: IProviderSetting }]) => provider.settings.enabled)
      .map(([_k, p]: [string, ProviderInfo & { settings: IProviderSetting }]) => p);

    if (!isLocalModel) {
      active = active.filter((p) => !LOCAL_PROVIDERS.includes(p.name));
    }

    setActiveProviders(active);
  }, [providers, isLocalModel]);

  // helper function to update settings
  const updateProviderSettings = useCallback(
    (provider: string, config: IProviderSetting) => {
      const settings = providers[provider].settings;
      providersStore.setKey(provider, { ...providers[provider], settings: { ...settings, ...config } });
    },
    [providers],
  );

  const enableDebugMode = useCallback((enabled: boolean) => {
    isDebugMode.set(enabled);
    logStore.logSystem(`Debug mode ${enabled ? 'enabled' : 'disabled'}`);
    Cookies.set('isDebugEnabled', String(enabled));
  }, []);

  const enableEventLogs = useCallback((enabled: boolean) => {
    isEventLogsEnabled.set(enabled);
    logStore.logSystem(`Event logs ${enabled ? 'enabled' : 'disabled'}`);
    Cookies.set('isEventLogsEnabled', String(enabled));
  }, []);

  const enableLocalModels = useCallback((enabled: boolean) => {
    isLocalModelsEnabled.set(enabled);
    logStore.logSystem(`Local models ${enabled ? 'enabled' : 'disabled'}`);
    Cookies.set('isLocalModelsEnabled', String(enabled));
  }, []);

  const setPromptId = useCallback((promptId: string) => {
    promptStore.set(promptId);
    Cookies.set('promptId', promptId);
  }, []);

  const enableLatestBranch = useCallback((enabled: boolean) => {
    latestBranchStore.set(enabled);
    logStore.logSystem(`Main branch updates ${enabled ? 'enabled' : 'disabled'}`);
    Cookies.set('isLatestBranch', String(enabled));
  }, []);

  const updateAutoUpdateEnabled = useCallback((enabled: boolean) => {
    setAutoUpdateEnabled(enabled);
    Cookies.set('autoUpdateEnabled', String(enabled));
    logStore.logSystem(`Automatic updates ${enabled ? 'enabled' : 'disabled'}`);
  }, []);

  const enableUpdates = useCallback((enabled: boolean) => {
    isUpdatesEnabled.set(enabled);
    Cookies.set('updatesEnabled', String(enabled));
    logStore.logSystem(`Updates ${enabled ? 'enabled' : 'disabled'}`);
  }, []);

  return {
    providers,
    activeProviders,
    updateProviderSettings,
    debug,
    enableDebugMode,
    eventLogs,
    enableEventLogs,
    isLocalModel,
    enableLocalModels,
    promptId,
    setPromptId,
    isLatestBranch,
    enableLatestBranch,
    autoUpdateEnabled,
    setAutoUpdateEnabled: updateAutoUpdateEnabled,
    updatesEnabled,
    enableUpdates,
  };
}

export default useSettings;
