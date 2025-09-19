// Type definitions

// User Authentication Types
export interface User {
  id: string;
  email: string;
  username: string;
  name: string;
  avatar?: string;
  bio?: string;
  createdAt: string;
  lastLoginAt?: string;
  emailVerified: boolean;
  isActive: boolean;
  currentOrganizationId?: string;
  preferences: UserPreferences;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  notifications: {
    email: boolean;
    browser: boolean;
    teamInvites: boolean;
    projectUpdates: boolean;
    featureAssignments: boolean;
  };
  timezone: string;
}

export interface AuthSession {
  user: User;
  token: string;
  expiresAt: string;
  refreshToken: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  username: string;
  name: string;
}

export interface PasswordReset {
  email: string;
  token?: string;
  newPassword?: string;
}

// Organization Types
export interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo?: string;
  website?: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  settings: OrganizationSettings;
  subscription?: OrganizationSubscription;
}

export interface OrganizationSettings {
  allowPublicProjects: boolean;
  defaultProjectVisibility: 'public' | 'private';
  requireTwoFactor: boolean;
  allowedDomains: string[];
  maxTeamSize: number;
  enableSSO: boolean;
}

export interface OrganizationSubscription {
  plan: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'cancelled' | 'past_due';
  currentPeriodEnd: string;
  maxUsers: number;
  maxProjects: number;
}

export interface OrganizationMember {
  id: string;
  userId: string;
  organizationId: string;
  role: OrganizationRole;
  status: 'active' | 'invited' | 'suspended';
  joinedAt: string;
  invitedBy?: string;
  permissions: OrganizationPermission[];
}

export type OrganizationRole = 'owner' | 'admin' | 'member';

export type OrganizationPermission =
  | 'manage_organization'
  | 'manage_teams'
  | 'manage_projects'
  | 'manage_billing'
  | 'invite_members'
  | 'view_analytics';

export type FeatureStatus = 'pending' | 'in-progress' | 'completed' | 'blocked' | 'cancelled';
export type FeaturePriority = 'low' | 'medium' | 'high' | 'critical';
export type FeatureComplexity = 'simple' | 'medium' | 'complex' | 'epic';

export interface FeatureTimeTracking {
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  estimatedHours?: number;
  actualHours?: number;
  lastUpdated: string;
}

export interface FeatureAnalytics {
  priority: FeaturePriority;
  complexity: FeatureComplexity;
  tags: string[];
  assignee?: string;
  dependencies: string[]; // Feature IDs this feature depends on
  blockedBy?: string; // Feature ID or external reason
}

export interface Feature {
  id: string;
  name: string;
  branchRef: string;
  status: FeatureStatus;
  description?: string;
  branchFrom: string;
  head: string;

  // Enhanced fields for analytics and time tracking
  timeTracking: FeatureTimeTracking;
  analytics: FeatureAnalytics;
}

export interface Branch {
  name: string;
  author: string;
  updated: string;
  commitHash?: string;
  isActive?: boolean;
  commitCount?: number;
}

export interface ProjectAnalytics {
  totalCommits: number;
  totalHoursTracked: number;
  averageFeatureCompletionTime: number;
  completionRate: number;
  activeDevelopers: string[];
  lastActivityDate: string;
  velocityTrend: number[]; // Last 7 periods completion count
}

export interface ProjectSettings {
  defaultAssignee?: string;
  defaultPriority: FeaturePriority;
  autoTimeTracking: boolean;
  notifications: {
    deadlineAlerts: boolean;
    statusUpdates: boolean;
    weeklyReports: boolean;
  };
}

export interface Project {
  id: string;
  name: string;
  gitUrl: string;
  features: Feature[];
  branches: Branch[];
  lastUpdated?: string;
  description?: string;
  source?: 'git' | 'webcontainer' | 'template';
  snapshotId?: string;

  // Enhanced analytics and settings
  analytics: ProjectAnalytics;
  settings: ProjectSettings;
  createdAt: string;
  archived?: boolean;

  // Team management
  teamId?: string;
  ownerId: string;
  collaborators: string[]; // Array of user IDs
}

export interface NewFeature {
  name: string;
  branchRef: string;
  description: string;
  branchFrom: string;
  srcOid?: string;

  // Enhanced creation fields
  priority?: FeaturePriority;
  complexity?: FeatureComplexity;
  estimatedHours?: number;
  assignee?: string;
  tags?: string[];
  dependencies?: string[];
}

