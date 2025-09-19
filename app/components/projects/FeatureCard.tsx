import { motion } from 'framer-motion';
/* eslint-disable padding-line-between-statements, @blitz/newline-before-return, curly */
import {
  CheckCircle,
  Clock,
  Circle,
  MessageCircle,
  GitBranch,
  AlertTriangle,
  XCircle,
  Timer,
  Target,
  Tag,
  Play,
} from 'lucide-react';
import type { Feature, FeatureStatus, FeaturePriority } from './types';
import { Button } from '~/components/ui/Button';
import { Select } from '~/components/ui/Select';
import { UserDisplay } from '~/components/ui/UserDisplay';
import { useEffect, useState } from 'react';
import { computeAheadBehindFromRemote } from '~/lib/services/gitMetricsService';
import { listPRsByFeature, type PRRow } from '~/lib/services/prService';

interface FeatureCardProps {
  feature: Feature;
  onStatusChange: (featureId: string, status: FeatureStatus) => void;
  onOpenChat: (featureId: string) => void;
  onOpenComments?: (featureId: string) => void;
  onOpenPRDialog?: (featureId: string) => void;
  gitUrl?: string;
  onStartTimer?: (featureId: string) => void;
  onStopTimer?: (featureId: string) => void;
  onStartWorking?: (featureId: string) => void;
}

