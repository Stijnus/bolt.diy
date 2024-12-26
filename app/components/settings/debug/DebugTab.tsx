import React, { useCallback, useEffect, useState } from 'react';
import { useSettings } from '~/lib/hooks/useSettings';
import { toast } from 'react-toastify';
import { providerBaseUrlEnvKeys } from '~/utils/constants';

interface ProviderStatus {
  name: string;
  enabled: boolean;
  isLocal: boolean;
  isRunning: boolean | null;
  error?: string;
  lastChecked: Date;
  responseTime?: number;
  url: string | null;
}

interface SystemInfo {
  os: string;
  browser: string;
  screen: string;
  language: string;
  timezone: string;
  memory: string;
  cores: number;
  deviceType: string;
  colorDepth: string;
  pixelRatio: number;
  online: boolean;
  cookiesEnabled: boolean;
  doNotTrack: boolean;
}

interface IProviderConfig {
  name: string;
  settings: {
    enabled: boolean;
    baseUrl?: string;
  };
}

const LOCAL_PROVIDERS = ['Ollama', 'LMStudio', 'OpenAILike'];

function getSystemInfo(): SystemInfo {
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) {
      return '0 Bytes';
    }

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getBrowserInfo = (): string => {
    const ua = navigator.userAgent;
    let browser = 'Unknown';

    if (ua.includes('Firefox/')) {
      browser = 'Firefox';
    } else if (ua.includes('Chrome/')) {
      if (ua.includes('Edg/')) {
        browser = 'Edge';
      } else {
        browser = 'Chrome';
      }
    } else if (ua.includes('Safari/')) {
      browser = 'Safari';
    }

    return browser;
  };

  const getDeviceType = (): string => {
    const ua = navigator.userAgent;

    if (/mobile/i.test(ua)) {
      return 'Mobile';
    }

    if (/tablet/i.test(ua)) {
      return 'Tablet';
    }

    return 'Desktop';
  };

  return {
    os: navigator.platform,
    browser: getBrowserInfo(),
    screen: `${window.screen.width}x${window.screen.height}`,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    memory: formatBytes(performance?.memory?.totalJSHeapSize || 0),
    cores: navigator.hardwareConcurrency,
    deviceType: getDeviceType(),
    colorDepth: `${window.screen.colorDepth}-bit`,
    pixelRatio: window.devicePixelRatio,
    online: navigator.onLine,
    cookiesEnabled: navigator.cookieEnabled,
    doNotTrack: navigator.doNotTrack === '1',
  };
}