// Filter and view types
export interface ProjectFilter {
  status?: FeatureStatus[];
  priority?: FeaturePriority[];
  assignee?: string[];
  tags?: string[];
  dateRange?: {
    start: string;
    end: string;
  };
  searchTerm?: string;
}

export type ProjectViewMode = 'cards' | 'kanban' | 'timeline' | 'analytics';

export interface ProjectViewState {
  mode: ProjectViewMode;
  filter: ProjectFilter;
  sortBy: 'name' | 'priority' | 'status' | 'createdAt' | 'updatedAt';
  sortOrder: 'asc' | 'desc';
}

// Analytics chart data types
export interface ChartDataPoint {
  label: string;
  value: number;
  date?: string;
}

export interface VelocityMetrics {
  featuresCompletedLast7Days: number;
  featuresCompletedLast30Days: number;
  averageCompletionTime: number;
  totalActiveFeatures: number;
  burndownData: ChartDataPoint[];
  velocityTrend: ChartDataPoint[];
}

// Team Management Types
export interface TeamMember {
  id: string;
  userId: string;
  email: string;
  name: string;
  avatar?: string;
  role: TeamRole;
  status: 'active' | 'invited' | 'inactive';
  joinedAt: string;
  lastActive?: string;
  permissions: TeamPermission[];
  projects: string[]; // Array of project IDs
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  organizationId?: string;
  members: TeamMember[];
  createdAt: string;
  updatedAt: string;
  projects: string[]; // Array of project IDs
  settings: TeamSettings;
}

export interface TeamSettings {
  allowInvites: boolean;
  defaultRole: TeamRole;
  requireApprovalForNewMembers: boolean;
  enableTimeTracking: boolean;
  enableAnalytics: boolean;
}

export type TeamRole = 'owner' | 'admin' | 'developer' | 'viewer';

export type TeamPermission =
  | 'manage_team' // Add/remove members, change settings
  | 'manage_projects' // Create/delete projects
  | 'manage_features' // Create/edit/delete features
  | 'view_analytics' // Access analytics dashboard
  | 'manage_settings' // Change project settings
  | 'invite_members' // Send invitations
  | 'manage_branches' // Create/merge branches
  | 'start_chats' // Start feature chats
  | 'view_time_tracking' // View time tracking data
  | 'manage_time_tracking'; // Start/stop timers for others

export interface TeamInvitation {
  id: string;
  teamId: string;
  email: string;
  role: TeamRole;
  invitedBy: string;
  invitedAt: string;
  expiresAt: string;
  token: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
}

export interface NewTeamMember {
  email: string;
  role: TeamRole;
  permissions?: TeamPermission[];
}

export interface TeamActivity {
  id: string;
  teamId: string;
  userId: string;
  userName: string;
  action: TeamActivityType;
  details: Record<string, any>;
  timestamp: string;
}

export type TeamActivityType =
  | 'team_created'
  | 'member_joined'
  | 'member_left'
  | 'member_role_changed'
  | 'project_created'
  | 'project_deleted'
  | 'feature_created'
  | 'feature_completed'
  | 'chat_started'
  | 'settings_changed';

// Role-based permission defaults
export const ROLE_PERMISSIONS: Record<TeamRole, TeamPermission[]> = {
  owner: [
    'manage_team',
    'manage_projects',
    'manage_features',
    'view_analytics',
    'manage_settings',
    'invite_members',
    'manage_branches',
    'start_chats',
    'view_time_tracking',
    'manage_time_tracking',
  ],
  admin: [
    'manage_projects',
    'manage_features',
    'view_analytics',
    'manage_settings',
    'invite_members',
    'manage_branches',
    'start_chats',
    'view_time_tracking',
    'manage_time_tracking',
  ],
  developer: ['manage_features', 'view_analytics', 'manage_branches', 'start_chats', 'view_time_tracking'],
  viewer: ['view_analytics', 'start_chats', 'view_time_tracking'],
};

// Helper function to check if a user has a specific permission
export const hasPermission = (member: TeamMember, permission: TeamPermission): boolean => {
  return member.permissions.includes(permission) || ROLE_PERMISSIONS[member.role].includes(permission);
};

// Helper function to get default permissions for a role
export const getDefaultPermissions = (role: TeamRole): TeamPermission[] => {
  return [...ROLE_PERMISSIONS[role]];
};
