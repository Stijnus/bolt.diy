import * as RadixDialog from '@radix-ui/react-dialog';
import { motion, type Variants } from 'framer-motion';
import React, { memo, type ReactNode, useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { classNames } from '~/utils/classNames';
import { cubicEasingFn } from '~/utils/easings';
import { Button } from './Button';
import { FixedSizeList } from 'react-window';
import { Checkbox } from './Checkbox';
import { Label } from './Label';

export { Close as DialogClose, Root as DialogRoot } from '@radix-ui/react-dialog';

export const DialogTitle = memo(({ className, children, ...props }: RadixDialog.DialogTitleProps) => {
  return (
    <RadixDialog.Title
      className={classNames('text-lg font-medium text-bolt-elements-textPrimary flex items-center gap-2', className)}
      {...props}
    >
      {children}
    </RadixDialog.Title>
  );
});

export const DialogDescription = memo(({ className, children, ...props }: RadixDialog.DialogDescriptionProps) => {
  return (
    <RadixDialog.Description
      className={classNames('text-sm text-bolt-elements-textSecondary mt-1', className)}
      {...props}
    >
      {children}
    </RadixDialog.Description>
  );
});

const transition = {
  duration: 0.15,
  ease: cubicEasingFn,
};

export const dialogBackdropVariants = {
  closed: {
    opacity: 0,
    transition,
  },
  open: {
    opacity: 1,
    transition,
  },
} satisfies Variants;

export const dialogVariants = {
  closed: {
    x: '-50%',
    y: '-40%',
    scale: 0.96,
    opacity: 0,
    transition,
  },
  open: {
    x: '-50%',
    y: '-50%',
    scale: 1,
    opacity: 1,
    transition,
  },
} satisfies Variants;

interface DialogProps {
  children: ReactNode;
  className?: string;
  showCloseButton?: boolean;
  onClose?: () => void;
  onBackdrop?: () => void;
}

export const Dialog = memo(({ children, className, showCloseButton = true, onClose, onBackdrop }: DialogProps) => {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay asChild>
        <motion.div
          className={classNames('fixed inset-0 z-[9999] modal-overlay backdrop-blur-sm')}
          initial="closed"
          animate="open"
          exit="closed"
          variants={dialogBackdropVariants}
          onClick={onBackdrop}
        />
      </RadixDialog.Overlay>
      <RadixDialog.Content asChild>
        <motion.div
          className={classNames(
            'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 modal-content rounded-lg shadow-xl border border-bolt-elements-borderColor z-[9999] w-[640px] focus:outline-none',
            className,
          )}
          initial="closed"
          animate="open"
          exit="closed"
          variants={dialogVariants}
        >
          <div className="flex flex-col">
            {children}
            {showCloseButton && (
              <RadixDialog.Close asChild onClick={onClose}>
                <button className="absolute top-3 right-3 p-2 bg-transparent text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary transition-colors rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </RadixDialog.Close>
            )}
          </div>
        </motion.div>
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
});

/**
 * Props for the ConfirmationDialog component
 */
export interface ConfirmationDialogProps {
  /**
   * Whether the dialog is open
   */
  isOpen: boolean;

  /**
   * Callback when the dialog is closed
   */
  onClose: () => void;

  /**
   * Callback when the confirm button is clicked
   */
  onConfirm: () => void;

  /**
   * The title of the dialog
   */
  title: string;

  /**
   * The description of the dialog
   */
  description: string;

  /**
   * The text for the confirm button
   */
  confirmLabel?: string;

  /**
   * The text for the cancel button
   */
  cancelLabel?: string;

  /**
   * The variant of the confirm button
   */
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';

  /**
   * Whether the confirm button is in a loading state
   */
  isLoading?: boolean;
}

/**
 * A reusable confirmation dialog component that uses the Dialog component
 */
export function ConfirmationDialog({
  isOpen,
  onClose,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  isLoading = false,
  onConfirm,
}: ConfirmationDialogProps) {
  return (
    <RadixDialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog showCloseButton={false}>
        <div className="relative z-10" style={{ padding: 'var(--bolt-elements-component-padding-lg)' }}>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription style={{ marginBottom: 'var(--bolt-elements-spacing-lg)' }}>
            {description}
          </DialogDescription>
          <div className="flex justify-end" style={{ gap: 'var(--bolt-elements-spacing-sm)' }}>
            <Button variant="outline" onClick={onClose} disabled={isLoading}>
              {cancelLabel}
            </Button>
            <Button variant={variant} onClick={onConfirm} disabled={isLoading}>
              {isLoading ? (
                <div className="flex items-center" style={{ gap: 'var(--bolt-elements-spacing-sm)' }}>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {confirmLabel}
                </div>
              ) : (
                confirmLabel
              )}
            </Button>
          </div>
        </div>
      </Dialog>
    </RadixDialog.Root>
  );
}

/**
 * Type for selection item in SelectionDialog
 */
type SelectionItem = {
  id: string;
  label: string;
  description?: string;
};

/**
 * Props for the SelectionDialog component
 */
export interface SelectionDialogProps {
  /**
   * The title of the dialog
   */
  title: string;

  /**
   * The items to select from
   */
  items: SelectionItem[];

  /**
   * Whether the dialog is open
   */
  isOpen: boolean;

  /**
   * Callback when the dialog is closed
   */
  onClose: () => void;

  /**
   * Callback when the confirm button is clicked with selected item IDs
   */
  onConfirm: (selectedIds: string[]) => void;

  /**
   * The text for the confirm button
   */
  confirmLabel?: string;

  /**
   * The maximum height of the selection list
   */
  maxHeight?: string;
}

/**
 * A reusable selection dialog component that uses the Dialog component
 */
export function SelectionDialog({
  title,
  items,
  isOpen,
  onClose,
  onConfirm,
  confirmLabel = 'Confirm',
  maxHeight = '60vh',
}: SelectionDialogProps) {
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);

  // Reset selected items when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSelectedItems([]);
      setSelectAll(false);
    }
  }, [isOpen]);

  const handleToggleItem = (id: string) => {
    setSelectedItems((prev) => (prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]));
  };

  const handleSelectAll = () => {
    if (selectedItems.length === items.length) {
      setSelectedItems([]);
      setSelectAll(false);
    } else {
      setSelectedItems(items.map((item) => item.id));
      setSelectAll(true);
    }
  };

  const handleConfirm = () => {
    onConfirm(selectedItems);
    onClose();
  };

  // Calculate the height for the virtualized list
  const listHeight = Math.min(
    items.length * 60,
    parseInt(maxHeight.replace('vh', '')) * window.innerHeight * 0.01 - 40,
  );

  // Render each item in the virtualized list
  const ItemRenderer = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const item = items[index];
    return (
      <div
        key={item.id}
        className={classNames(
          'flex items-start space-x-3 p-2 rounded-md transition-colors',
          selectedItems.includes(item.id)
            ? 'bg-bolt-elements-item-backgroundAccent'
            : 'bg-bolt-elements-bg-depth-2 hover:bg-bolt-elements-item-backgroundActive',
        )}
        style={{
          ...style,
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <Checkbox
          id={`item-${item.id}`}
          checked={selectedItems.includes(item.id)}
          onCheckedChange={() => handleToggleItem(item.id)}
        />
        <div className="grid gap-1.5 leading-none">
          <Label
            htmlFor={`item-${item.id}`}
            className={classNames(
              'text-sm font-medium cursor-pointer',
              selectedItems.includes(item.id)
                ? 'text-bolt-elements-item-contentAccent'
                : 'text-bolt-elements-textPrimary',
            )}
          >
            {item.label}
          </Label>
          {item.description && <p className="text-xs text-bolt-elements-textSecondary">{item.description}</p>}
        </div>
      </div>
    );
  };

  return (
    <RadixDialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog showCloseButton={false}>
        <div className="relative z-10" style={{ padding: 'var(--bolt-elements-component-padding-lg)' }}>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription
            style={{
              marginTop: 'var(--bolt-elements-spacing-sm)',
              marginBottom: 'var(--bolt-elements-spacing-lg)',
            }}
          >
            Select the items you want to include and click{' '}
            <span className="text-bolt-elements-item-contentAccent font-medium">{confirmLabel}</span>.
          </DialogDescription>

          <div
            style={{ paddingTop: 'var(--bolt-elements-spacing-lg)', paddingBottom: 'var(--bolt-elements-spacing-lg)' }}
          >
            <div
              className="flex items-center justify-between"
              style={{ marginBottom: 'var(--bolt-elements-spacing-lg)' }}
            >
              <span className="text-sm font-medium text-bolt-elements-textSecondary">
                {selectedItems.length} of {items.length} selected
              </span>
              <Button variant="ghost" size="sm" onClick={handleSelectAll} className="text-xs h-8 px-2">
                {selectAll ? 'Deselect All' : 'Select All'}
              </Button>
            </div>

            <div
              className="pr-2 border rounded-md border-bolt-elements-borderColor bg-bolt-elements-bg-depth-2"
              style={{
                maxHeight,
              }}
            >
              {items.length > 0 ? (
                <FixedSizeList
                  height={listHeight}
                  width="100%"
                  itemCount={items.length}
                  itemSize={60}
                  className="scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-bolt-elements-bg-depth-3"
                >
                  {ItemRenderer}
                </FixedSizeList>
              ) : (
                <div className="text-center py-4 text-sm text-bolt-elements-textTertiary">No items to display</div>
              )}
            </div>
          </div>

          <div className="flex justify-between" style={{ marginTop: 'var(--bolt-elements-spacing-xl)' }}>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleConfirm} disabled={selectedItems.length === 0}>
              {confirmLabel}
            </Button>
          </div>
        </div>
      </Dialog>
    </RadixDialog.Root>
  );
}
