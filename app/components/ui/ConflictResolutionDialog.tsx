import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '~/components/ui/Dialog';
import { Button } from '~/components/ui/Button';

interface ConflictResolutionDialogProps {
  isOpen: boolean;
  filePath: string;
  onResolve: (resolution: 'local' | 'remote') => void;
  onClose: () => void;
}

export const ConflictResolutionDialog: React.FC<ConflictResolutionDialogProps> = ({
  isOpen,
  filePath,
  onResolve,
  onClose,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>File Conflict</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            A conflict was detected for the file:
          </p>
          <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white break-all">
            {filePath}
          </p>
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            Please choose which version to keep.
          </p>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => {
              onResolve('remote');
              onClose();
            }}
          >
            Use Remote Version
          </Button>
          <Button
            onClick={() => {
              onResolve('local');
              onClose();
            }}
          >
            Use My Version
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
