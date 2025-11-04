import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Switch } from '~/components/ui/Switch';
import { Card, CardContent, CardHeader } from '~/components/ui/Card';
import { Button } from '~/components/ui/Button';
import { useSettings } from '~/lib/hooks/useSettings';
import { LOCAL_PROVIDERS } from '~/lib/stores/settings';
import type { IProviderConfig } from '~/types/model';
import { logStore } from '~/lib/stores/logs';
import { providerBaseUrlEnvKeys } from '~/utils/constants';
import { useToast } from '~/components/ui/use-toast';
import { useLocalModelHealth } from '~/lib/hooks/useLocalModelHealth';
import ErrorBoundary from './ErrorBoundary';
import { ModelCardSkeleton } from './LoadingSkeleton';
import SetupGuide from './SetupGuide';
import StatusDashboard from './StatusDashboard';
import ProviderCard from './ProviderCard';
import ModelCard from './ModelCard';
import { OLLAMA_API_URL } from './types';
import type { OllamaModel, LMStudioModel } from './types';
import { Cpu, Server, BookOpen, Activity, PackageOpen, Monitor, Loader2, RotateCw, ExternalLink } from 'lucide-react';

// Type definitions
type ViewMode = 'dashboard' | 'guide' | 'status';

/**
 * LocalProvidersTab manages local AI model providers (Ollama, LM Studio, OpenAI-like).
 *
 * Key distinctions:
 * - Local Ollama: Runs on localhost/127.0.0.1, doesn't require authentication
 * - Cloud Ollama: Remote Ollama Cloud service, requires API key authentication
 * - LM Studio: Local inference server, no authentication typically needed
 * - OpenAI-like: Compatible API endpoints, may require authentication
 */

