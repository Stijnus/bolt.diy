import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, History, GitBranch, Play, StopCircle, CheckCircle2 } from 'lucide-react';
import type { Project } from './types';
import { listActivitiesByScope, type Activity } from '~/lib/services/activityService';

interface ActivityFeedProps {
  project: Project;
}

function ActivityItem({ a }: { a: Activity }) {
  const icon = (() => {
    switch (a.action) {
      case 'feature_created':
        return <GitBranch className="w-4 h-4" />;
      case 'feature_status_changed':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'feature_timer_started':
        return <Play className="w-4 h-4" />;
      case 'feature_timer_stopped':
        return <StopCircle className="w-4 h-4" />;
      case 'project_created':
      case 'project_deleted':
        return <History className="w-4 h-4" />;
      default:
        return <History className="w-4 h-4" />;
    }
  })();

  return (
    <div className="flex items-start gap-2 p-2 rounded hover:bg-bolt-elements-item-backgroundActive">
      <div className="text-bolt-elements-textSecondary">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-bolt-elements-textPrimary break-words">{a.action.replaceAll('_', ' ')}</div>
        {a.details && (
          <div className="text-xs text-bolt-elements-textSecondary break-words">{JSON.stringify(a.details)}</div>
        )}
        <div className="text-xs text-bolt-elements-textTertiary flex items-center gap-1 mt-0.5">
          <Clock className="w-3 h-3" /> {new Date(a.timestamp).toLocaleString()}
        </div>
      </div>
    </div>
  );
}

export function ActivityFeed({ project }: ActivityFeedProps) {
  const [items, setItems] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);

        const rows = await listActivitiesByScope('project', project.id);

        if (!mounted) {
          return;
        }

        // Sort newest first
        rows.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setItems(rows);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [project.id]);

  return (
    <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-xl shadow-sm hover:shadow-lg hover:shadow-cyan-500/20 transition-all duration-300 mt-6">
      <div className="p-6 border-b border-bolt-elements-borderColor">
        <h2 className="text-lg font-semibold text-bolt-elements-textPrimary">Activity</h2>
      </div>
      <div className="p-4">
        {loading ? (
          <div className="text-bolt-elements-textTertiary">Loading...</div>
        ) : items.length === 0 ? (
          <div className="text-bolt-elements-textTertiary">No recent activity</div>
        ) : (
          <div className="space-y-1">
            {items.map((a) => (
              <motion.div key={a.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                <ActivityItem a={a} />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
