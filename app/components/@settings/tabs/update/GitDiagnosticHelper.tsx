import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { ErrorBoundary } from './ErrorBoundary';

interface GitDiagnosticResponse {
  inCloud: boolean;
  isGitInstalled: boolean;
  isGitRepo: boolean;
  hasOriginRemote: boolean;
  gitVersion?: string;
  gitPath?: string;
  systemPath?: string;
  possibleSolutions?: string[];
  error?: string;
}

const GitDiagnosticHelperContent: React.FC = () => {
  const [diagnosticData, setDiagnosticData] = useState<GitDiagnosticResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPath, setShowPath] = useState(false);
  const [isFixingPath, setIsFixingPath] = useState(false);

  const runDiagnostic = async () => {
    setIsLoading(true);
    toast.dismiss();
    toast.info('Running Git diagnostics...', { autoClose: 2000 });

    try {
      const response = await fetch('/api/git-diagnostic');

      if (!response.ok) {
        throw new Error('Failed to run Git diagnostic');
      }

      const data = await response.json();
      setDiagnosticData(data as GitDiagnosticResponse);
      toast.success('Git diagnostics completed successfully', { autoClose: 2000 });
    } catch (error) {
      console.error('Error running Git diagnostic:', error);
      toast.error('Failed to run Git diagnostic. Please try again.', { autoClose: 3000 });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Run diagnostic on component mount
    runDiagnostic();
  }, []);

  const getStatusIcon = (success: boolean) => {
    if (success) {
      return <div className="i-ph:check-circle-fill text-green-500 w-5 h-5" />;
    } else {
      return <div className="i-ph:x-circle-fill text-red-500 w-5 h-5" />;
    }
  };

  const renderSolution = (solution: string, index: number) => {
    // Check if it's a command that should be highlighted
    if (solution.includes('export PATH') || solution.includes('git init') || solution.includes('git remote add')) {
      const [instruction, command] = solution.split(': ');
      return (
        <li key={index} className="text-amber-800 dark:text-amber-200">
          {instruction}:{' '}
          <code className="font-mono px-1 py-0.5 bg-amber-100 dark:bg-amber-900/50 rounded">{command}</code>
        </li>
      );
    }

    return (
      <li key={index} className="text-amber-800 dark:text-amber-200">
        {solution}
      </li>
    );
  };

  const fixPath = async () => {
    setIsFixingPath(true);
    toast.dismiss();
    toast.info('Attempting to fix PATH...', { autoClose: false });

    try {
      const response = await fetch('/api/git-fix-path', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to fix PATH');
      }

      toast.success('PATH updated successfully! Restart Bolt to apply changes.', { autoClose: 4000 });
      setTimeout(runDiagnostic, 1000);
    } catch (error) {
      console.error('Error fixing PATH:', error);
      toast.error('Failed to fix PATH. Please try manually.', { autoClose: 4000 });
    } finally {
      setIsFixingPath(false);
    }
  };

  const renderPathInfo = () => {
    if (!diagnosticData?.systemPath) {
      return null;
    }

    const pathLines = diagnosticData.systemPath.split(':');
    const gitPath = diagnosticData.gitPath;

    return (
      <div className="mt-4 mb-6">
        <button
          onClick={() => setShowPath(!showPath)}
          className="flex items-center gap-2 text-sm font-medium text-blue-500 hover:text-blue-600"
        >
          <div className={`i-ph:caret-${showPath ? 'down' : 'right'} w-4 h-4`} />
          <span>System PATH Information</span>
        </button>

        {showPath && (
          <div className="mt-2">
            <div className="text-sm text-bolt-elements-textSecondary">
              {pathLines.map((line, index) => (
                <div key={index} className="flex items-center gap-2">
                  {gitPath && line.includes(gitPath) ? (
                    <div className="i-ph:check-circle-fill text-green-500 w-4 h-4" />
                  ) : (
                    <div className="i-ph:x-circle-fill text-red-500 w-4 h-4" />
                  )}
                  <code className="font-mono">{line}</code>
                </div>
              ))}
            </div>

            {diagnosticData.possibleSolutions?.some((sol) => sol.includes('Git is installed but not in your PATH')) && (
              <button
                onClick={fixPath}
                className="mt-4 flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                disabled={isFixingPath}
              >
                {isFixingPath ? (
                  <div className="i-ph:spinner animate-spin w-4 h-4" />
                ) : (
                  <div className="i-ph:magic-wand w-4 h-4" />
                )}
                <span>Fix PATH Automatically</span>
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="p-6 rounded-xl bg-white dark:bg-[#0A0A0A] border border-[#E5E5E5] dark:border-[#1A1A1A]">
        <div className="flex items-center gap-3 mb-4">
          <div className="i-ph:git-branch text-purple-500 w-5 h-5 animate-pulse" />
          <h3 className="text-lg font-medium text-bolt-elements-textPrimary">Git Diagnostics</h3>
        </div>
        <div className="text-sm text-bolt-elements-textSecondary flex items-center gap-2">
          <div className="i-ph:spinner animate-spin w-4 h-4" />
          <span>Running Git diagnostics...</span>
        </div>
      </div>
    );
  }

  if (!diagnosticData) {
    return null;
  }

  // If in cloud environment
  if (diagnosticData.inCloud) {
    return (
      <div className="p-6 rounded-xl bg-white dark:bg-[#0A0A0A] border border-[#E5E5E5] dark:border-[#1A1A1A]">
        <div className="flex items-center gap-3 mb-4">
          <div className="i-ph:cloud text-purple-500 w-5 h-5" />
          <h3 className="text-lg font-medium text-bolt-elements-textPrimary">Git Diagnostics</h3>
        </div>
        <div className="text-sm text-bolt-elements-textSecondary">
          <p>Git operations are not available in cloud environments.</p>
          <p className="mt-2">To use Git, run Bolt locally on your machine.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 rounded-xl bg-white dark:bg-[#0A0A0A] border border-[#E5E5E5] dark:border-[#1A1A1A]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="i-ph:git-branch text-purple-500 w-5 h-5" />
          <h3 className="text-lg font-medium text-bolt-elements-textPrimary">Git Diagnostics</h3>
        </div>
        <button
          onClick={runDiagnostic}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-purple-500 text-white hover:bg-purple-600 transition-colors"
          disabled={isLoading}
        >
          <div className="i-ph:arrows-clockwise w-4 h-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Status overview */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex items-center gap-3">
          {getStatusIcon(diagnosticData.isGitInstalled)}
          <div>
            <h4 className="text-sm font-medium">Git Installation</h4>
            <p className="text-xs text-bolt-elements-textSecondary">
              {diagnosticData.isGitInstalled
                ? `Installed (${diagnosticData.gitVersion})`
                : 'Git is not installed or not in PATH'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {getStatusIcon(diagnosticData.isGitRepo)}
          <div>
            <h4 className="text-sm font-medium">Git Repository</h4>
            <p className="text-xs text-bolt-elements-textSecondary">
              {diagnosticData.isGitRepo ? 'Valid Git repository' : 'Not a Git repository'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {getStatusIcon(diagnosticData.hasOriginRemote)}
          <div>
            <h4 className="text-sm font-medium">Remote Configuration</h4>
            <p className="text-xs text-bolt-elements-textSecondary">
              {diagnosticData.hasOriginRemote ? 'Origin remote is configured' : 'Origin remote is missing'}
            </p>
          </div>
        </div>

        {diagnosticData.gitPath && (
          <div className="flex items-center gap-3">
            <div className="i-ph:info text-blue-500 w-5 h-5" />
            <div>
              <h4 className="text-sm font-medium">Git Path</h4>
              <p className="text-xs text-bolt-elements-textSecondary font-mono">{diagnosticData.gitPath}</p>
            </div>
          </div>
        )}
      </div>

      {/* Show system PATH information if Git is not detected */}
      {!diagnosticData.isGitInstalled && diagnosticData.systemPath && renderPathInfo()}

      {/* Possible solutions */}
      {diagnosticData.possibleSolutions && diagnosticData.possibleSolutions.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="i-ph:wrench text-amber-500 w-5 h-5" />
            <h4 className="text-sm font-medium">Suggested Solutions</h4>
          </div>
          <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-900">
            <ul className="list-disc pl-5 space-y-2 text-sm">
              {diagnosticData.possibleSolutions.map((solution, index) => renderSolution(solution, index))}
            </ul>
          </div>
        </div>
      )}

      {/* Error message if any */}
      {diagnosticData.error && (
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="i-ph:warning text-red-500 w-5 h-5" />
            <h4 className="text-sm font-medium">Error Details</h4>
          </div>
          <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-900">
            <pre className="text-xs text-red-800 dark:text-red-200 font-mono whitespace-pre-wrap">
              {diagnosticData.error}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

export const GitDiagnosticHelper = () => (
  <ErrorBoundary>
    <GitDiagnosticHelperContent />
  </ErrorBoundary>
);
