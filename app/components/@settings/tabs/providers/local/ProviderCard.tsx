import React, { useState, useEffect } from 'react';
import { Switch } from '~/components/ui/Switch';
import { Card, CardContent } from '~/components/ui/Card';
import { Link, Server, Monitor, Globe, Key } from 'lucide-react';
import { classNames } from '~/utils/classNames';
import type { IProviderConfig } from '~/types/model';
import { PROVIDER_DESCRIPTIONS } from './types';
import Cookies from 'js-cookie';

// Provider Card Component
/**
 * ProviderCard manages configuration for local providers (Ollama, LM Studio, OpenAI-like).
 *
 * Ollama-specific logic:
 * - Local Ollama (localhost/127.0.0.1): Shows informational message, no API key needed
 * - Cloud Ollama (remote endpoints): Shows API key input field for authentication
 */
interface ProviderCardProps {
  provider: IProviderConfig;
  onToggle: (enabled: boolean) => void;
  onUpdateBaseUrl: (url: string) => void;
  isEditing: boolean;
  onStartEditing: () => void;
  onStopEditing: () => void;
}

function ProviderCard({
  provider,
  onToggle,
  onUpdateBaseUrl,
  isEditing,
  onStartEditing,
  onStopEditing,
}: ProviderCardProps) {
  const [isApiKeyEditing, setIsApiKeyEditing] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [tempApiKey, setTempApiKey] = useState('');

  const isLocalOllama =
    provider.settings.baseUrl?.includes('localhost') || provider.settings.baseUrl?.includes('127.0.0.1');
  const isCloudOllama = provider.name === 'Ollama' && !isLocalOllama;

  useEffect(() => {
    if (provider.name === 'Ollama') {
      const storedKeys = Cookies.get('apiKeys');

      if (storedKeys) {
        try {
          const parsedKeys = JSON.parse(storedKeys);
          setApiKey(parsedKeys.Ollama || '');
          setTempApiKey(parsedKeys.Ollama || '');
        } catch (e) {
          console.error('Error parsing API keys from cookie', e);
        }
      }
    }
  }, [provider.name]);

  const saveApiKey = () => {
    const storedKeys = Cookies.get('apiKeys');
    let parsedKeys: Record<string, string> = {};

    if (storedKeys) {
      try {
        parsedKeys = JSON.parse(storedKeys);
      } catch (e) {
        console.error('Error parsing API keys from cookie', e);
      }
    }

    const newKeys = { ...parsedKeys, Ollama: tempApiKey };
    Cookies.set('apiKeys', JSON.stringify(newKeys));
    setApiKey(tempApiKey);
    setIsApiKeyEditing(false);
  };

  const getIcon = (providerName: string) => {
    switch (providerName) {
      case 'Ollama':
        return Server;
      case 'LMStudio':
        return Monitor;
      case 'OpenAILike':
        return Globe;
      default:
        return Server;
    }
  };

  const Icon = getIcon(provider.name);

  return (
    <Card className="bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3 transition-all duration-300 shadow-sm hover:shadow-md border border-bolt-elements-borderColor hover:border-purple-500/30">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1">
            <div
              className={classNames(
                'w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300',
                provider.settings.enabled
                  ? 'bg-gradient-to-br from-purple-500/20 to-purple-600/20 ring-1 ring-purple-500/30'
                  : 'bg-bolt-elements-background-depth-3',
              )}
            >
              <Icon
                className={classNames(
                  'w-6 h-6 transition-all duration-300',
                  provider.settings.enabled ? 'text-purple-500' : 'text-bolt-elements-textTertiary',
                )}
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-lg font-semibold text-bolt-elements-textPrimary">{provider.name}</h3>
                <span className="px-2 py-1 text-xs rounded-full bg-green-500/10 text-green-500 font-medium">Local</span>
              </div>
              <p className="text-sm text-bolt-elements-textSecondary mb-4">
                {PROVIDER_DESCRIPTIONS[provider.name as keyof typeof PROVIDER_DESCRIPTIONS]}
              </p>

              {provider.settings.enabled && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-bolt-elements-textPrimary">API Endpoint</label>
                    {isEditing ? (
                      <input
                        type="text"
                        defaultValue={provider.settings.baseUrl}
                        placeholder={`Enter ${provider.name} base URL`}
                        className="w-full px-4 py-3 rounded-lg text-sm bg-bolt-elements-background-depth-4 border border-purple-500/30 text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all duration-200 shadow-sm"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            onUpdateBaseUrl(e.currentTarget.value);
                            onStopEditing();
                          } else if (e.key === 'Escape') {
                            onStopEditing();
                          }
                        }}
                        onBlur={(e) => {
                          onUpdateBaseUrl(e.target.value);
                          onStopEditing();
                        }}
                        autoFocus
                      />
                    ) : (
                      <button
                        onClick={onStartEditing}
                        className="w-full px-4 py-3 rounded-lg text-sm bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor hover:border-purple-500/30 hover:bg-bolt-elements-background-depth-4 hover:shadow-sm transition-all duration-200 text-left group"
                      >
                        <div className="flex items-center gap-3 text-bolt-elements-textSecondary group-hover:text-bolt-elements-textPrimary">
                          <Link className="w-4 h-4 group-hover:text-purple-500 transition-colors" />
                          <span className="font-mono">{provider.settings.baseUrl || 'Click to set base URL'}</span>
                        </div>
                      </button>
                    )}
                  </div>

                  {provider.name === 'Ollama' && isLocalOllama && (
                    <p className="text-xs text-bolt-elements-textSecondary bg-blue-500/10 border border-blue-500/20 rounded px-3 py-2">
                      ℹ️ Local Ollama doesn't require authentication. If using a remote/cloud endpoint, update the base
                      URL.
                    </p>
                  )}

                  {provider.name === 'Ollama' && isCloudOllama && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-bolt-elements-textPrimary">Cloud API Key</label>
                        {apiKey && !isApiKeyEditing && (
                          <span className="text-xs text-green-500 flex items-center gap-1">
                            <span className="w-2 h-2 bg-green-500 rounded-full"></span> Set
                          </span>
                        )}
                      </div>
                      {isApiKeyEditing ? (
                        <div className="flex gap-2 items-center">
                          <input
                            type="password"
                            value={tempApiKey}
                            onChange={(e) => setTempApiKey(e.target.value)}
                            placeholder="Enter Ollama Cloud API Key"
                            className="flex-1 px-4 py-3 rounded-lg text-sm bg-bolt-elements-background-depth-4 border border-purple-500/30 text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all duration-200 shadow-sm"
                          />
                          <button
                            onClick={saveApiKey}
                            className="px-3 py-3 rounded-lg text-sm bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-500 transition-all duration-200"
                            title="Save API Key"
                            aria-label="Save Ollama Cloud API Key"
                          >
                            <span className="text-lg">✓</span>
                          </button>
                          <button
                            onClick={() => {
                              setIsApiKeyEditing(false);
                              setTempApiKey(apiKey);
                            }}
                            className="px-3 py-3 rounded-lg text-sm bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-500 transition-all duration-200"
                            title="Cancel"
                            aria-label="Cancel API Key edit"
                          >
                            <span className="text-lg">✕</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setIsApiKeyEditing(true)}
                          className="w-full px-4 py-3 rounded-lg text-sm bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor hover:border-purple-500/30 hover:bg-bolt-elements-background-depth-4 hover:shadow-sm transition-all duration-200 text-left group"
                        >
                          <div className="flex items-center gap-3 text-bolt-elements-textSecondary group-hover:text-bolt-elements-textPrimary">
                            <Key className="w-4 h-4 group-hover:text-purple-500 transition-colors" />
                            <span className="font-mono">{apiKey ? '••••••••' : 'Click to set API Key'}</span>
                          </div>
                        </button>
                      )}
                      <p className="text-xs text-bolt-elements-textSecondary">
                        Get your API key from{' '}
                        <a
                          href="https://ollama.com/blog/ollama-cloud"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-purple-500 hover:underline"
                        >
                          Ollama Cloud
                        </a>
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <Switch
            checked={provider.settings.enabled}
            onCheckedChange={onToggle}
            aria-label={`Toggle ${provider.name} provider`}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export default ProviderCard;
