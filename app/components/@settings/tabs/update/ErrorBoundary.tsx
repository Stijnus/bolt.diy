import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <div className="flex items-center gap-3">
            <div className="i-ph:warning-octagon-fill text-red-500 w-5 h-5" />
            <h3 className="text-lg font-medium text-red-800 dark:text-red-200">Something went wrong</h3>
          </div>
          <p className="mt-2 text-sm text-red-700 dark:text-red-300">
            An unexpected error occurred while running Git diagnostics.
          </p>
          {this.state.error && (
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer text-red-600 dark:text-red-400">Error details</summary>
              <pre className="mt-2 p-3 bg-red-100 dark:bg-red-900/30 rounded text-red-700 dark:text-red-300">
                {this.state.error.toString()}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
