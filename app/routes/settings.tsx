import { useState, useMemo, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { Link, useNavigate, useSearchParams } from '@remix-run/react';
import BackgroundRays from '~/components/ui/BackgroundRays';
import { TabTile } from '~/components/@settings/shared/components/TabTile';
import { useFeatures } from '~/lib/hooks/useFeatures';
import { useNotifications } from '~/lib/hooks/useNotifications';
import { useConnectionStatus } from '~/lib/hooks/useConnectionStatus';
import { tabConfigurationStore, resetTabConfiguration } from '~/lib/stores/settings';
import { profileStore } from '~/lib/stores/profile';
import type { TabType, Profile } from '~/components/@settings/core/types';
import { TAB_LABELS, DEFAULT_TAB_CONFIG, TAB_DESCRIPTIONS } from '~/components/@settings/core/constants';
import ProfileTab from '~/components/@settings/tabs/profile/ProfileTab';
import SettingsTab from '~/components/@settings/tabs/settings/SettingsTab';
import NotificationsTab from '~/components/@settings/tabs/notifications/NotificationsTab';
import FeaturesTab from '~/components/@settings/tabs/features/FeaturesTab';
import { DataTab } from '~/components/@settings/tabs/data/DataTab';
import { EventLogsTab } from '~/components/@settings/tabs/event-logs/EventLogsTab';
import GitHubTab from '~/components/@settings/tabs/github/GitHubTab';
import GitLabTab from '~/components/@settings/tabs/gitlab/GitLabTab';
import SupabaseTab from '~/components/@settings/tabs/supabase/SupabaseTab';
import VercelTab from '~/components/@settings/tabs/vercel/VercelTab';
import NetlifyTab from '~/components/@settings/tabs/netlify/NetlifyTab';
import CloudProvidersTab from '~/components/@settings/tabs/providers/cloud/CloudProvidersTab';
import LocalProvidersTab from '~/components/@settings/tabs/providers/local/LocalProvidersTab';
import McpTab from '~/components/@settings/tabs/mcp/McpTab';
import { AvatarDropdown } from '~/components/@settings/core/AvatarDropdown';

const BETA_TABS = new Set<TabType>(['local-providers', 'mcp']);

const BetaLabel = () => (
  <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-purple-500/10 dark:bg-purple-500/20">
    <span className="text-[10px] font-medium text-purple-600 dark:text-purple-400">BETA</span>
  </div>
);

function getTabComponent(tabId: TabType | null) {
  switch (tabId) {
    case 'profile':
      return <ProfileTab />;
    case 'settings':
      return <SettingsTab />;
    case 'notifications':
      return <NotificationsTab />;
    case 'features':
      return <FeaturesTab />;
    case 'data':
      return <DataTab />;
    case 'cloud-providers':
      return <CloudProvidersTab />;
    case 'local-providers':
      return <LocalProvidersTab />;
    case 'github':
      return <GitHubTab />;
    case 'gitlab':
      return <GitLabTab />;
    case 'supabase':
      return <SupabaseTab />;
    case 'vercel':
      return <VercelTab />;
    case 'netlify':
      return <NetlifyTab />;
    case 'event-logs':
      return <EventLogsTab />;
    case 'mcp':
      return <McpTab />;
    default:
      return null;
  }
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabType | null>(null);
  const [loadingTab, setLoadingTab] = useState<TabType | null>(null);
  const tabConfiguration = useStore(tabConfigurationStore);
  const profile = useStore(profileStore) as Profile;
  const { hasNewFeatures, unviewedFeatures } = useFeatures();
  const { hasUnreadNotifications, unreadNotifications } = useNotifications();
  const { hasConnectionIssues, currentIssue } = useConnectionStatus();

  const baseTabConfig = useMemo(() => new Map(DEFAULT_TAB_CONFIG.map((tab) => [tab.id, tab])), []);

  const visibleTabs = useMemo(() => {
    if (!tabConfiguration?.userTabs || !Array.isArray(tabConfiguration.userTabs)) {
      resetTabConfiguration();
      return [];
    }

    const notificationsDisabled = profile?.preferences?.notifications === false;

    return tabConfiguration.userTabs
      .filter((tab) => {
        if (!tab?.id) {
          return false;
        }

        if (tab.id === 'notifications' && notificationsDisabled) {
          return false;
        }

        return tab.visible && tab.window === 'user';
      })
      .sort((a, b) => a.order - b.order);
  }, [tabConfiguration, profile?.preferences?.notifications, baseTabConfig]);

  const handleTabClick = (tabId: TabType) => {
    setLoadingTab(tabId);
    setActiveTab(tabId);

    setTimeout(() => setLoadingTab(null), 200);
    navigate(`/settings?tab=${tabId}`);
  };

  const getTabUpdateStatus = (tabId: TabType): boolean => {
    switch (tabId) {
      case 'features':
        return hasNewFeatures;
      case 'notifications':
        return hasUnreadNotifications;
      case 'github':
      case 'gitlab':
      case 'supabase':
      case 'vercel':
      case 'netlify':
        return hasConnectionIssues;
      default:
        return false;
    }
  };

  const getStatusMessage = (tabId: TabType): string => {
    switch (tabId) {
      case 'features':
        return `${unviewedFeatures.length} new feature${unviewedFeatures.length === 1 ? '' : 's'} to explore`;
      case 'notifications':
        return `${unreadNotifications.length} unread notification${unreadNotifications.length === 1 ? '' : 's'}`;
      case 'github':
      case 'gitlab':
      case 'supabase':
      case 'vercel':
      case 'netlify':
        return currentIssue === 'disconnected'
          ? 'Connection lost'
          : currentIssue === 'high-latency'
            ? 'High latency detected'
            : 'Connection issues detected';
      default:
        return '';
    }
  };

  const content = getTabComponent(activeTab);

  useEffect(() => {
    const tab = searchParams.get('tab');

    if (tab && (TAB_LABELS as Record<string, string>)[tab]) {
      setActiveTab(tab as TabType);
    } else {
      setActiveTab(null);
    }
  }, [searchParams]);

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-white via-white to-purple-50 dark:from-gray-950 dark:via-gray-950 dark:to-gray-900">
      <div className="absolute inset-0 overflow-hidden">
        <BackgroundRays />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-10 space-y-10">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-bolt-elements-textSecondary">
              <Link to="/" className="hover:underline">
                Home
              </Link>{' '}
              / Settings
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-bolt-elements-textPrimary">Control Panel</h1>
            <p className="mt-1 text-sm text-bolt-elements-textSecondary">
              Manage workspace preferences, integrations, and notifications from a single place.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <AvatarDropdown onSelectTab={handleTabClick} />
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 rounded-full border border-bolt-elements-borderColor px-4 py-2 text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:border-bolt-elements-textSecondary transition-colors"
            >
              <div className="i-ph:arrow-left w-4 h-4" />
              Back
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2/80 backdrop-blur shadow-xl">
          <div className="p-6">
            {content ? (
              <div className="space-y-6">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab(null);
                    navigate('/settings');
                  }}
                  className="inline-flex items-center gap-2 text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary"
                >
                  <div className="i-ph:arrow-left w-4 h-4" />
                  Control Panel
                </button>
                <div className="rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-3 p-4">
                  {content}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {visibleTabs.map((tab, index) => (
                  <div
                    key={tab.id}
                    className="relative aspect-[1.5/1] transition-transform duration-150 hover:scale-[1.01]"
                    style={{ animationDelay: `${index * 30}ms`, animation: 'fadeInUp 200ms ease-out forwards' }}
                  >
                    <TabTile
                      tab={tab}
                      onClick={() => handleTabClick(tab.id as TabType)}
                      isActive={activeTab === tab.id}
                      hasUpdate={getTabUpdateStatus(tab.id)}
                      statusMessage={getStatusMessage(tab.id)}
                      description={TAB_DESCRIPTIONS[tab.id]}
                      isLoading={loadingTab === tab.id}
                      className="h-full relative"
                    >
                      {BETA_TABS.has(tab.id) && <BetaLabel />}
                    </TabTile>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
