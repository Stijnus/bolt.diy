import type { ReactNode } from 'react';

export type SettingCategory = 'profile' | 'file_sharing' | 'connectivity' | 'system' | 'services' | 'preferences';

export type TabType =
  | 'profile'
  | 'settings'
  | 'notifications'
  | 'features'
  | 'data'
  | 'providers'
  | 'connection'
  | 'debug'
  | 'event-logs'
  | 'update';

export type WindowType = 'user' | 'developer';

export interface UserProfile {
  nickname: any;
  name: string;
  email: string;
  avatar?: string;
  theme: 'light' | 'dark' | 'system';
  notifications: boolean;
  password?: string;
  bio?: string;
  language: string;
  timezone: string;
}

export interface SettingItem {
  id: TabType;
  label: string;
  icon: string;
  category: SettingCategory;
  description?: string;
  component: () => ReactNode;
  badge?: string;
  keywords?: string[];
}

export interface TabVisibilityConfig {
  id: TabType;
  visible: boolean;
  window: 'user' | 'developer';
  order: number;
  locked?: boolean;
}

export interface TabWindowConfig {
  userTabs: TabVisibilityConfig[];
  developerTabs: TabVisibilityConfig[];
}

export const TAB_LABELS: Record<TabType, string> = {
  profile: 'Profile',
  settings: 'Settings',
  notifications: 'Notifications',
  features: 'Features',
  data: 'Data',
  providers: 'Providers',
  connection: 'Connection',
  debug: 'Debug',
  'event-logs': 'Event Logs',
  update: 'Update',
};

export const DEFAULT_TAB_CONFIG: TabVisibilityConfig[] = [
  // User Window Tabs (Visible by default)
  { id: 'features', visible: true, window: 'user', order: 0 },
  { id: 'data', visible: true, window: 'user', order: 1 },
  { id: 'providers', visible: true, window: 'user', order: 2 },
  { id: 'connection', visible: true, window: 'user', order: 3 },
  { id: 'debug', visible: true, window: 'user', order: 4 },

  // User Window Tabs (Hidden by default)
  { id: 'profile', visible: false, window: 'user', order: 5 },
  { id: 'settings', visible: false, window: 'user', order: 6 },
  { id: 'notifications', visible: false, window: 'user', order: 7 },
  { id: 'event-logs', visible: false, window: 'user', order: 8 },
  { id: 'update', visible: false, window: 'user', order: 9 },

  // Developer Window Tabs (All visible by default)
  { id: 'profile', visible: true, window: 'developer', order: 0 },
  { id: 'settings', visible: true, window: 'developer', order: 1 },
  { id: 'notifications', visible: true, window: 'developer', order: 2 },
  { id: 'features', visible: true, window: 'developer', order: 3 },
  { id: 'data', visible: true, window: 'developer', order: 4 },
  { id: 'providers', visible: true, window: 'developer', order: 5 },
  { id: 'connection', visible: true, window: 'developer', order: 6 },
  { id: 'debug', visible: true, window: 'developer', order: 7 },
  { id: 'event-logs', visible: true, window: 'developer', order: 8 },
  { id: 'update', visible: true, window: 'developer', order: 9 },
];

export const categoryLabels: Record<SettingCategory, string> = {
  profile: 'Profile & Account',
  file_sharing: 'File Sharing',
  connectivity: 'Connectivity',
  system: 'System',
  services: 'Services',
  preferences: 'Preferences',
};

export const categoryIcons: Record<SettingCategory, string> = {
  profile: 'i-ph:user-circle',
  file_sharing: 'i-ph:folder-simple',
  connectivity: 'i-ph:wifi-high',
  system: 'i-ph:gear',
  services: 'i-ph:cube',
  preferences: 'i-ph:sliders',
};
