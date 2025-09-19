import { motion } from 'framer-motion';
import { RotateCcw, Trash2, GitBranch, Zap } from 'lucide-react';
import type { Project } from './types';

interface ProjectCardProps {
  project: Project;
  onClick: (project: Project) => void;
  onRefresh: (gitUrl: string) => void;
  onDelete: (id: string) => void;
}

export const ProjectCard = ({ project, onClick, onRefresh, onDelete }: ProjectCardProps) => {
  const handleRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRefresh(project.gitUrl);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(project.id);
  };

  const completedFeatures = project.features?.filter((f) => f.status === 'completed').length || 0;
  const totalFeatures = project.features?.length || 0;
  const isWebcontainer = project.source === 'webcontainer' || project.gitUrl.startsWith('webcontainer://');
  const gitUrlDisplay = isWebcontainer ? 'Current Workspace Snapshot' : project.gitUrl;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, y: -5 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onClick(project)}
      className="bg-bolt-elements-card-neutral-background border border-bolt-elements-borderColor cursor-pointer hover:shadow-lg hover:shadow-bolt-elements-card-neutral-shadow transition-all duration-300 hover:border-bolt-elements-borderColorActive"
      style={{
        padding: 'var(--bolt-elements-component-padding-md)',
        borderRadius: 'var(--bolt-elements-border-radius-xl)',
        boxShadow: 'var(--bolt-elements-shadow-sm)',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between" style={{ marginBottom: 'var(--bolt-elements-spacing-lg)' }}>
        <div className="flex-1 min-w-0" style={{ paddingRight: 'var(--bolt-elements-spacing-sm)' }}>
          <div className="flex items-center mb-1" style={{ gap: 'var(--bolt-elements-spacing-sm)' }}>
            <h3 className="text-lg font-semibold text-bolt-elements-textPrimary truncate">{project.name}</h3>
            {isWebcontainer && (
              <span className="inline-flex items-center rounded-full bg-bolt-elements-status-info-background text-bolt-elements-status-info-text text-xs font-medium px-2 py-0.5">
                Current Session
              </span>
            )}
          </div>
          <p className="text-sm text-bolt-elements-textSecondary truncate font-mono">{gitUrlDisplay}</p>
        </div>

        <div className="flex items-center flex-shrink-0" style={{ gap: 'var(--bolt-elements-spacing-xs)' }}>
          {!isWebcontainer && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleRefresh}
              className="bg-transparent text-bolt-elements-textSecondary hover:text-bolt-elements-item-contentAccent transition-colors hover:bg-bolt-elements-item-backgroundAccent"
              style={{
                padding: 'var(--bolt-elements-spacing-sm)',
                borderRadius: 'var(--bolt-elements-border-radius-md)',
              }}
              title="Refresh project"
            >
              <RotateCcw className="w-4 h-4" />
            </motion.button>
          )}

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleDelete}
            className="bg-transparent text-bolt-elements-textSecondary hover:text-bolt-elements-item-contentDanger transition-colors hover:bg-bolt-elements-item-backgroundDanger"
            style={{
              padding: 'var(--bolt-elements-spacing-sm)',
              borderRadius: 'var(--bolt-elements-border-radius-md)',
            }}
            title="Delete project"
          >
            <Trash2 className="w-4 h-4" />
          </motion.button>
        </div>
      </div>

      {/* Description */}
      {project.description && (
        <p
          className="text-bolt-elements-textSecondary text-sm line-clamp-2"
          style={{ marginBottom: 'var(--bolt-elements-spacing-lg)' }}
        >
          {project.description}
        </p>
      )}

      {/* Stats */}
      <div className="flex items-center justify-between">
        <div
          className="flex items-center text-sm text-bolt-elements-textSecondary"
          style={{ gap: 'var(--bolt-elements-spacing-lg)' }}
        >
          <div className="flex items-center" style={{ gap: 'var(--bolt-elements-spacing-xs)' }}>
            <GitBranch className="w-4 h-4" />
            <span>{project.branches?.length || 0} branches</span>
          </div>
          <div className="flex items-center" style={{ gap: 'var(--bolt-elements-spacing-xs)' }}>
            <Zap className="w-4 h-4" />
            <span>{totalFeatures} features</span>
          </div>
        </div>

        {totalFeatures > 0 && (
          <div className="flex items-center" style={{ gap: 'var(--bolt-elements-spacing-sm)' }}>
            <div className="w-20 h-2 bg-bolt-elements-background-depth-3 rounded-full overflow-hidden">
              <div
                className="h-full bg-bolt-elements-item-contentAccent transition-all duration-300"
                style={{ width: `${(completedFeatures / totalFeatures) * 100}%` }}
              />
            </div>
            <span className="text-xs text-bolt-elements-textTertiary">
              {completedFeatures}/{totalFeatures}
            </span>
          </div>
        )}
      </div>

      {/* Last updated */}
      {project.lastUpdated && (
        <div
          className="border-t border-bolt-elements-borderColor"
          style={{
            marginTop: 'var(--bolt-elements-spacing-lg)',
            paddingTop: 'var(--bolt-elements-spacing-lg)',
          }}
        >
          <p className="text-xs text-bolt-elements-textTertiary">
            Updated {new Date(project.lastUpdated).toLocaleDateString()}
          </p>
        </div>
      )}
    </motion.div>
  );
};
