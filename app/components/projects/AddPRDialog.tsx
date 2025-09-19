import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { X, ExternalLink } from 'lucide-react';
import { Dialog, DialogRoot, DialogTitle, DialogDescription } from '~/components/ui/Dialog';
import { Button } from '~/components/ui/Button';
import { Input } from '~/components/ui/Input';
import { Label } from '~/components/ui/Label';
import { Select } from '~/components/ui/Select';
import type { Feature, Project } from './types';
import { createPR } from '~/lib/services/prService';
import { toast } from 'react-toastify';

type Provider = 'github' | 'gitlab' | 'other';

interface AddPRDialogProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  feature: Feature | null;
}

/* eslint-disable-next-line @typescript-eslint/naming-convention */
export const AddPRDialog = ({ isOpen, onClose, project, feature }: AddPRDialogProps) => {
  const [provider, setProvider] = useState<Provider>('github');
  const [title, setTitle] = useState('');
  const [base, setBase] = useState(feature?.branchFrom || 'main');
  const [creating, setCreating] = useState(false);

  const link = useMemo(() => {
    if (!feature) {
      return '';
    }

    const gitUrl = project.gitUrl || '';
    const clean = gitUrl.replace(/\.git$/, '');

    if (provider === 'github' && clean.includes('github.com')) {
      return `${clean}/compare/${encodeURIComponent(base)}...${encodeURIComponent(feature.branchRef)}?expand=1`;
    }

    if (provider === 'gitlab' && clean.includes('gitlab.com')) {
      return `${clean}/-/merge_requests/new?merge_request%5Bsource_branch%5D=${encodeURIComponent(feature.branchRef)}&merge_request%5Btarget_branch%5D=${encodeURIComponent(base)}`;
    }

    return '';
  }, [project.gitUrl, feature, provider, base]);

  const submit = async () => {
    if (!feature) {
      return;
    }

    setCreating(true);

    try {
      const pr = await createPR({
        projectId: project.id,
        featureId: feature.id,
        provider,
        url: link || project.gitUrl,
        title: title || feature.name,
        branch: feature.branchRef,
        baseBranch: base,
      });
      toast.success('PR created (metadata saved)');
      onClose();
      window.open(pr.url, '_blank');
    } catch (e) {
      console.error(e);
      toast.error('Failed to create PR metadata');
    } finally {
      setCreating(false);
    }
  };

  return (
    <DialogRoot open={isOpen} onOpenChange={onClose}>
      <Dialog showCloseButton={false} className="max-w-md">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <DialogTitle>Create Pull/Merge Request</DialogTitle>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              className="p-2 bg-transparent"
            >
              <X className="w-5 h-5" />
            </motion.button>
          </div>
          <DialogDescription className="mb-4">Prepare a PR/MR for this feature branch.</DialogDescription>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Provider</Label>
              <Select value={provider} onChange={(e) => setProvider(e.target.value as Provider)}>
                <option value="github">GitHub</option>
                <option value="gitlab">GitLab</option>
                <option value="other">Other</option>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={feature?.name || ''} />
            </div>

            <div className="space-y-1">
              <Label>Base Branch</Label>
              <Input value={base} onChange={(e) => setBase(e.target.value)} />
            </div>

            {link && (
              <div className="p-3 rounded border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 text-sm flex items-center justify-between">
                <span className="truncate mr-2">{link}</span>
                <a
                  className="text-purple-600 hover:underline inline-flex items-center gap-1"
                  href={link}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink className="w-4 h-4" /> Open
                </a>
              </div>
            )}
          </div>

          <div className="mt-5 flex gap-2">
            <Button onClick={onClose} variant="outline" className="flex-1">
              Cancel
            </Button>
            <Button onClick={submit} className="flex-1" variant="primary" disabled={!feature || creating}>
              Create
            </Button>
          </div>
        </div>
      </Dialog>
    </DialogRoot>
  );
};