export const FeatureCard = ({
  feature,
  onStatusChange,
  onOpenChat,
  onOpenComments,
  onOpenPRDialog,
  gitUrl,
  onStartTimer,
  onStopTimer,
  onStartWorking,
}: FeatureCardProps) => {
  const [ab, setAb] = useState<{ ahead: number; behind: number } | null>(null);
  const [prs, setPrs] = useState<PRRow[] | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (gitUrl) {
        const res = await computeAheadBehindFromRemote(gitUrl, feature.branchRef, feature.branchFrom);
        if (mounted) setAb(res);
      }
      try {
        const rows = await listPRsByFeature(feature.id);
        if (mounted) setPrs(rows);
      } catch {
        if (mounted) setPrs([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [gitUrl, feature.id, feature.branchRef, feature.branchFrom]);

  // Helper function to calculate time worked
  const calculateTimeWorked = () => {
    if (feature.timeTracking?.actualHours) {
      return feature.timeTracking.actualHours;
    }

    if (feature.timeTracking?.startedAt && feature.status === 'in-progress') {
      const started = new Date(feature.timeTracking.startedAt);
      const now = new Date();
      const diffHours = (now.getTime() - started.getTime()) / (1000 * 60 * 60);

      return Math.round(diffHours * 10) / 10;
    }

    return 0;
  };

  const getStatusColor = (status: FeatureStatus) => {
    switch (status) {
      case 'completed':
        return 'bg-[var(--bolt-elements-status-success-background)] text-[var(--bolt-elements-status-success-text)] border-[var(--bolt-elements-status-success-border)]';
      case 'in-progress':
        return 'bg-[var(--bolt-elements-status-info-background)] text-[var(--bolt-elements-status-info-text)] border-[var(--bolt-elements-status-info-border)]';
      case 'pending':
        return 'bg-[var(--bolt-elements-status-warning-background)] text-[var(--bolt-elements-status-warning-text)] border-[var(--bolt-elements-status-warning-border)]';
      case 'blocked':
        return 'bg-[var(--bolt-elements-status-error-background)] text-[var(--bolt-elements-status-error-text)] border-[var(--bolt-elements-status-error-border)]';
      case 'cancelled':
        return 'bg-[var(--bolt-elements-status-neutral-background)] text-[var(--bolt-elements-status-neutral-text)] border-[var(--bolt-elements-status-neutral-border)]';
      default:
        return 'bg-[var(--bolt-elements-status-neutral-background)] text-[var(--bolt-elements-status-neutral-text)] border-[var(--bolt-elements-status-neutral-border)]';
    }
  };

  const getPriorityColor = (priority: FeaturePriority) => {
    switch (priority) {
      case 'critical':
        return 'text-bolt-elements-item-contentDanger bg-bolt-elements-item-backgroundDanger';
      case 'high':
        return 'text-[var(--bolt-elements-status-warning-text)] bg-[var(--bolt-elements-status-warning-background)]';
      case 'medium':
        return 'text-bolt-elements-item-contentAccent bg-bolt-elements-item-backgroundAccent';
      case 'low':
        return 'text-bolt-elements-textSecondary bg-bolt-elements-background-depth-2';
      default:
        return 'text-bolt-elements-textSecondary bg-bolt-elements-background-depth-2';
    }
  };

  const getStatusIcon = (status: FeatureStatus) => {
    const iconProps = { className: 'w-3 h-3' };

    switch (status) {
      case 'completed':
        return <CheckCircle {...iconProps} />;
      case 'in-progress':
        return <Clock {...iconProps} />;
      case 'pending':
        return <Circle {...iconProps} strokeDasharray="2 2" />;
      case 'blocked':
        return <AlertTriangle {...iconProps} />;
      case 'cancelled':
        return <XCircle {...iconProps} />;
      default:
        return <Circle {...iconProps} />;
    }
  };

  const statusOptions: { value: FeatureStatus; label: string }[] = [
    { value: 'pending', label: 'Pending' },
    { value: 'in-progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'blocked', label: 'Blocked' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  const timeWorked = calculateTimeWorked();
  const estimatedTime = feature.timeTracking?.estimatedHours || 0;
  const isOverTime = estimatedTime > 0 && timeWorked > estimatedTime;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      className="bg-bolt-elements-background border border-bolt-elements-borderColor rounded-lg transition-all duration-300 hover:border-bolt-elements-borderColorActive"
      style={{
        padding: 'var(--bolt-elements-component-padding-md)',
        boxShadow: 'var(--bolt-elements-shadow-sm)',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between" style={{ marginBottom: 'var(--bolt-elements-spacing-md)' }}>
        <div className="flex-1">
          <div
            className="flex items-center"
            style={{ gap: 'var(--bolt-elements-spacing-sm)', marginBottom: 'var(--bolt-elements-spacing-xs)' }}
          >
            <h4 className="font-medium text-bolt-elements-textPrimary">{feature.name}</h4>
            {feature.analytics?.priority && (
              <span className={`text-xs px-2 py-0.5 rounded ${getPriorityColor(feature.analytics.priority)}`}>
                <Target className="w-3 h-3 inline mr-1" />
                {feature.analytics.priority.toUpperCase()}
              </span>
            )}
          </div>
          {feature.description && (
            <p className="text-sm text-bolt-elements-textSecondary line-clamp-2 mb-2">{feature.description}</p>
          )}

          {/* Tags */}
          {feature.analytics?.tags && feature.analytics.tags.length > 0 && (
            <div className="flex items-center gap-1 mb-2">
              {feature.analytics.tags.slice(0, 3).map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent text-xs rounded-full"
                >
                  <Tag className="w-2 h-2" />
                  {tag}
                </span>
              ))}
              {feature.analytics.tags.length > 3 && (
                <span className="text-xs text-bolt-elements-textTertiary">+{feature.analytics.tags.length - 3}</span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 ml-4">
          {/* Start Working Button - Primary action */}
          {feature.status === 'pending' && onStartWorking && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onStartWorking(feature.id)}
              title="Start working on this feature"
              className="inline-flex items-center"
              style={{ gap: 'var(--bolt-elements-spacing-xs)' }}
            >
              <Play className="w-4 h-4" />
              Start Working
            </Button>
          )}

          {/* Time tracking controls */}
          {feature.status === 'in-progress' && onStopTimer && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onStopTimer(feature.id)}
              title="Stop timer"
              className="text-bolt-elements-icon-error hover:text-bolt-elements-item-contentDanger"
            >
              <Timer className="w-4 h-4" />
            </Button>
          )}

          {feature.status !== 'in-progress' &&
            feature.status !== 'completed' &&
            feature.status !== 'pending' &&
            onStartTimer && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onStartTimer(feature.id)}
                title="Start timer"
                className="text-bolt-elements-icon-success hover:text-bolt-elements-item-contentAccent"
              >
                <Timer className="w-4 h-4" />
              </Button>
            )}

          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChat(feature.id)}
            title="Open chat for this feature"
            aria-label={`Open chat for ${feature.name} feature`}
            className="text-bolt-elements-textTertiary hover:text-bolt-elements-item-contentAccent"
          >
            <MessageCircle className="w-5 h-5" />
          </Button>

          {onOpenComments && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenComments(feature.id)}
              title="Open comments"
              aria-label={`Open comments for ${feature.name} feature`}
              className="text-bolt-elements-textTertiary hover:text-bolt-elements-item-contentAccent"
            >
              <span className="i-ph:chat-circle-dots text-base" />
            </Button>
          )}
        </div>
      </div>

      {/* Status and Branch Info */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(feature.status)}`}
          >
            {getStatusIcon(feature.status)}
            {feature.status.charAt(0).toUpperCase() + feature.status.slice(1).replace('-', ' ')}
          </span>

          <span className="text-xs text-bolt-elements-textTertiary flex items-center gap-1">
            <GitBranch className="w-3 h-3" />
            {feature.branchRef}
          </span>

          {ab && (
            <span className="text-xs text-bolt-elements-textTertiary">
              ↑{ab.ahead} ↓{ab.behind}
            </span>
          )}

          {prs && prs.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent">
              PR: {prs[0].state}
            </span>
          )}
        </div>

        <Select
          value={feature.status}
          onChange={(e) => onStatusChange(feature.id, e.target.value as FeatureStatus)}
          className="h-7 text-xs py-0 px-2"
          aria-label={`Change status for ${feature.name} feature`}
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      {/* Time Tracking and Assignee */}
      <div className="flex items-center justify-between text-xs text-bolt-elements-textTertiary mb-2">
        <div className="flex items-center gap-3">
          {/* Time tracking info */}
          {(timeWorked > 0 || estimatedTime > 0) && (
            <span className={`flex items-center gap-1 ${isOverTime ? 'text-bolt-elements-icon-error' : ''}`}>
              <Clock className="w-3 h-3" />
              {timeWorked.toFixed(1)}h{estimatedTime > 0 && ` / ${estimatedTime}h`}
            </span>
          )}

          {/* Assignee */}
          {feature.analytics?.assignee && (
            <UserDisplay
              userId={feature.analytics.assignee}
              size="xs"
              showName={true}
              className="text-bolt-elements-textSecondary"
            />
          )}

          {/* Complexity */}
          {feature.analytics?.complexity && (
            <span className="flex items-center gap-1">
              <span className="text-xs">
                {feature.analytics.complexity === 'simple' && '●'}
                {feature.analytics.complexity === 'medium' && '●●'}
                {feature.analytics.complexity === 'complex' && '●●●'}
                {feature.analytics.complexity === 'epic' && '●●●●'}
              </span>
              {feature.analytics.complexity}
            </span>
          )}
        </div>
      </div>

      {/* Additional Info */}
      {(feature.branchFrom || feature.analytics?.blockedBy) && (
        <div className="mt-3 pt-3 border-t border-bolt-elements-borderColor">
          {feature.branchFrom && (
            <p className="text-xs text-bolt-elements-textTertiary mb-1">
              Branched from: <span className="font-mono">{feature.branchFrom}</span>
            </p>
          )}
          {feature.analytics?.blockedBy && (
            <p className="text-xs text-bolt-elements-icon-error">Blocked by: {feature.analytics.blockedBy}</p>
          )}
          {onOpenPRDialog && (
            <div style={{ marginTop: 'var(--bolt-elements-spacing-sm)' }}>
              <Button
                variant="link"
                size="sm"
                onClick={() => onOpenPRDialog(feature.id)}
                className="text-xs text-bolt-elements-item-contentAccent h-auto p-0"
              >
                {prs && prs.length > 0 ? 'View/Create PR' : 'Create PR'}
              </Button>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};
