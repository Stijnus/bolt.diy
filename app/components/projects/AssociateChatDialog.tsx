import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Folder } from 'lucide-react';
import { toast } from 'react-toastify';
import { Dialog, DialogRoot, DialogTitle, DialogDescription } from '~/components/ui/Dialog';
import { Button } from '~/components/ui/Button';
import { Label } from '~/components/ui/Label';
import { useProjectHistory } from '~/lib/persistence/useProjectHistory';

interface AssociateChatDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAssociate: (projectId: string, featureId: string) => void;
  chatDescription?: string;
}

export const AssociateChatDialog = ({ isOpen, onClose, onAssociate, chatDescription }: AssociateChatDialogProps) => {
  const { projects, loading } = useProjectHistory();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedFeatureId, setSelectedFeatureId] = useState<string>('');

  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const availableFeatures = selectedProject?.features || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProjectId || !selectedFeatureId) {
      toast.error('Please select both a project and feature');
      return;
    }

    try {
      await onAssociate(selectedProjectId, selectedFeatureId);
      toast.success('Chat associated with project feature');
      onClose();
    } catch (error) {
      console.error('Error associating chat:', error);
      toast.error('Failed to associate chat with project');
    }
  };

  const handleClose = () => {
    setSelectedProjectId('');
    setSelectedFeatureId('');
    onClose();
  };

  if (loading) {
    return null;
  }

  return (
    <DialogRoot open={isOpen} onOpenChange={handleClose}>
      <Dialog showCloseButton={false} className="max-w-md">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <DialogTitle>Associate Chat with Project</DialogTitle>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleClose}
              className="p-2 text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </motion.button>
          </div>

          <DialogDescription className="mb-4">
            Link this chat to a specific project feature for better organization.
          </DialogDescription>

          {chatDescription && (
            <div className="mb-4 p-3 bg-bolt-elements-item-backgroundAccent rounded-lg border border-bolt-elements-borderColor">
              <p className="text-sm text-bolt-elements-textPrimary">
                <span className="font-medium">Chat:</span> {chatDescription}
              </p>
            </div>
          )}

          {projects.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-bolt-elements-background-depth-3 flex items-center justify-center">
                <Folder className="w-8 h-8 text-bolt-elements-textTertiary" />
              </div>
              <h3 className="text-lg font-medium text-bolt-elements-textPrimary mb-2">No Projects Found</h3>
              <p className="text-bolt-elements-textSecondary mb-4">
                Create a project first to associate chats with features.
              </p>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={() => {
                    handleClose();
                    window.location.href = '/projects';
                  }}
                  variant="primary"
                >
                  Go to Projects
                </Button>
              </motion.div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="project-select" className="text-bolt-elements-textPrimary">
                  Select Project
                </Label>
                <select
                  id="project-select"
                  value={selectedProjectId}
                  onChange={(e) => {
                    setSelectedProjectId(e.target.value);
                    setSelectedFeatureId(''); // Reset feature selection
                  }}
                  className="flex h-10 w-full rounded-md border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 px-3 py-2 text-sm text-bolt-elements-textPrimary ring-offset-bolt-elements-background-depth-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bolt-elements-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  required
                >
                  <option value="">Choose a project...</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedProject && (
                <div className="space-y-2">
                  <Label htmlFor="feature-select" className="text-bolt-elements-textPrimary">
                    Select Feature
                  </Label>
                  {availableFeatures.length === 0 ? (
                    <div className="text-center p-4 bg-bolt-elements-background-depth-2 rounded-lg border border-bolt-elements-borderColor">
                      <p className="text-bolt-elements-textSecondary text-sm">
                        No features found in this project. Create a feature first.
                      </p>
                    </div>
                  ) : (
                    <select
                      id="feature-select"
                      value={selectedFeatureId}
                      onChange={(e) => setSelectedFeatureId(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 px-3 py-2 text-sm text-bolt-elements-textPrimary ring-offset-bolt-elements-background-depth-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bolt-elements-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      required
                    >
                      <option value="">Choose a feature...</option>
                      {availableFeatures.map((feature) => (
                        <option key={feature.id} value={feature.id}>
                          {feature.name} ({feature.status})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {selectedProject && availableFeatures.length > 0 && (
                <div className="flex gap-3 pt-4">
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
                    <Button type="button" variant="outline" onClick={handleClose} className="w-full">
                      Cancel
                    </Button>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
                    <Button
                      type="submit"
                      disabled={!selectedProjectId || !selectedFeatureId}
                      variant="primary"
                      className="w-full"
                    >
                      Associate Chat
                    </Button>
                  </motion.div>
                </div>
              )}
            </form>
          )}
        </div>
      </Dialog>
    </DialogRoot>
  );
};
