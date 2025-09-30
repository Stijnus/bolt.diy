import { AnimatePresence, motion } from 'framer-motion';
import type { SupabaseAlert } from '~/types/actions';
import { classNames } from '~/utils/classNames';
import { supabaseConnection } from '~/lib/stores/supabase';
import { useStore } from '@nanostores/react';
import { useState, useEffect } from 'react';

interface Props {
  alert: SupabaseAlert;
  clearAlert: () => void;
  postMessage: (message: string) => void;
}

interface WorkflowStep {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  icon?: string;
  estimatedTime?: number;
}

export function EnhancedSupabaseChatAlert({ alert, clearAlert, postMessage }: Props) {
  const {
    content,
    type,
    title,
    description,
    stage,
    queryStatus,
    projectStatus,
    operation,
    projectUrl,
    estimatedTime,
    progress,
    rollbackAvailable,
    nextSteps,
  } = alert;

  const connection = useStore(supabaseConnection);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [countdown, setCountdown] = useState(estimatedTime || 0);

  // Countdown timer for estimated completion
  useEffect(() => {
    if (estimatedTime && stage && stage !== 'complete') {
      const timer = setInterval(() => {
        setCountdown((prev) => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(timer);
    }

    return undefined;
  }, [estimatedTime, stage]);

  // Determine connection state
  const isConnected = !!(connection.token && connection.selectedProjectId && connection.credentials?.anonKey);
  const hasToken = !!connection.token;
  const hasProjects = !!(connection.stats?.projects && connection.stats.projects.length > 0);
  const hasSelectedProject = !!connection.selectedProjectId;
  const hasCredentials = !!connection.credentials?.anonKey;

  // Generate workflow steps based on operation
  const workflowSteps = generateWorkflowSteps(operation, stage, queryStatus, projectStatus);

  // Get dynamic message based on current state
  const getMessage = (): string => {
    if (content && operation === 'query') {
      return 'Review the SQL query below and execute when ready.';
    }

    if (operation === 'project-create' && stage === 'creating') {
      return `Creating your Supabase project. This typically takes ${Math.ceil((estimatedTime || 120) / 60)} minutes.`;
    }

    if (operation === 'setup' && stage === 'initializing') {
      return 'Configuring your project environment with API keys and database connection.';
    }

    return description || getMessageForState();
  };

  function getMessageForState() {
    if (isConnected) {
      return 'Your Supabase project is fully configured and ready for database operations.';
    }

    if (!hasToken) {
      return 'Connect your Supabase account to enable database operations and project management.';
    }

    if (!hasProjects) {
      return 'Create your first Supabase project to start building with database features.';
    }

    if (!hasSelectedProject) {
      const projectCount = connection.stats?.projects?.length || 0;
      return `Select from your ${projectCount} available project${projectCount > 1 ? 's' : ''} to continue.`;
    }

    if (!hasCredentials) {
      return 'Configure API keys for your selected project to enable database access.';
    }

    return 'Supabase setup required to continue.';
  }

  const handleConnectClick = () => {
    document.dispatchEvent(new CustomEvent('open-supabase-connection'));
  };

  const handleProjectAction = async (actionType: string) => {
    switch (actionType) {
      case 'create-project':
        // Trigger project creation workflow
        postMessage('Please create a new Supabase project with a suitable name and database password.');
        break;
      case 'setup-project':
        if (connection.selectedProjectId) {
          postMessage(`Set up the project environment for project ${connection.selectedProjectId}.`);
        }

        break;
      case 'open-dashboard':
        if (projectUrl) {
          window.open(projectUrl, '_blank');
        }

        break;
      case 'rollback':
        if (rollbackAvailable) {
          postMessage('Please provide the rollback SQL to undo the previous operation.');
        }

        break;
    }
  };

  const executeSupabaseAction = async (sql: string) => {
    if (!connection.token || !connection.selectedProjectId) {
      console.error('No Supabase token or project selected');
      return;
    }

    setIsExecuting(true);

    try {
      const response = await fetch('/api/supabase/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${connection.token}`,
        },
        body: JSON.stringify({
          projectId: connection.selectedProjectId,
          query: sql,
          options: {
            analyze: true,
            timeout: 30000,
          },
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { error?: { message?: string } } | null;
        const fallbackMessage = errorData?.error?.message || 'Query execution failed';
        throw new Error(fallbackMessage);
      }

      const result = (await response.json()) as {
        metadata?: {
          queryType?: string;
          rowsAffected?: number;
          executionTime?: number;
        };
      } | null;
      console.log('Query executed successfully:', result);

      // Show success message with metadata
      const metadata = result?.metadata;

      if (metadata) {
        const { queryType, rowsAffected, executionTime } = metadata;
        postMessage(
          `✅ Query executed successfully!\n` +
            `• Type: ${queryType ?? 'unknown'}\n` +
            `• Rows affected: ${rowsAffected ?? 0}\n` +
            `• Execution time: ${typeof executionTime === 'number' ? executionTime : 0}ms`,
        );
      }

      clearAlert();
    } catch (error) {
      console.error('Failed to execute Supabase action:', error);

      const errorMessage = error instanceof Error ? error.message : String(error);
      postMessage(`❌ Query execution failed:\n\`\`\`\n${errorMessage}\n\`\`\`\n`);
    } finally {
      setIsExecuting(false);
    }
  };

  const cleanSqlContent = (content: string) => {
    if (!content) {
      return '';
    }

    // Remove comments and clean up formatting
    let cleaned = content.replace(/\/\*[\s\S]*?\*\//g, '');
    cleaned = cleaned.replace(/(--).*$/gm, '').replace(/(#).*$/gm, '');

    const statements = cleaned
      .split(';')
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0)
      .join(';\n\n');

    return statements;
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;

    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className={classNames(
          'max-w-chat rounded-lg border-l-2 border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2',
          type === 'success'
            ? 'border-l-green-500'
            : type === 'error'
              ? 'border-l-red-500'
              : type === 'warning'
                ? 'border-l-yellow-500'
                : 'border-l-[#098F5F]',
        )}
      >
        {/* Header */}
        <div className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <motion.div
                className="flex-shrink-0"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2 }}
              >
                <img height="16" width="16" crossOrigin="anonymous" src="https://cdn.simpleicons.org/supabase" />
              </motion.div>
              <motion.h3
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className={classNames(
                  'text-sm font-medium',
                  type === 'success'
                    ? 'text-bolt-elements-icon-success'
                    : type === 'error'
                      ? 'text-bolt-elements-button-danger-text'
                      : type === 'warning'
                        ? 'text-yellow-500'
                        : 'text-[#3DCB8F]',
                )}
              >
                {title}
              </motion.h3>
            </div>

            {/* Progress indicator */}
            {progress !== undefined && (
              <div className="flex items-center gap-2">
                {countdown > 0 && (
                  <span className="text-xs text-bolt-elements-textSecondary">~{formatCountdown(countdown)}</span>
                )}
                <div className="w-16 h-2 bg-bolt-elements-background-depth-3 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5 }}
                    className="h-full bg-[#3DCB8F] rounded-full"
                  />
                </div>
              </div>
            )}
          </div>

          <p className="text-sm text-bolt-elements-textSecondary mt-1">{getMessage()}</p>
        </div>

        {/* Content Section */}
        <div className="px-4">
          {!isConnected && operation === 'query' ? (
            <div className="p-3 rounded-md bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor">
              <div className="flex items-center gap-2 mb-2">
                <div className="i-ph:warning text-yellow-500"></div>
                <span className="text-sm font-medium text-bolt-elements-textPrimary">Supabase Connection Required</span>
              </div>
              <span className="text-sm text-bolt-elements-textSecondary">
                Connect to Supabase and select a project before executing database queries.
              </span>
            </div>
          ) : content ? (
            <>
              <div
                className="flex items-center p-2 rounded-md bg-bolt-elements-background-depth-3 cursor-pointer hover:bg-bolt-elements-background-depth-4 transition-colors"
                onClick={() => setIsCollapsed(!isCollapsed)}
              >
                <div className="i-ph:database text-bolt-elements-textPrimary mr-2"></div>
                <span className="text-sm text-bolt-elements-textPrimary flex-grow">
                  {operation === 'query' ? 'SQL Query' : 'Configuration'}
                </span>
                <div
                  className={classNames(
                    'i-ph:caret-up text-bolt-elements-textPrimary transition-transform',
                    isCollapsed ? 'rotate-180' : '',
                  )}
                />
              </div>

              {!isCollapsed && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mt-2 p-3 bg-bolt-elements-background-depth-4 rounded-md overflow-auto max-h-60 font-mono text-xs text-bolt-elements-textSecondary border border-bolt-elements-borderColor"
                >
                  <pre>{cleanSqlContent(content)}</pre>
                </motion.div>
              )}
            </>
          ) : null}
        </div>

        {/* Workflow Steps */}
        {workflowSteps.length > 0 && (
          <div className="px-4 py-2">
            <div className="flex items-center space-x-3">
              {workflowSteps.map((step, index) => (
                <div key={step.id} className="flex items-center">
                  <div
                    className={classNames(
                      'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors',
                      step.status === 'running'
                        ? 'bg-blue-500 text-white'
                        : step.status === 'complete'
                          ? 'bg-green-500 text-white'
                          : step.status === 'failed'
                            ? 'bg-red-500 text-white'
                            : 'bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary',
                    )}
                  >
                    {step.status === 'running' ? (
                      <div className="i-svg-spinners:ring-resize text-white"></div>
                    ) : step.status === 'complete' ? (
                      <div className="i-ph:check"></div>
                    ) : step.status === 'failed' ? (
                      <div className="i-ph:x"></div>
                    ) : (
                      index + 1
                    )}
                  </div>
                  <span
                    className={classNames(
                      'ml-2 text-xs',
                      step.status === 'complete'
                        ? 'text-bolt-elements-textPrimary'
                        : step.status === 'running'
                          ? 'text-blue-500'
                          : step.status === 'failed'
                            ? 'text-red-500'
                            : 'text-bolt-elements-textSecondary',
                    )}
                  >
                    {step.label}
                  </span>
                  {index < workflowSteps.length - 1 && (
                    <div className="w-8 h-px bg-bolt-elements-borderColor ml-2"></div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Next Steps */}
        {nextSteps && nextSteps.length > 0 && (
          <div className="px-4 py-2">
            <div className="bg-bolt-elements-background-depth-3 rounded-md p-3 border border-bolt-elements-borderColor">
              <h4 className="text-sm font-medium text-bolt-elements-textPrimary mb-2 flex items-center gap-2">
                <div className="i-ph:list-bullets"></div>
                Next Steps
              </h4>
              <ul className="space-y-1">
                {nextSteps.map((step, index) => (
                  <li key={index} className="text-xs text-bolt-elements-textSecondary flex items-start gap-2">
                    <div className="i-ph:dot-outline mt-0.5 flex-shrink-0"></div>
                    {step}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="px-4 pb-4">
          <div className="flex items-center gap-2 mt-3">
            {/* Connection Action */}
            {!hasToken && (
              <button
                onClick={handleConnectClick}
                className="flex items-center gap-2 px-3 py-2 bg-[#3DCB8F] text-white rounded-md hover:bg-[#2BAE73] transition-colors text-sm"
              >
                <div className="i-ph:link"></div>
                Connect to Supabase
              </button>
            )}

            {/* Project Creation */}
            {hasToken && !hasProjects && (
              <button
                onClick={() => handleProjectAction('create-project')}
                className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors text-sm"
              >
                <div className="i-ph:plus"></div>
                Create Project
              </button>
            )}

            {/* Project Setup */}
            {hasSelectedProject && !hasCredentials && (
              <button
                onClick={() => handleProjectAction('setup-project')}
                className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors text-sm"
              >
                <div className="i-ph:gear"></div>
                Setup Project
              </button>
            )}

            {/* Query Execution */}
            {isConnected && operation === 'query' && content && (
              <button
                onClick={() => executeSupabaseAction(content)}
                disabled={isExecuting}
                className="flex items-center gap-2 px-3 py-2 bg-[#3DCB8F] text-white rounded-md hover:bg-[#2BAE73] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
              >
                {isExecuting ? (
                  <>
                    <div className="i-svg-spinners:ring-resize"></div>
                    Executing...
                  </>
                ) : (
                  <>
                    <div className="i-ph:play"></div>
                    Execute Query
                  </>
                )}
              </button>
            )}

            {/* Dashboard Link */}
            {projectUrl && (
              <button
                onClick={() => handleProjectAction('open-dashboard')}
                className="flex items-center gap-2 px-3 py-2 bg-bolt-elements-background-depth-3 text-bolt-elements-textPrimary rounded-md hover:bg-bolt-elements-background-depth-4 transition-colors text-sm border border-bolt-elements-borderColor"
              >
                <div className="i-ph:external-link"></div>
                Open Dashboard
              </button>
            )}

            {/* Rollback Option */}
            {rollbackAvailable && (
              <button
                onClick={() => handleProjectAction('rollback')}
                className="flex items-center gap-2 px-3 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors text-sm"
              >
                <div className="i-ph:arrow-counter-clockwise"></div>
                Rollback
              </button>
            )}

            {/* Close Button */}
            <button
              onClick={clearAlert}
              className="ml-auto flex items-center gap-1 px-2 py-2 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors text-sm"
            >
              <div className="i-ph:x"></div>
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function generateWorkflowSteps(
  operation?: string,
  stage?: string,
  queryStatus?: string,
  projectStatus?: string,
): WorkflowStep[] {
  if (operation === 'project-create') {
    return [
      {
        id: 'validate',
        label: 'Validate',
        status: stage === 'creating' || stage === 'complete' ? 'complete' : 'pending',
      },
      {
        id: 'create',
        label: 'Create',
        status:
          projectStatus === 'creating'
            ? 'running'
            : projectStatus === 'ready'
              ? 'complete'
              : projectStatus === 'failed'
                ? 'failed'
                : 'pending',
      },
      {
        id: 'initialize',
        label: 'Initialize',
        status: projectStatus === 'ready' ? 'complete' : 'pending',
      },
    ];
  }

  if (operation === 'setup') {
    return [
      {
        id: 'fetch-keys',
        label: 'Fetch Keys',
        status: stage === 'initializing' || stage === 'complete' ? 'complete' : 'pending',
      },
      {
        id: 'configure',
        label: 'Configure',
        status: stage === 'complete' ? 'complete' : stage === 'initializing' ? 'running' : 'pending',
      },
    ];
  }

  if (operation === 'query') {
    return [
      {
        id: 'execute',
        label: 'Execute',
        status:
          queryStatus === 'running'
            ? 'running'
            : queryStatus === 'complete'
              ? 'complete'
              : queryStatus === 'failed'
                ? 'failed'
                : 'pending',
      },
    ];
  }

  return [];
}