export default function LocalProvidersTab() {
  const { providers, updateProviderSettings } = useSettings();
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
  const [lmStudioModels, setLMStudioModels] = useState<LMStudioModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isLoadingLMStudioModels, setIsLoadingLMStudioModels] = useState(false);
  const [ollamaError, setOllamaError] = useState<string | null>(null);
  const [lmStudioError, setLMStudioError] = useState<string | null>(null);
  const { toast } = useToast();
  const { startMonitoring, stopMonitoring } = useLocalModelHealth();

  // Memoized filtered providers to prevent unnecessary re-renders
  const filteredProviders = useMemo(() => {
    return Object.entries(providers || {})
      .filter(([key]) => [...LOCAL_PROVIDERS, 'OpenAILike'].includes(key))
      .map(([key, value]) => {
        const provider = value as IProviderConfig;
        const envKey = providerBaseUrlEnvKeys[key]?.baseUrlKey;
        const envUrl = envKey ? (import.meta.env[envKey] as string | undefined) : undefined;

        // Set default base URLs for local providers
        let defaultBaseUrl = provider.settings.baseUrl || envUrl;

        if (!defaultBaseUrl) {
          if (key === 'Ollama') {
            defaultBaseUrl = 'http://127.0.0.1:11434';
          } else if (key === 'LMStudio') {
            defaultBaseUrl = 'http://127.0.0.1:1234';
          }
        }

        return {
          name: key,
          settings: {
            ...provider.settings,
            baseUrl: defaultBaseUrl,
          },
          staticModels: provider.staticModels || [],
          getDynamicModels: provider.getDynamicModels,
          getApiKeyLink: provider.getApiKeyLink,
          labelForGetApiKey: provider.labelForGetApiKey,
          icon: provider.icon,
        } as IProviderConfig;
      })
      .sort((a, b) => {
        // Custom sort: Ollama first, then LMStudio, then OpenAILike
        const order = { Ollama: 0, LMStudio: 1, OpenAILike: 2 };
        return (order[a.name as keyof typeof order] || 3) - (order[b.name as keyof typeof order] || 3);
      });
  }, [providers]);

  const categoryEnabled = useMemo(() => {
    return filteredProviders.length > 0 && filteredProviders.every((p) => p.settings.enabled);
  }, [filteredProviders]);

  // Start/stop health monitoring for enabled providers
  useEffect(() => {
    filteredProviders.forEach((provider) => {
      const baseUrl = provider.settings.baseUrl;

      if (provider.settings.enabled && baseUrl) {
        console.log(`[LocalProvidersTab] Starting monitoring for ${provider.name} at ${baseUrl}`);
        startMonitoring(provider.name as 'Ollama' | 'LMStudio' | 'OpenAILike', baseUrl);
      } else if (!provider.settings.enabled && baseUrl) {
        console.log(`[LocalProvidersTab] Stopping monitoring for ${provider.name} at ${baseUrl}`);
        stopMonitoring(provider.name as 'Ollama' | 'LMStudio' | 'OpenAILike', baseUrl);
      }
    });
  }, [filteredProviders, startMonitoring, stopMonitoring]);

  // Fetch Ollama models when enabled
  useEffect(() => {
    const ollamaProvider = filteredProviders.find((p) => p.name === 'Ollama');

    if (ollamaProvider?.settings.enabled) {
      fetchOllamaModels();
    }
  }, [filteredProviders]);

  // Fetch LM Studio models when enabled
  useEffect(() => {
    const lmStudioProvider = filteredProviders.find((p) => p.name === 'LMStudio');

    if (lmStudioProvider?.settings.enabled && lmStudioProvider.settings.baseUrl) {
      fetchLMStudioModels(lmStudioProvider.settings.baseUrl);
    }
  }, [filteredProviders]);

  const fetchOllamaModels = async () => {
    try {
      setIsLoadingModels(true);
      setOllamaError(null);

      const ollamaProvider = filteredProviders.find((p) => p.name === 'Ollama');
      const baseUrl = ollamaProvider?.settings.baseUrl || OLLAMA_API_URL;

      const isLocalOllama = baseUrl?.includes('localhost') || baseUrl?.includes('127.0.0.1');
      const isCloudOllama = !isLocalOllama;

      const response = await fetch(`${baseUrl}/api/tags`);

      if (!response.ok) {
        let errorMsg = `Failed to fetch models (${response.status})`;

        if (response.status === 401 || response.status === 403) {
          errorMsg = isCloudOllama
            ? 'Authentication failed. Please verify your Ollama Cloud API key.'
            : "Authentication failed. Local Ollama typically doesn't require authentication.";
        } else if (response.status === 404) {
          errorMsg = isCloudOllama
            ? 'Ollama Cloud service not found. Please verify the API endpoint.'
            : 'Ollama service not found. Make sure Ollama is running at the specified endpoint.';
        }

        throw new Error(errorMsg);
      }

      const data = (await response.json()) as { models: OllamaModel[] };
      setOllamaModels(
        data.models.map((model) => ({
          ...model,
          status: 'idle' as const,
        })),
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch Ollama models';
      setOllamaError(errorMessage);
      console.error('Error fetching Ollama models:', error);
      toast(errorMessage, { type: 'error' });
    } finally {
      setIsLoadingModels(false);
    }
  };

  const fetchLMStudioModels = async (baseUrl: string) => {
    try {
      setIsLoadingLMStudioModels(true);
      setLMStudioError(null);

      const response = await fetch(`${baseUrl}/v1/models`);

      if (!response.ok) {
        const errorMsg =
          response.status === 404
            ? 'LM Studio service not found. Make sure LM Studio is running and the server is started.'
            : `Failed to fetch LM Studio models (${response.status})`;
        throw new Error(errorMsg);
      }

      const data = (await response.json()) as { data: LMStudioModel[] };
      setLMStudioModels(data.data || []);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch LM Studio models';
      setLMStudioError(errorMessage);
      console.error('Error fetching LM Studio models:', error);
      toast(errorMessage, { type: 'error' });
    } finally {
      setIsLoadingLMStudioModels(false);
    }
  };

  const handleToggleCategory = useCallback(
    async (enabled: boolean) => {
      filteredProviders.forEach((provider) => {
        updateProviderSettings(provider.name, { ...provider.settings, enabled });
      });
      toast(enabled ? 'All local providers enabled' : 'All local providers disabled');
    },
    [filteredProviders, updateProviderSettings, toast],
  );

  const handleToggleProvider = useCallback(
    (provider: IProviderConfig, enabled: boolean) => {
      updateProviderSettings(provider.name, {
        ...provider.settings,
        enabled,
      });

      logStore.logProvider(`Provider ${provider.name} ${enabled ? 'enabled' : 'disabled'}`, {
        provider: provider.name,
      });
      toast(`${provider.name} ${enabled ? 'enabled' : 'disabled'}`);
    },
    [updateProviderSettings, toast],
  );

  const handleUpdateBaseUrl = useCallback(
    (provider: IProviderConfig, newBaseUrl: string) => {
      updateProviderSettings(provider.name, {
        ...provider.settings,
        baseUrl: newBaseUrl,
      });
      toast(`${provider.name} base URL updated`);
    },
    [updateProviderSettings, toast],
  );

  const handleUpdateOllamaModel = async (modelName: string) => {
    try {
      setOllamaModels((prev) => prev.map((m) => (m.name === modelName ? { ...m, status: 'updating' } : m)));

      const response = await fetch(`${OLLAMA_API_URL}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update ${modelName}`);
      }

      // Handle streaming response
      const reader = response.body?.getReader();

      if (!reader) {
        throw new Error('No response reader available');
      }

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        const text = new TextDecoder().decode(value);
        const lines = text.split('\n').filter(Boolean);

        for (const line of lines) {
          try {
            const data = JSON.parse(line);

            if (data.status && data.completed && data.total) {
              setOllamaModels((current) =>
                current.map((m) =>
                  m.name === modelName
                    ? {
                        ...m,
                        progress: {
                          current: data.completed,
                          total: data.total,
                          status: data.status,
                        },
                      }
                    : m,
                ),
              );
            }
          } catch {
            // Ignore parsing errors
          }
        }
      }

      setOllamaModels((prev) =>
        prev.map((m) => (m.name === modelName ? { ...m, status: 'updated', progress: undefined } : m)),
      );
      toast(`Successfully updated ${modelName}`);
    } catch {
      setOllamaModels((prev) =>
        prev.map((m) => (m.name === modelName ? { ...m, status: 'error', progress: undefined } : m)),
      );
      toast(`Failed to update ${modelName}`, { type: 'error' });
    }
  };

  const handleDeleteOllamaModel = async (modelName: string) => {
    if (!window.confirm(`Are you sure you want to delete ${modelName}?`)) {
      return;
    }

    try {
      const response = await fetch(`${OLLAMA_API_URL}/api/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName }),
      });

      if (!response.ok) {
        throw new Error(`Failed to delete ${modelName}`);
      }

      setOllamaModels((current) => current.filter((m) => m.name !== modelName));
      toast(`Deleted ${modelName}`);
    } catch {
      toast(`Failed to delete ${modelName}`, { type: 'error' });
    }
  };

  // Render different views based on viewMode
  if (viewMode === 'guide') {
    return (
      <ErrorBoundary>
        <SetupGuide onBack={() => setViewMode('dashboard')} />
      </ErrorBoundary>
    );
  }

  if (viewMode === 'status') {
    return (
      <ErrorBoundary>
        <StatusDashboard onBack={() => setViewMode('dashboard')} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center ring-1 ring-purple-500/30">
              <Cpu className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-bolt-elements-textPrimary">Local AI Providers</h2>
              <p className="text-sm text-bolt-elements-textSecondary">Configure and manage your local AI models</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-bolt-elements-textSecondary">Enable All</span>
              <Switch
                checked={categoryEnabled}
                onCheckedChange={handleToggleCategory}
                aria-label="Toggle all local providers"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode('guide')}
                className="bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3 border-bolt-elements-borderColor hover:border-purple-500/30 transition-all duration-200 gap-2"
              >
                <BookOpen className="w-4 h-4" />
                Setup Guide
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode('status')}
                className="bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3 border-bolt-elements-borderColor hover:border-purple-500/30 transition-all duration-200 gap-2"
              >
                <Activity className="w-4 h-4" />
                Status
              </Button>
            </div>
          </div>
        </div>

        {/* Provider Cards */}
        <div className="space-y-6">
          {filteredProviders.map((provider) => (
            <div key={provider.name} className="space-y-4">
              <ProviderCard
                provider={provider}
                onToggle={(enabled) => handleToggleProvider(provider, enabled)}
                onUpdateBaseUrl={(url) => handleUpdateBaseUrl(provider, url)}
                isEditing={editingProvider === provider.name}
                onStartEditing={() => setEditingProvider(provider.name)}
                onStopEditing={() => setEditingProvider(null)}
              />

              {/* Ollama Models Section */}
              {provider.name === 'Ollama' && provider.settings.enabled && (
                <Card className="mt-4 bg-bolt-elements-background-depth-2">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <PackageOpen className="w-5 h-5 text-purple-500" />
                        <h3 className="text-lg font-semibold text-bolt-elements-textPrimary">Installed Models</h3>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchOllamaModels}
                        disabled={isLoadingModels}
                        className="bg-transparent hover:bg-bolt-elements-background-depth-2"
                      >
                        {isLoadingModels ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <RotateCw className="w-4 h-4 mr-2" />
                        )}
                        Refresh
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {isLoadingModels ? (
                      <div className="space-y-4">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <ModelCardSkeleton key={i} />
                        ))}
                      </div>
                    ) : ollamaError ? (
                      <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-0.5">
                            <div className="flex items-center justify-center h-5 w-5 rounded-full bg-red-500/20">
                              <span className="text-red-500 text-xs font-bold">!</span>
                            </div>
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-red-500 mb-1">Failed to load models</p>
                            <p className="text-xs text-red-400 mb-3">{ollamaError}</p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={fetchOllamaModels}
                              disabled={isLoadingModels}
                              className="bg-red-500/10 hover:bg-red-500/20 border-red-500/30 text-red-500 text-xs"
                            >
                              Retry
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : ollamaModels.length === 0 ? (
                      <div className="text-center py-8">
                        <PackageOpen className="w-16 h-16 mx-auto text-bolt-elements-textTertiary mb-4" />
                        <h3 className="text-lg font-medium text-bolt-elements-textPrimary mb-2">No Models Installed</h3>
                        <p className="text-sm text-bolt-elements-textSecondary mb-4">
                          Visit{' '}
                          <a
                            href="https://ollama.com/library"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-purple-500 hover:underline inline-flex items-center gap-1"
                          >
                            ollama.com/library
                            <ExternalLink className="w-3 h-3" />
                          </a>{' '}
                          to browse available models
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="bg-gradient-to-r from-purple-500/8 to-purple-600/8 hover:from-purple-500/15 hover:to-purple-600/15 border-purple-500/25 hover:border-purple-500/40 transition-all duration-300 gap-2 group shadow-sm hover:shadow-md font-medium"
                          _asChild
                        >
                          <a
                            href="https://ollama.com/library"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2"
                          >
                            <ExternalLink className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-300 flex-shrink-0" />
                            <span className="flex-1 text-center font-medium">Browse Models</span>
                          </a>
                        </Button>
                      </div>
                    ) : (
                      <div className="grid gap-4">
                        {ollamaModels.map((model) => (
                          <ModelCard
                            key={model.name}
                            model={model}
                            onUpdate={() => handleUpdateOllamaModel(model.name)}
                            onDelete={() => handleDeleteOllamaModel(model.name)}
                          />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* LM Studio Models Section */}
              {provider.name === 'LMStudio' && provider.settings.enabled && (
                <Card className="mt-4 bg-bolt-elements-background-depth-2">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Monitor className="w-5 h-5 text-blue-500" />
                        <h3 className="text-lg font-semibold text-bolt-elements-textPrimary">Available Models</h3>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchLMStudioModels(provider.settings.baseUrl!)}
                        disabled={isLoadingLMStudioModels}
                        className="bg-transparent hover:bg-bolt-elements-background-depth-2"
                      >
                        {isLoadingLMStudioModels ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <RotateCw className="w-4 h-4 mr-2" />
                        )}
                        Refresh
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {isLoadingLMStudioModels ? (
                      <div className="space-y-4">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <ModelCardSkeleton key={i} />
                        ))}
                      </div>
                    ) : lmStudioError ? (
                      <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-0.5">
                            <div className="flex items-center justify-center h-5 w-5 rounded-full bg-red-500/20">
                              <span className="text-red-500 text-xs font-bold">!</span>
                            </div>
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-red-500 mb-1">Failed to load models</p>
                            <p className="text-xs text-red-400 mb-3">{lmStudioError}</p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => fetchLMStudioModels(provider.settings.baseUrl!)}
                              disabled={isLoadingLMStudioModels}
                              className="bg-red-500/10 hover:bg-red-500/20 border-red-500/30 text-red-500 text-xs"
                            >
                              Retry
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : lmStudioModels.length === 0 ? (
                      <div className="text-center py-8">
                        <Monitor className="w-16 h-16 mx-auto text-bolt-elements-textTertiary mb-4" />
                        <h3 className="text-lg font-medium text-bolt-elements-textPrimary mb-2">No Models Available</h3>
                        <p className="text-sm text-bolt-elements-textSecondary mb-4">
                          Make sure LM Studio is running with the local server started and CORS enabled.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="bg-gradient-to-r from-blue-500/8 to-blue-600/8 hover:from-blue-500/15 hover:to-blue-600/15 border-blue-500/25 hover:border-blue-500/40 transition-all duration-300 gap-2 group shadow-sm hover:shadow-md font-medium"
                          _asChild
                        >
                          <a
                            href="https://lmstudio.ai/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2"
                          >
                            <ExternalLink className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-300 flex-shrink-0" />
                            <span className="flex-1 text-center font-medium">Get LM Studio</span>
                          </a>
                        </Button>
                      </div>
                    ) : (
                      <div className="grid gap-4">
                        {lmStudioModels.map((model) => (
                          <Card key={model.id} className="bg-bolt-elements-background-depth-3">
                            <CardContent className="p-4">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-medium text-bolt-elements-textPrimary font-mono">
                                    {model.id}
                                  </h4>
                                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-500">
                                    Available
                                  </span>
                                </div>
                                <div className="flex items-center gap-4 text-xs text-bolt-elements-textSecondary">
                                  <div className="flex items-center gap-1">
                                    <Server className="w-3 h-3" />
                                    <span>{model.object}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Activity className="w-3 h-3" />
                                    <span>Owned by: {model.owned_by}</span>
                                  </div>
                                  {model.created && (
                                    <div className="flex items-center gap-1">
                                      <Activity className="w-3 h-3" />
                                      <span>Created: {new Date(model.created * 1000).toLocaleDateString()}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          ))}
        </div>

        {filteredProviders.length === 0 && (
          <Card className="bg-bolt-elements-background-depth-2">
            <CardContent className="p-8 text-center">
              <Server className="w-16 h-16 mx-auto text-bolt-elements-textTertiary mb-4" />
              <h3 className="text-lg font-medium text-bolt-elements-textPrimary mb-2">No Local Providers Available</h3>
              <p className="text-sm text-bolt-elements-textSecondary">
                Local providers will appear here when they're configured in the system.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </ErrorBoundary>
  );
}