async function checkProviderStatus(url: string | null, providerName: string): Promise<ProviderStatus> {
  const startTime = performance.now();

  try {
    if (!url) {
      throw new Error('No URL provided');
    }

    // Normalize URL
    const baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
    console.log(`[Debug] Checking provider ${providerName} at ${baseUrl}`);

    // List of endpoints to check
    const endpoints = ['/health', '/v1/models'];
    const results = await Promise.all(
      endpoints.map(async (endpoint) => {
        try {
          const response = await fetch(`${baseUrl}${endpoint}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          return response.ok;
        } catch (error) {
          console.log(`[Debug] Failed to check ${endpoint} for ${providerName}:`, error);
          return false;
        }
      }),
    );

    const isRunning = results.some((result) => result);
    console.log(`[Debug] Final status for ${providerName}:`, isRunning);

    return {
      name: providerName,
      enabled: false,
      isLocal: true,
      isRunning,
      lastChecked: new Date(),
      responseTime: performance.now() - startTime,
      url,
    };
  } catch (error) {
    console.log(`[Debug] Provider check failed for ${providerName}:`, error);
    return {
      name: providerName,
      enabled: false,
      isLocal: true,
      isRunning: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      lastChecked: new Date(),
      responseTime: performance.now() - startTime,
      url,
    };
  }
}

export default function DebugTab() {
  const { providers } = useSettings();
  const [activeProviders, setActiveProviders] = useState<ProviderStatus[]>([]);
  const [systemInfo] = useState<SystemInfo>(getSystemInfo());

  const updateProviderStatuses = async () => {
    if (!providers) {
      return;
    }

    try {
      const entries = Object.entries(providers) as [string, IProviderConfig][];
      const statuses = await Promise.all(
        entries
          .filter(([, provider]) => LOCAL_PROVIDERS.includes(provider.name))
          .map(async ([, provider]) => {
            const envVarName =
              providerBaseUrlEnvKeys[provider.name].baseUrlKey || `REACT_APP_${provider.name.toUpperCase()}_URL`;

            let settingsUrl = provider.settings.baseUrl;

            if (settingsUrl && settingsUrl.trim().length === 0) {
              settingsUrl = undefined;
            }

            const url = settingsUrl || import.meta.env[envVarName] || null;
            console.log(`[Debug] Using URL for ${provider.name}:`, url, `(from ${envVarName})`);

            const status = await checkProviderStatus(url, provider.name);

            return {
              ...status,
              enabled: provider.settings.enabled ?? false,
            };
          }),
      );

      setActiveProviders(statuses);
    } catch (error) {
      console.error('[Debug] Failed to update provider statuses:', error);
    }
  };

  useEffect(() => {
    updateProviderStatuses();

    const interval = setInterval(updateProviderStatuses, 30000);

    return () => clearInterval(interval);
  }, [providers]);

  const handleCopyToClipboard = useCallback(() => {
    const debugInfo = {
      System: systemInfo,
      Providers: activeProviders.map((provider) => ({
        name: provider.name,
        enabled: provider.enabled,
        isLocal: provider.isLocal,
        running: provider.isRunning,
        error: provider.error,
        lastChecked: provider.lastChecked,
        responseTime: provider.responseTime,
        url: provider.url,
      })),
    };

    navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2)).then(() => {
      toast.success('Debug information copied to clipboard!');
    });
  }, [activeProviders, systemInfo]);

  return (
    <div className="p-4 space-y-6">
      {/* System Information */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-bolt-elements-textPrimary">Debug Information</h3>
          <button
            onClick={handleCopyToClipboard}
            className="px-4 py-2 bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text rounded hover:bg-bolt-elements-button-primary-backgroundHover transition-colors"
          >
            Copy Debug Info
          </button>
        </div>

        <div className="bg-bolt-elements-surface rounded-lg p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-bolt-elements-textSecondary">Operating System</p>
              <p className="text-sm font-medium text-bolt-elements-textPrimary">{systemInfo.os}</p>
            </div>
            <div>
              <p className="text-xs text-bolt-elements-textSecondary">Device Type</p>
              <p className="text-sm font-medium text-bolt-elements-textPrimary">{systemInfo.deviceType}</p>
            </div>
            <div>
              <p className="text-xs text-bolt-elements-textSecondary">Browser</p>
              <p className="text-sm font-medium text-bolt-elements-textPrimary">{systemInfo.browser}</p>
            </div>
            <div>
              <p className="text-xs text-bolt-elements-textSecondary">Display</p>
              <p className="text-sm font-medium text-bolt-elements-textPrimary">
                {systemInfo.screen} ({systemInfo.colorDepth}) @{systemInfo.pixelRatio}x
              </p>
            </div>
            <div>
              <p className="text-xs text-bolt-elements-textSecondary">Connection</p>
              <p className="text-sm font-medium flex items-center gap-2">
                <span
                  className={`inline-block w-2 h-2 rounded-full ${systemInfo.online ? 'bg-green-500' : 'bg-red-500'}`}
                />
                <span className={`${systemInfo.online ? 'text-green-600' : 'text-red-600'}`}>
                  {systemInfo.online ? 'Online' : 'Offline'}
                </span>
              </p>
            </div>
            <div>
              <p className="text-xs text-bolt-elements-textSecondary">Screen Resolution</p>
              <p className="text-sm font-medium text-bolt-elements-textPrimary">{systemInfo.screen}</p>
            </div>
            <div>
              <p className="text-xs text-bolt-elements-textSecondary">Language</p>
              <p className="text-sm font-medium text-bolt-elements-textPrimary">{systemInfo.language}</p>
            </div>
            <div>
              <p className="text-xs text-bolt-elements-textSecondary">Timezone</p>
              <p className="text-sm font-medium text-bolt-elements-textPrimary">{systemInfo.timezone}</p>
            </div>
            <div>
              <p className="text-xs text-bolt-elements-textSecondary">CPU Cores</p>
              <p className="text-sm font-medium text-bolt-elements-textPrimary">{systemInfo.cores}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Local LLM Status */}
      <div>
        <h4 className="text-md font-medium text-bolt-elements-textPrimary mb-2">Local LLM Status</h4>
        <div className="bg-bolt-elements-surface rounded-lg">
          {activeProviders.length > 0 ? (
            <div className="divide-y divide-bolt-elements-surface-hover">
              {activeProviders.map((provider) => (
                <div key={provider.name} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="text-sm font-medium text-bolt-elements-textPrimary">{provider.name}</h5>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block w-2 h-2 rounded-full ${
                          provider.isRunning ? 'bg-green-500' : 'bg-red-500'
                        }`}
                      />
                      <span className="text-sm text-bolt-elements-textSecondary">
                        {provider.isRunning ? 'Running' : 'Not Running'}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-bolt-elements-textSecondary">
                      URL: <span className="font-mono">{provider.url || 'Not configured'}</span>
                    </p>
                    <p className="text-xs text-bolt-elements-textSecondary">
                      Last Checked: {provider.lastChecked.toLocaleString()}
                    </p>
                    {provider.responseTime && (
                      <p className="text-xs text-bolt-elements-textSecondary">
                        Response Time: {Math.round(provider.responseTime)}ms
                      </p>
                    )}
                    {provider.error && <p className="text-xs text-red-500">Error: {provider.error}</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="p-4 text-sm text-bolt-elements-textSecondary">No local providers configured</p>
          )}
        </div>
      </div>
    </div>
  );
}
