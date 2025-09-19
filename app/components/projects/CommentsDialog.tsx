import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Send, MessageSquare } from 'lucide-react';
import { Dialog, DialogRoot, DialogTitle } from '~/components/ui/Dialog';
import { Button } from '~/components/ui/Button';
import { Input } from '~/components/ui/Input';
import type { Feature, Project } from './types';
import { createComment, getComments, type CommentRow, removeComment } from '~/lib/services/commentService';
import { toast } from 'react-toastify';

interface CommentsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  feature: Feature | null;
}

export function CommentsDialog({ isOpen, onClose, project, feature }: CommentsDialogProps) {
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!feature) {
      return;
    }

    setLoading(true);

    try {
      const rows = await getComments('feature', feature.id);
      setComments(rows);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && feature) {
      void load();
    }
  }, [isOpen, feature?.id]);

  const submit = async () => {
    if (!feature || !text.trim()) {
      return;
    }

    try {
      const row = await createComment({ targetType: 'feature', targetId: feature.id, text, authorId: 'local-user' });
      setComments((prev) => [...prev, row]);
      setText('');
      toast.success('Comment added');
    } catch (e) {
      console.error(e);
      toast.error('Failed to add comment');
    }
  };

  const del = async (id: string) => {
    try {
      await removeComment(id);
      setComments((prev) => prev.filter((c) => c.id !== id));
    } catch {
      toast.error('Failed to delete comment');
    }
  };

  return (
    <DialogRoot open={isOpen} onOpenChange={onClose}>
      <Dialog showCloseButton={false} className="max-w-lg">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <DialogTitle>Comments</DialogTitle>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onClose}
              className="p-2 bg-transparent text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary rounded-lg"
            >
              <X className="w-5 h-5" />
            </motion.button>
          </div>
          {feature && (
            <div className="mb-4 text-sm text-bolt-elements-textSecondary">
              <MessageSquare className="inline w-4 h-4 mr-1" /> {project.name} • {feature.name}
            </div>
          )}

          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {loading ? (
              <div className="text-bolt-elements-textTertiary">Loading...</div>
            ) : comments.length === 0 ? (
              <div className="text-bolt-elements-textTertiary">No comments yet</div>
            ) : (
              comments.map((c) => (
                <div
                  key={c.id}
                  className="p-3 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-xs text-bolt-elements-textSecondary">
                      {c.authorName || c.authorId} • {new Date(c.timestamp).toLocaleString()}
                    </div>
                    <button
                      onClick={() => del(c.id)}
                      className="text-xs text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary"
                      aria-label="Delete comment"
                    >
                      Delete
                    </button>
                  </div>
                  <div className="text-sm text-bolt-elements-textPrimary whitespace-pre-wrap">{c.text}</div>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a comment..." />
            <Button onClick={submit} className="inline-flex items-center">
              <Send className="w-4 h-4 mr-1" /> Send
            </Button>
          </div>
        </div>
      </Dialog>
    </DialogRoot>
  );
}
