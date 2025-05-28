/**
 * TypeScript types for Cloudflare Pages API.
 * Based on documentation from:
 * - Get Project: https://developers.cloudflare.com/api/operations/pages-project-get-project
 * - Create Project: https://developers.cloudflare.com/api/operations/pages-project-create-project
 * - Create Deployment: https://developers.cloudflare.com/api/operations/pages-deployment-create-deployment
 * - Get Deployment Info: https://developers.cloudflare.com/api/operations/pages-deployment-get-deployment-info
 */

/**
 * Represents a single stage in a Cloudflare Pages deployment.
 */
export interface CloudflareDeploymentStage {
  name: 'queued' | 'initialize' | 'clone_repo' | 'build' | 'deploy' | 'cleanup' | 'failure';
  status: 'idle' | 'active' | 'success' | 'failure' | 'canceled';
  started_on?: string | null; // ISO 8601
  ended_on?: string | null;   // ISO 8601
}

/**
 * Information about a Cloudflare Pages deployment.
 * This is often nested in other responses like CloudflareProject.
 */
export interface CloudflareDeploymentInfo {
  id: string;
  short_id: string;
  project_id: string;
  project_name: string;
  environment: 'production' | 'preview';
  url: string;
  created_on: string; // ISO 8601
  modified_on: string; // ISO 8601
  aliases: string[] | null;
  is_live: boolean;
  latest_stage: CloudflareDeploymentStage | null;
  deployment_trigger: {
    type: 'manual' | 'github_commit' | 'gitlab_commit' | 'direct_upload' | 'scheduled';
    metadata?: {
      branch?: string;
      commit_hash?: string;
      commit_message?: string;
      sender?: {
        id?: string;
        type?: string;
        login?: string;
        avatar_url?: string;
      };
    } | null;
  };
  stages: CloudflareDeploymentStage[];
  build_config?: CloudflareProjectBuildConfig | null; // Present on some deployment info endpoints
  source?: {
    type: string; // e.g. "github" "gitlab" "direct_upload"
    config?: {
      owner?: string;
      repo_name?: string;
      production_branch?: string;
      pr_comments_enabled?: boolean;
    };
  } | null;
  env_vars?: Record<string, { value: string; type: 'secret_text' | 'plain_text' }> | null;
}


/**
 * Build configuration for a Cloudflare Pages project.
 */
export interface CloudflareProjectBuildConfig {
  build_command?: string | null;
  destination_dir?: string | null;
  root_dir?: string | null;
  web_analytics_tag?: string | null;
  web_analytics_token?: string | null;
}

/**
 * Deployment configurations for a Cloudflare Pages project (production/preview).
 */
export interface CloudflareProjectDeploymentConfigs {
  production: {
    env_vars?: Record<string, { value: string; type: 'secret_text' | 'plain_text' }> | null;
    compatibility_date?: string; // YYYY-MM-DD
    compatibility_flags?: string[];
    usage_model?: 'bundled' | 'unbound';
    fail_open?: boolean;
    always_use_latest_compatibility_date?: boolean;
    build_config?: CloudflareProjectBuildConfig | null;
    source?: CloudflareProjectSource | null;
    placement?: { mode: 'smart' } | null;
  };
  preview?: {
    env_vars?: Record<string, { value: string; type: 'secret_text' | 'plain_text' }> | null;
    compatibility_date?: string;
    compatibility_flags?: string[];
    usage_model?: 'bundled' | 'unbound';
    fail_open?: boolean;
    always_use_latest_compatibility_date?: boolean;
    build_config?: CloudflareProjectBuildConfig | null;
    source?: CloudflareProjectSource | null;
    placement?: { mode: 'smart' } | null;
  } | null;
}

export interface CloudflareProjectSource {
  type?: 'github' | 'gitlab' | 'direct_upload' | string; // Allow string for future types
  config?: {
    owner?: string;
    repo_name?: string;
    production_branch?: string;
    deployments_enabled?: boolean;
    pr_comments_enabled?: boolean;
    preview_branch_includes?: string[];
    preview_branch_excludes?: string[];
    production_deployments_enabled?: boolean;
    preview_deployments_enabled?: boolean;
    // ... other source-specific configs
  } | null;
}
/**
 * Represents a Cloudflare Pages project.
 */
export interface CloudflareProject {
  id: string;
  name: string;
  subdomain: string | null; // The project's *.pages.dev subdomain
  domains: { id: string; name: string; project_id: string; created_on: string; modified_on: string }[] | null;
  source: CloudflareProjectSource | null;
  build_config: CloudflareProjectBuildConfig | null;
  deployment_configs: CloudflareProjectDeploymentConfigs | null;
  latest_deployment: CloudflareDeploymentInfo | null;
  canonical_deployment: CloudflareDeploymentInfo | null;
  created_on: string; // ISO 8601
  production_branch: string; // Name of the production branch when using Git integration.
  // Other fields from API documentation can be added here if needed
}

/**
 * Manifest for a Cloudflare Pages deployment (file path -> SHA-1 hash).
 */
export type CloudflareDeploymentManifest = Record<string, string>;

/**
 * Represents a Cloudflare Pages deployment (response from create/get deployment).
 * This is largely similar to CloudflareDeploymentInfo but can be more detailed.
 */
export type CloudflareDeployment = CloudflareDeploymentInfo; // Using the more comprehensive info type

/**
 * Represents a single error from the Cloudflare API.
 */
export interface CloudflareError {
  code: number;
  message: string;
  // Potentially other fields like 'path' or 'details'
}

/**
 * Represents an error response from the Cloudflare API.
 */
export interface CloudflareAPIErrorResponse {
  success: false;
  errors: CloudflareError[];
  messages: string[]; // Sometimes Cloudflare API includes messages here too
}

/**
 * Represents a successful API response that wraps a result object.
 */
export interface CloudflareAPISuccessResponse<T> {
  success: true;
  result: T;
  errors: CloudflareError[]; // Should be empty on success
  messages: string[];       // Additional info messages
  result_info?: { // For paginated responses
    page: number;
    per_page: number;
    count: number;
    total_count: number;
    total_pages?: number;
  } | null;
}
