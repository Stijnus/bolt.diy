import { motion, type Variants } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from '@remix-run/react';
import { useStore } from '@nanostores/react';
import { Dialog, DialogDescription, DialogRoot, DialogTitle } from '~/components/ui/Dialog';
import { ThemeSwitch } from '~/components/ui/ThemeSwitch';
import { ControlPanel } from '~/components/@settings/core/ControlPanel';
import { ArrowRight, Folder, HelpCircle, LogOut, Plus, Users } from 'lucide-react';
import { SettingsButton } from '~/components/ui/SettingsButton';
import { Button } from '~/components/ui/Button';
import { LoginDialog } from '~/components/auth/LoginDialog';
import { UserSummary } from '~/components/ui/UserSummary';
import { AvatarDropdown } from '~/components/@settings/core/AvatarDropdown';
import { db, deleteById, getAll, chatId, type ChatHistoryItem, useChatHistory } from '~/lib/persistence';
import { cubicEasingFn } from '~/utils/easings';
import { HistoryItem } from './HistoryItem';
import { binDates } from './date-binning';
import { useSearchFilter } from '~/lib/hooks/useSearchFilter';
import { classNames } from '~/utils/classNames';
import { isAuthenticated, currentUser, logout } from '~/lib/stores/auth';
import { showError, showInfo, showSuccess, showWarning } from '~/lib/utils/toast';

