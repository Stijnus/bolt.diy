import { motion } from 'framer-motion';
import { useProjectHistory } from '~/lib/persistence/useProjectHistory';
import type { IChatMetadata } from '~/lib/persistence/db';

interface ProjectChatContextProps {
  metadata?: IChatMetadata;
  onDisassociate?: () => void;
}

export const ProjectChatContext = ({ metadata, onDisassociate }: ProjectChatContextProps) => {
  const { projects } = useProjectHistory();

  if (!metadata?.projectId || !metadata?.featureId) {
    return null;
  }

  const project = projects.find((p) => p.id === metadata.projectId);
  const feature = project?.features?.find((f) => f.id === metadata.featureId);

  if (!project || !feature) {
    return null;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-[var(--bolt-elements-status-success-background)] text-[var(--bolt-elements-status-success-text)] border-[var(--bolt-elements-status-success-border)]';
      case 'in-progress':
        return 'bg-[var(--bolt-elements-status-info-background)] text-[var(--bolt-elements-status-info-text)] border-[var(--bolt-elements-status-info-border)]';
      case 'pending':
        return 'bg-[var(--bolt-elements-status-warning-background)] text-[var(--bolt-elements-status-warning-text)] border-[var(--bolt-elements-status-warning-border)]';
      default:
        return 'bg-[var(--bolt-elements-status-neutral-background)] text-[var(--bolt-elements-status-neutral-text)] border-[var(--bolt-elements-status-neutral-border)]';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg mx-4 mb-4"
    >
      <div className="flex items-center gap-2">
        <span className="i-ph:folder text-purple-600 dark:text-purple-400" />
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-purple-900 dark:text-purple-100">{project.name}</span>
            <span className="text-xs text-purple-700 dark:text-purple-300">•</span>
            <span className="text-sm text-purple-700 dark:text-purple-300">{feature.name}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(feature.status)}`}
            >
              {feature.status.charAt(0).toUpperCase() + feature.status.slice(1).replace('-', ' ')}
            </span>
            <span className="text-xs text-purple-600 dark:text-purple-400 font-mono">{feature.branchRef}</span>
          </div>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <motion.a
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          href="/projects"
          className="p-1.5 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-800/50 rounded transition-colors"
          title="Go to project"
        >
          <span className="i-ph:arrow-square-out text-sm" />
        </motion.a>

        {onDisassociate && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onDisassociate}
            className="p-1.5 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-800/50 rounded transition-colors"
            title="Remove from project"
          >
            <span className="i-ph:x text-sm" />
          </motion.button>
        )}
      </div>
    </motion.div>
  );
};
