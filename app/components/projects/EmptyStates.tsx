import { motion } from 'framer-motion';
import { FolderPlus, Plus } from 'lucide-react';
import { Button } from '~/components/ui/Button';

interface EmptyProjectsListProps {
  onAddProject: () => void;
}

export const EmptyProjectsList = ({ onAddProject }: EmptyProjectsListProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center text-center"
      style={{ padding: 'var(--bolt-elements-spacing-4xl) var(--bolt-elements-spacing-4xl)' }}
    >
      <div
        className="w-24 h-24 rounded-full bg-bolt-elements-item-backgroundAccent flex items-center justify-center"
        style={{ marginBottom: 'var(--bolt-elements-spacing-4xl)' }}
      >
        <FolderPlus className="w-12 h-12 text-bolt-elements-item-contentAccent" />
      </div>

      <h3
        className="text-2xl font-semibold text-bolt-elements-textPrimary"
        style={{ marginBottom: 'var(--bolt-elements-spacing-lg)' }}
      >
        No Projects Yet
      </h3>

      <p
        className="text-bolt-elements-textSecondary max-w-md"
        style={{ marginBottom: 'var(--bolt-elements-spacing-4xl)' }}
      >
        Create your first project to start organizing your development work with git repositories and feature branches.
      </p>

      <Button
        onClick={onAddProject}
        variant="primary"
        size="lg"
        className="flex items-center"
        style={{ gap: 'var(--bolt-elements-spacing-sm)' }}
      >
        <Plus className="w-5 h-5" />
        Create Your First Project
      </Button>
    </motion.div>
  );
};