const menuVariants = {
  closed: {
    opacity: 0,
    visibility: 'hidden',
    left: '-340px',
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
  open: {
    opacity: 1,
    visibility: 'initial',
    left: 0,
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
} satisfies Variants;

type DialogContent =
  | { type: 'delete'; item: ChatHistoryItem }
  | { type: 'bulkDelete'; items: ChatHistoryItem[] }
  | null;

function CurrentDateTime() {
  const [dateTime, setDateTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setDateTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-2 px-4 py-2 text-sm text-bolt-elements-textSecondary border-b border-bolt-elements-borderColor/50">
      <div className="h-4 w-4 i-ph:clock opacity-80" />
      <div className="flex gap-2">
        <span>{dateTime.toLocaleDateString()}</span>
        <span>{dateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>
  );
}

export const Menu = () => {
  const { duplicateCurrentChat, exportChat } = useChatHistory();
  const menuRef = useRef<HTMLDivElement>(null);
  const authenticated = useStore(isAuthenticated);
  const user = useStore(currentUser);
  const [list, setList] = useState<ChatHistoryItem[]>([]);
  const [open, setOpen] = useState(!authenticated);
  const [dialogContent, setDialogContent] = useState<DialogContent>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<string | undefined>();
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const navigationLinks = [
    { to: '/projects', label: 'Projects', icon: Folder },
    { to: '/teams', label: 'Teams', icon: Users },
    {
      href: 'https://stackblitz-labs.github.io/bolt.diy/',
      label: 'Help & Documentation',
      icon: HelpCircle,
    },
  ];

  const handleLogoutClick = async () => {
    try {
      await logout();
      showSuccess('Signed out');
    } catch (error) {
      console.error('Failed to sign out:', error);
      showError('Failed to sign out');
    }
  };

  const { filteredItems: filteredList, handleSearchChange } = useSearchFilter({
    items: list,
    searchFields: ['description'],
  });

  const loadEntries = useCallback(() => {
    if (db) {
      getAll(db)
        .then((list) => list.filter((item) => item.urlId && item.description))
        .then(setList)
        .catch((error) => showError(error.message));
    }
  }, []);

  const deleteChat = useCallback(
    async (id: string): Promise<void> => {
      if (!db) {
        throw new Error('Database not available');
      }

      // Delete chat snapshot from localStorage
      try {
        const snapshotKey = `snapshot:${id}`;
        localStorage.removeItem(snapshotKey);
        console.log('Removed snapshot for chat:', id);
      } catch (snapshotError) {
        console.error(`Error deleting snapshot for chat ${id}:`, snapshotError);
      }

      // Delete the chat from the database
      await deleteById(db, id);
      console.log('Successfully deleted chat:', id);
    },
    [db],
  );

  const deleteItem = useCallback(
    (event: React.UIEvent, item: ChatHistoryItem) => {
      event.preventDefault();
      event.stopPropagation();

      // Log the delete operation to help debugging
      console.log('Attempting to delete chat:', { id: item.id, description: item.description });

      deleteChat(item.id)
        .then(() => {
          showSuccess('Chat deleted successfully');

          // Always refresh the list
          loadEntries();

          if (chatId.get() === item.id) {
            // hard page navigation to clear the stores
            console.log('Navigating away from deleted chat');
            window.location.pathname = '/';
          }
        })
        .catch((error) => {
          console.error('Failed to delete chat:', error);
          showError('Failed to delete conversation');

          // Still try to reload entries in case data has changed
          loadEntries();
        });
    },
    [loadEntries, deleteChat],
  );

  const deleteSelectedItems = useCallback(
    async (itemsToDeleteIds: string[]) => {
      if (!db || itemsToDeleteIds.length === 0) {
        console.log('Bulk delete skipped: No DB or no items to delete.');
        return;
      }

      console.log(`Starting bulk delete for ${itemsToDeleteIds.length} chats`, itemsToDeleteIds);

      let deletedCount = 0;
      const errors: string[] = [];
      const currentChatId = chatId.get();
      let shouldNavigate = false;

      // Process deletions sequentially using the shared deleteChat logic
      for (const id of itemsToDeleteIds) {
        try {
          await deleteChat(id);
          deletedCount++;

          if (id === currentChatId) {
            shouldNavigate = true;
          }
        } catch (error) {
          console.error(`Error deleting chat ${id}:`, error);
          errors.push(id);
        }
      }

      // Show appropriate toast message
      if (errors.length === 0) {
        showSuccess(`${deletedCount} chat${deletedCount === 1 ? '' : 's'} deleted successfully`);
      } else {
        showWarning(`Deleted ${deletedCount} of ${itemsToDeleteIds.length} chats. ${errors.length} failed.`, {
          autoClose: 5000,
        });
      }

      // Reload the list after all deletions
      await loadEntries();

      // Clear selection state
      setSelectedItems([]);
      setSelectionMode(false);

      // Navigate if needed
      if (shouldNavigate) {
        console.log('Navigating away from deleted chat');
        window.location.pathname = '/';
      }
    },
    [deleteChat, loadEntries, db],
  );

  const closeDialog = () => {
    setDialogContent(null);
  };

  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);

    if (selectionMode) {
      // If turning selection mode OFF, clear selection
      setSelectedItems([]);
    }
  };

  const toggleItemSelection = useCallback((id: string) => {
    setSelectedItems((prev) => {
      const newSelectedItems = prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id];
      console.log('Selected items updated:', newSelectedItems);

      return newSelectedItems; // Return the new array
    });
  }, []); // No dependencies needed

  const handleBulkDeleteClick = useCallback(() => {
    if (selectedItems.length === 0) {
      showInfo('Select at least one chat to delete');
      return;
    }

    const selectedChats = list.filter((item) => selectedItems.includes(item.id));

    if (selectedChats.length === 0) {
      showError('Could not find selected chats');
      return;
    }

    setDialogContent({ type: 'bulkDelete', items: selectedChats });
  }, [selectedItems, list]); // Keep list dependency

  const selectAll = useCallback(() => {
    const allFilteredIds = filteredList.map((item) => item.id);
    setSelectedItems((prev) => {
      const allFilteredAreSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => prev.includes(id));

      if (allFilteredAreSelected) {
        // Deselect only the filtered items
        const newSelectedItems = prev.filter((id) => !allFilteredIds.includes(id));
        console.log('Deselecting all filtered items. New selection:', newSelectedItems);

        return newSelectedItems;
      } else {
        // Select all filtered items, adding them to any existing selections
        const newSelectedItems = [...new Set([...prev, ...allFilteredIds])];
        console.log('Selecting all filtered items. New selection:', newSelectedItems);

        return newSelectedItems;
      }
    });
  }, [filteredList]); // Depends only on filteredList

  useEffect(() => {
    if (!authenticated) {
      setOpen(true);
    } else {
      setShowLoginDialog(false);
    }
  }, [authenticated]);

  useEffect(() => {
    if (open) {
      loadEntries();
    }
  }, [open, loadEntries]);

  // Exit selection mode when sidebar is closed
  useEffect(() => {
    if (!open && selectionMode) {
      /*
       * Don't clear selection state anymore when sidebar closes
       * This allows the selection to persist when reopening the sidebar
       */
      console.log('Sidebar closed, preserving selection state');
    }
  }, [open, selectionMode]);

  useEffect(() => {
    const enterThreshold = 20;
    const exitThreshold = 20;

    function onMouseMove(event: MouseEvent) {
      if (isSettingsOpen) {
        return;
      }

      if (event.pageX < enterThreshold) {
        setOpen(true);
      }

      if (menuRef.current && event.clientX > menuRef.current.getBoundingClientRect().right + exitThreshold) {
        setOpen(false);
      }
    }

    window.addEventListener('mousemove', onMouseMove);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, [isSettingsOpen]);

  const handleDuplicate = async (id: string) => {
    await duplicateCurrentChat(id);
    loadEntries(); // Reload the list after duplication
  };

  const handleSettingsClick = () => {
    setIsSettingsOpen(true);
    setOpen(false);
  };

  const handleSettingsClose = () => {
    setIsSettingsOpen(false);
    setSettingsInitialTab(undefined);
  };

  const setDialogContentWithLogging = useCallback((content: DialogContent) => {
    console.log('Setting dialog content:', content);
    setDialogContent(content);
  }, []);

  return (
    <>
      <motion.div
        ref={menuRef}
        initial="closed"
        animate={open ? 'open' : 'closed'}
        variants={menuVariants}
        style={{ width: '340px' }}
        className={classNames(
          'flex selection-accent flex-col side-menu fixed top-0 h-full rounded-r-2xl',
          'bg-bolt-elements-background border-r border-bolt-elements-borderColor',
          'shadow-sm text-sm',
          isSettingsOpen ? 'z-40' : 'z-sidebar',
        )}
      >
        <div className="h-12 flex items-center justify-between px-4 border-b border-bolt-elements-borderColor/50 bg-bolt-elements-background-depth-1 rounded-tr-2xl">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm font-medium text-bolt-elements-textPrimary hover:text-bolt-elements-item-contentAccent transition-colors"
          >
            <span className="i-ph:squares-four w-4 h-4" />
            Workspace
          </Link>
        </div>
        <CurrentDateTime />
        <div className="flex-1 flex flex-col h-full w-full overflow-hidden">
          <div className="p-4 space-y-4">
            <div className="flex gap-2">
              <Button asChild variant="cta" size="lg" className="flex-1 px-5 justify-between">
                <Link to="/" className="flex items-center justify-between w-full gap-3">
                  <span className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    <span className="text-sm font-semibold">Start new chat</span>
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
              <Button
                onClick={toggleSelectionMode}
                variant={selectionMode ? 'primary' : 'sidebar-action'}
                size="lg"
                className="px-4 aspect-square"
                aria-label={selectionMode ? 'Exit selection mode' : 'Enter selection mode'}
              >
                <span className={selectionMode ? 'i-ph:x h-4 w-4' : 'i-ph:check-square h-4 w-4'} />
              </Button>
            </div>
            {!authenticated && (
              <div className="rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 px-4 py-3 shadow-sm">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-bolt-elements-textPrimary">Welcome to BoltDIY</p>
                    <p className="text-xs text-bolt-elements-textSecondary">
                      Sign in to save chats, manage your teams, and sync work across sessions.
                    </p>
                  </div>
                  <Button
                    variant="cta"
                    size="lg"
                    className="w-full px-5 justify-between"
                    onClick={() => setShowLoginDialog(true)}
                  >
                    <span className="flex items-center gap-2">
                      <span className="i-ph:sign-in w-4 h-4" />
                      <span className="text-sm font-semibold">Sign In</span>
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
            {authenticated && user && (
              <div className="rounded-lg border border-bolt-elements-borderColor bg-transparent px-4 py-3">
                <div className="flex items-start justify-between gap-4">
                  <UserSummary user={user} showEmail showUsername orientation="vertical" showAvatar={false} />
                  <AvatarDropdown
                    onSelectTab={(tab) => {
                      console.log('AvatarDropdown tab selected:', tab);
                      setSettingsInitialTab(tab);
                      setIsSettingsOpen(true);
                      setOpen(false);
                    }}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-bolt-elements-textSecondary">
                Navigation
              </p>
              <nav className="space-y-2">
                {navigationLinks.map((item) => {
                  const Icon = item.icon;
                  const buttonContent = (
                    <Button variant="sidebar-nav" size="lg" className="w-full justify-between px-4 py-3">
                      <span className="flex items-center gap-3 text-sm font-medium relative z-10">
                        {Icon ? (
                          <Icon className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" />
                        ) : null}
                        {item.label}
                      </span>
                      <ArrowRight className="w-4 h-4 opacity-60 group-hover:opacity-100 transition-all duration-200 group-hover:translate-x-0.5 relative z-10" />
                    </Button>
                  );

                  if ('to' in item && item.to) {
                    return (
                      <Link key={item.label} to={item.to} className="block">
                        {buttonContent}
                      </Link>
                    );
                  }

                  return (
                    <a key={item.label} href={item.href!} target="_blank" rel="noreferrer" className="block">
                      {buttonContent}
                    </a>
                  );
                })}
              </nav>
            </div>
            <div className="relative w-full">
              <div className="absolute left-3 top-1/2 -translate-y-1/2">
                <span className="i-ph:magnifying-glass h-4 w-4 text-bolt-elements-textTertiary" />
              </div>
              <input
                className="w-full bg-transparent relative pl-9 pr-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500/50 text-sm text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary border border-bolt-elements-borderColor/40 hover:border-bolt-elements-borderColor focus:border-bolt-elements-borderColorActive/50 transition-colors duration-200"
                type="search"
                placeholder="Search chats..."
                onChange={handleSearchChange}
                aria-label="Search chats"
              />
            </div>
          </div>
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-6 h-6 rounded-md bg-bolt-elements-background-depth-2/50 border border-bolt-elements-borderColor/30">
                  <span className="i-ph:clock-counter-clockwise w-3.5 h-3.5 text-bolt-elements-textSecondary" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wide text-bolt-elements-textSecondary">
                  Chat History
                </span>
              </div>
              {selectionMode && (
                <div className="flex items-center gap-1.5">
                  <Button variant="sidebar-action" size="sm" className="px-2 py-1 text-xs h-7" onClick={selectAll}>
                    <span className="i-ph:check-circle w-3 h-3 mr-1" />
                    {selectedItems.length === filteredList.length ? 'None' : 'All'}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="px-2 py-1 text-xs h-7"
                    onClick={handleBulkDeleteClick}
                    disabled={selectedItems.length === 0}
                  >
                    <span className="i-ph:trash w-3 h-3 mr-1" />
                    Delete
                  </Button>
                </div>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-auto px-3 pb-3">
            {filteredList.length === 0 && (
              <div className="px-4 text-bolt-elements-textSecondary text-sm">
                {list.length === 0 ? 'No previous conversations' : 'No matches found'}
              </div>
            )}
            <DialogRoot open={dialogContent !== null}>
              {binDates(filteredList).map(({ category, items }) => (
                <div key={category} className="mt-2 first:mt-0 space-y-1">
                  <div className="text-xs font-medium text-bolt-elements-textSecondary sticky top-0 z-1 bg-bolt-elements-background px-4 py-1">
                    {category}
                  </div>
                  <div className="space-y-0.5 pr-1">
                    {items.map((item) => (
                      <HistoryItem
                        key={item.id}
                        item={item}
                        exportChat={exportChat}
                        onDelete={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          console.log('Delete triggered for item:', item);
                          setDialogContentWithLogging({ type: 'delete', item });
                        }}
                        onDuplicate={() => handleDuplicate(item.id)}
                        selectionMode={selectionMode}
                        isSelected={selectedItems.includes(item.id)}
                        onToggleSelection={toggleItemSelection}
                      />
                    ))}
                  </div>
                </div>
              ))}
              <Dialog onBackdrop={closeDialog} onClose={closeDialog}>
                {dialogContent?.type === 'delete' && (
                  <>
                    <div className="p-6 bg-bolt-elements-background">
                      <DialogTitle className="text-bolt-elements-textPrimary">Delete Chat?</DialogTitle>
                      <DialogDescription className="mt-2 text-bolt-elements-textSecondary">
                        <p>
                          You are about to delete{' '}
                          <span className="font-medium text-bolt-elements-textPrimary">
                            {dialogContent.item.description}
                          </span>
                        </p>
                        <p className="mt-2">Are you sure you want to delete this chat?</p>
                      </DialogDescription>
                    </div>
                    <div className="flex justify-end gap-3 px-6 py-4 bg-bolt-elements-background-depth-2 border-t border-bolt-elements-borderColor">
                      <Button variant="outline" onClick={closeDialog}>
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={(event) => {
                          console.log('Dialog delete button clicked for item:', dialogContent.item);
                          deleteItem(event, dialogContent.item);
                          closeDialog();
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </>
                )}
                {dialogContent?.type === 'bulkDelete' && (
                  <>
                    <div className="p-6 bg-bolt-elements-background">
                      <DialogTitle className="text-bolt-elements-textPrimary">Delete Selected Chats?</DialogTitle>
                      <DialogDescription className="mt-2 text-bolt-elements-textSecondary">
                        <p>
                          You are about to delete {dialogContent.items.length}{' '}
                          {dialogContent.items.length === 1 ? 'chat' : 'chats'}:
                        </p>
                        <div className="mt-2 max-h-32 overflow-auto border border-bolt-elements-borderColor rounded-md bg-bolt-elements-background-depth-2 p-2">
                          <ul className="list-disc pl-5 space-y-1">
                            {dialogContent.items.map((item) => (
                              <li key={item.id} className="text-sm">
                                <span className="font-medium text-bolt-elements-textPrimary">{item.description}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <p className="mt-3">Are you sure you want to delete these chats?</p>
                      </DialogDescription>
                    </div>
                    <div className="flex justify-end gap-3 px-6 py-4 bg-bolt-elements-background-depth-2 border-t border-bolt-elements-borderColor">
                      <Button variant="outline" onClick={closeDialog}>
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => {
                          /*
                           * Pass the current selectedItems to the delete function.
                           * This captures the state at the moment the user confirms.
                           */
                          const itemsToDeleteNow = [...selectedItems];
                          console.log('Bulk delete confirmed for', itemsToDeleteNow.length, 'items', itemsToDeleteNow);
                          deleteSelectedItems(itemsToDeleteNow);
                          closeDialog();
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </>
                )}
              </Dialog>
            </DialogRoot>
          </div>
          <div className="flex items-center justify-between border-t border-bolt-elements-borderColor px-4 py-3">
            <div className="flex items-center gap-3">
              <SettingsButton onClick={handleSettingsClick} />
              {authenticated && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogoutClick}
                  className="flex items-center gap-2 text-bolt-elements-textSecondary hover:text-red-600"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </Button>
              )}
            </div>
            <ThemeSwitch />
          </div>
        </div>
      </motion.div>

      <ControlPanel open={isSettingsOpen} onClose={handleSettingsClose} initialTab={settingsInitialTab as any} />
      <LoginDialog isOpen={showLoginDialog} onClose={() => setShowLoginDialog(false)} />
    </>
  );
};
