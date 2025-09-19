import React from 'react';
import { Loader2, AlertCircle, CheckCircle, Info, Github } from 'lucide-react';
import { classNames } from '~/utils/classNames';

interface LoadingStateProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingState({ message = 'Loading...', size = 'md', className = '' }: LoadingStateProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  return (
    <div
      className={classNames(
        'flex flex-col items-center justify-center py-8 text-bolt-elements-textSecondary',
        className,
      )}
    >
      <Loader2 className={classNames('animate-spin mb-2', sizeClasses[size])} />
      <p className={classNames('text-bolt-elements-textSecondary', textSizeClasses[size])}>{message}</p>
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ErrorState({
  title = 'Error',
  message,
  onRetry,
  retryLabel = 'Try Again',
  size = 'md',
  className = '',
}: ErrorStateProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  return (
    <div className={classNames('flex flex-col items-center justify-center py-8 text-center', className)}>
      <AlertCircle className={classNames('text-red-500 mb-2', sizeClasses[size])} />
      <h3 className={classNames('font-medium text-bolt-elements-textPrimary mb-1', textSizeClasses[size])}>{title}</h3>
      <p className={classNames('text-bolt-elements-textSecondary mb-4', textSizeClasses[size])}>{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-bolt-elements-item-contentAccent text-white rounded-lg hover:bg-bolt-elements-item-contentAccent/90 transition-colors"
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}

interface SuccessStateProps {
  title?: string;
  message: string;
  onAction?: () => void;
  actionLabel?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function SuccessState({
  title = 'Success',
  message,
  onAction,
  actionLabel = 'Continue',
  size = 'md',
  className = '',
}: SuccessStateProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  return (
    <div className={classNames('flex flex-col items-center justify-center py-8 text-center', className)}>
      <CheckCircle className={classNames('text-green-500 mb-2', sizeClasses[size])} />
      <h3 className={classNames('font-medium text-bolt-elements-textPrimary mb-1', textSizeClasses[size])}>{title}</h3>
      <p className={classNames('text-bolt-elements-textSecondary mb-4', textSizeClasses[size])}>{message}</p>
      {onAction && (
        <button
          onClick={onAction}
          className="px-4 py-2 bg-bolt-elements-item-contentAccent text-white rounded-lg hover:bg-bolt-elements-item-contentAccent/90 transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

interface GitHubConnectionRequiredProps {
  onConnect?: () => void;
  className?: string;
}

export function GitHubConnectionRequired({ onConnect, className = '' }: GitHubConnectionRequiredProps) {
  return (
    <div className={classNames('flex flex-col items-center justify-center py-12 text-center', className)}>
      <Github className="w-12 h-12 text-bolt-elements-textTertiary mb-4" />
      <h3 className="text-lg font-medium text-bolt-elements-textPrimary mb-2">GitHub Connection Required</h3>
      <p className="text-sm text-bolt-elements-textSecondary mb-6 max-w-md">
        Please connect your GitHub account to access this feature. You'll be able to browse repositories, push code, and
        manage your GitHub integration.
      </p>
      {onConnect && (
        <button
          onClick={onConnect}
          className="px-6 py-3 bg-bolt-elements-item-contentAccent text-white rounded-lg hover:bg-bolt-elements-item-contentAccent/90 transition-colors flex items-center gap-2"
        >
          <Github className="w-4 h-4" />
          Connect GitHub
        </button>
      )}
    </div>
  );
}

interface InformationStateProps {
  title: string;
  message: string;
  icon?: React.ComponentType<{ className?: string }>;
  onAction?: () => void;
  actionLabel?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function InformationState({
  title,
  message,
  icon = Info,
  onAction,
  actionLabel = 'Got it',
  size = 'md',
  className = '',
}: InformationStateProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  return (
    <div className={classNames('flex flex-col items-center justify-center py-8 text-center', className)}>
      {React.createElement(icon, { className: classNames('text-blue-500 mb-2', sizeClasses[size]) })}
      <h3 className={classNames('font-medium text-bolt-elements-textPrimary mb-1', textSizeClasses[size])}>{title}</h3>
      <p className={classNames('text-bolt-elements-textSecondary mb-4', textSizeClasses[size])}>{message}</p>
      {onAction && (
        <button
          onClick={onAction}
          className="px-4 py-2 bg-bolt-elements-item-contentAccent text-white rounded-lg hover:bg-bolt-elements-item-contentAccent/90 transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

interface ConnectionTestIndicatorProps {
  status: 'success' | 'error' | 'testing' | null;
  message?: string;
  timestamp?: number;
  className?: string;
}

export function ConnectionTestIndicator({ status, message, timestamp, className = '' }: ConnectionTestIndicatorProps) {
  if (!status) {
    return null;
  }

  const getStatusColor = () => {
    switch (status) {
      case 'success':
        return 'bg-bolt-elements-status-success-background border-bolt-elements-status-success-border';
      case 'error':
        return 'bg-bolt-elements-status-error-background border-bolt-elements-status-error-border';
      case 'testing':
        return 'bg-bolt-elements-status-info-background border-bolt-elements-status-info-border';
      default:
        return 'bg-bolt-elements-status-neutral-background border-bolt-elements-status-neutral-border';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-bolt-elements-status-success-text" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-bolt-elements-status-error-text" />;
      case 'testing':
        return <Loader2 className="w-5 h-5 animate-spin text-bolt-elements-status-info-text" />;
      default:
        return <Info className="w-5 h-5 text-bolt-elements-status-neutral-text" />;
    }
  };

  const getStatusTextColor = () => {
    switch (status) {
      case 'success':
        return 'text-bolt-elements-status-success-text';
      case 'error':
        return 'text-bolt-elements-status-error-text';
      case 'testing':
        return 'text-bolt-elements-status-info-text';
      default:
        return 'text-bolt-elements-status-neutral-text';
    }
  };

  return (
    <div className={classNames(`p-4 rounded-lg border ${getStatusColor()}`, className)}>
      <div className="flex items-center gap-2">
        {getStatusIcon()}
        <span className={classNames('text-sm font-medium', getStatusTextColor())}>{message || status}</span>
      </div>
      {timestamp && (
        <p className="text-xs text-bolt-elements-textTertiary mt-1">{new Date(timestamp).toLocaleString()}</p>
      )}
    </div>
  );
}
