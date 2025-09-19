/**
 * Validation utility functions for projects, features, and related data
 */

import type { Project, Feature, NewFeature, FeaturePriority, FeatureComplexity } from '~/components/projects/types';
import { isValidGitUrl, isValidBranchName } from './gitUtils';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates a project object
 */
export function validateProject(project: Partial<Project>): ValidationResult {
  const errors: string[] = [];

  // Required fields
  if (!project.name || typeof project.name !== 'string' || project.name.trim().length === 0) {
    errors.push('Project name is required and must be a non-empty string');
  }

  if (!project.gitUrl || typeof project.gitUrl !== 'string' || project.gitUrl.trim().length === 0) {
    errors.push('Git URL is required and must be a non-empty string');
  } else if (!isValidGitUrl(project.gitUrl)) {
    errors.push('Git URL must be a valid repository URL');
  }

  if (!project.ownerId || typeof project.ownerId !== 'string' || project.ownerId.trim().length === 0) {
    errors.push('Owner ID is required and must be a non-empty string');
  }

  // Optional fields validation
  if (project.description !== undefined && typeof project.description !== 'string') {
    errors.push('Description must be a string');
  }

  if (project.source !== undefined && !['git', 'webcontainer', 'template'].includes(project.source)) {
    errors.push('Source must be one of: git, webcontainer, template');
  }

  if (project.collaborators !== undefined && !Array.isArray(project.collaborators)) {
    errors.push('Collaborators must be an array of user IDs');
  }

  if (project.archived !== undefined && typeof project.archived !== 'boolean') {
    errors.push('Archived must be a boolean');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates a new feature object
 */
export function validateNewFeature(feature: Partial<NewFeature>): ValidationResult {
  const errors: string[] = [];

  // Required fields
  if (!feature.name || typeof feature.name !== 'string' || feature.name.trim().length === 0) {
    errors.push('Feature name is required and must be a non-empty string');
  }

  if (!feature.branchRef || typeof feature.branchRef !== 'string' || feature.branchRef.trim().length === 0) {
    errors.push('Branch reference is required and must be a non-empty string');
  } else if (!isValidBranchName(feature.branchRef)) {
    errors.push('Branch reference must be a valid Git branch name');
  }

  if (!feature.branchFrom || typeof feature.branchFrom !== 'string' || feature.branchFrom.trim().length === 0) {
    errors.push('Source branch is required and must be a non-empty string');
  } else if (!isValidBranchName(feature.branchFrom)) {
    errors.push('Source branch must be a valid Git branch name');
  }

  if (!feature.description || typeof feature.description !== 'string' || feature.description.trim().length === 0) {
    errors.push('Description is required and must be a non-empty string');
  }

  // Optional fields validation
  if (feature.priority !== undefined && !isValidPriority(feature.priority)) {
    errors.push('Priority must be one of: low, medium, high, critical');
  }

  if (feature.complexity !== undefined && !isValidComplexity(feature.complexity)) {
    errors.push('Complexity must be one of: simple, medium, complex, epic');
  }

  if (
    feature.estimatedHours !== undefined &&
    (typeof feature.estimatedHours !== 'number' || feature.estimatedHours < 0)
  ) {
    errors.push('Estimated hours must be a non-negative number');
  }

  if (
    feature.assignee !== undefined &&
    (typeof feature.assignee !== 'string' || feature.assignee.trim().length === 0)
  ) {
    errors.push('Assignee must be a non-empty string');
  }

  if (feature.tags !== undefined && !Array.isArray(feature.tags)) {
    errors.push('Tags must be an array of strings');
  } else if (feature.tags && !feature.tags.every((tag) => typeof tag === 'string' && tag.trim().length > 0)) {
    errors.push('All tags must be non-empty strings');
  }

  if (feature.dependencies !== undefined && !Array.isArray(feature.dependencies)) {
    errors.push('Dependencies must be an array of feature IDs');
  } else if (
    feature.dependencies &&
    !feature.dependencies.every((dep) => typeof dep === 'string' && dep.trim().length > 0)
  ) {
    errors.push('All dependencies must be non-empty strings');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates a feature object
 */
export function validateFeature(feature: Partial<Feature>): ValidationResult {
  const errors: string[] = [];

  // Required fields
  if (!feature.id || typeof feature.id !== 'string' || feature.id.trim().length === 0) {
    errors.push('Feature ID is required and must be a non-empty string');
  }

  if (!feature.name || typeof feature.name !== 'string' || feature.name.trim().length === 0) {
    errors.push('Feature name is required and must be a non-empty string');
  }

  if (!feature.branchRef || typeof feature.branchRef !== 'string' || feature.branchRef.trim().length === 0) {
    errors.push('Branch reference is required and must be a non-empty string');
  }

  if (!feature.branchFrom || typeof feature.branchFrom !== 'string' || feature.branchFrom.trim().length === 0) {
    errors.push('Source branch is required and must be a non-empty string');
  }

  if (!feature.status || !isValidFeatureStatus(feature.status)) {
    errors.push('Status must be one of: pending, in-progress, completed, blocked, cancelled');
  }

  // Time tracking validation
  if (feature.timeTracking) {
    const timeErrors = validateTimeTracking(feature.timeTracking);
    errors.push(...timeErrors);
  }

  // Analytics validation
  if (feature.analytics) {
    const analyticsErrors = validateAnalytics(feature.analytics);
    errors.push(...analyticsErrors);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates time tracking data
 */
function validateTimeTracking(timeTracking: any): string[] {
  const errors: string[] = [];

  if (!timeTracking.createdAt || !isValidDateString(timeTracking.createdAt)) {
    errors.push('Created at must be a valid ISO date string');
  }

  if (!timeTracking.lastUpdated || !isValidDateString(timeTracking.lastUpdated)) {
    errors.push('Last updated must be a valid ISO date string');
  }

  if (
    timeTracking.startedAt !== undefined &&
    timeTracking.startedAt !== null &&
    !isValidDateString(timeTracking.startedAt)
  ) {
    errors.push('Started at must be a valid ISO date string');
  }

  if (timeTracking.completedAt !== undefined && !isValidDateString(timeTracking.completedAt)) {
    errors.push('Completed at must be a valid ISO date string');
  }

  if (
    timeTracking.estimatedHours !== undefined &&
    (typeof timeTracking.estimatedHours !== 'number' || timeTracking.estimatedHours < 0)
  ) {
    errors.push('Estimated hours must be a non-negative number');
  }

  if (
    timeTracking.actualHours !== undefined &&
    (typeof timeTracking.actualHours !== 'number' || timeTracking.actualHours < 0)
  ) {
    errors.push('Actual hours must be a non-negative number');
  }

  return errors;
}

/**
 * Validates analytics data
 */
function validateAnalytics(analytics: any): string[] {
  const errors: string[] = [];

  if (!isValidPriority(analytics.priority)) {
    errors.push('Priority must be one of: low, medium, high, critical');
  }

  if (!isValidComplexity(analytics.complexity)) {
    errors.push('Complexity must be one of: simple, medium, complex, epic');
  }

  if (!Array.isArray(analytics.tags)) {
    errors.push('Tags must be an array');
  } else if (!analytics.tags.every((tag: any) => typeof tag === 'string' && tag.trim().length > 0)) {
    errors.push('All tags must be non-empty strings');
  }

  if (
    analytics.assignee !== undefined &&
    (typeof analytics.assignee !== 'string' || analytics.assignee.trim().length === 0)
  ) {
    errors.push('Assignee must be a non-empty string');
  }

  if (!Array.isArray(analytics.dependencies)) {
    errors.push('Dependencies must be an array');
  } else if (!analytics.dependencies.every((dep: any) => typeof dep === 'string' && dep.trim().length > 0)) {
    errors.push('All dependencies must be non-empty strings');
  }

  return errors;
}

/**
 * Validates project ID
 */
export function validateProjectId(projectId: string): ValidationResult {
  const errors: string[] = [];

  if (!projectId || typeof projectId !== 'string' || projectId.trim().length === 0) {
    errors.push('Project ID is required and must be a non-empty string');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates feature ID
 */
export function validateFeatureId(featureId: string): ValidationResult {
  const errors: string[] = [];

  if (!featureId || typeof featureId !== 'string' || featureId.trim().length === 0) {
    errors.push('Feature ID is required and must be a non-empty string');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Helper validation functions
 */
function isValidPriority(priority: any): priority is FeaturePriority {
  return ['low', 'medium', 'high', 'critical'].includes(priority);
}

function isValidComplexity(complexity: any): complexity is FeatureComplexity {
  return ['simple', 'medium', 'complex', 'epic'].includes(complexity);
}

function isValidFeatureStatus(status: any): boolean {
  return ['pending', 'in-progress', 'completed', 'blocked', 'cancelled'].includes(status);
}

function isValidDateString(dateString: any): boolean {
  if (typeof dateString !== 'string') {
    return false;
  }

  const date = new Date(dateString);

  return !isNaN(date.getTime()) && dateString === date.toISOString();
}

/**
 * Sanitizes user input by trimming whitespace and removing potentially harmful characters
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .trim()
    .replace(/[\x00-\x1f\x7f]/g, '') // Remove control characters
    .replace(/[<>]/g, ''); // Remove HTML-like characters
}

/**
 * Creates a standardized error message
 */
export function createErrorMessage(field: string, errors: string[]): string {
  if (errors.length === 0) {
    return '';
  }

  if (errors.length === 1) {
    return `${field}: ${errors[0]}`;
  }

  return `${field} has multiple errors:\n${errors.map((error) => `- ${error}`).join('\n')}`;
}
