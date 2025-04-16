import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useStore } from '@nanostores/react';
import type { FileMap } from '~/lib/stores/files';
import { classNames } from '~/utils/classNames';
import { createScopedLogger } from '~/utils/logger';
import * as ContextMenu from '@radix-ui/react-context-menu';
import type { FileHistory } from '~/types/actions';
import { diffLines } from 'diff';
import { workbenchStore, lockedFilesAtom } from '~/lib/stores/workbench';
import { toast } from 'react-toastify';
import { path } from '~/utils/path';
import { chatId } from '~/lib/persistence/useChatHistory';

const logger = createScopedLogger('FileTree');

const NODE_PADDING_LEFT = 8;
const DEFAULT_HIDDEN_FILES = [/\/node_modules\//, /\/\.next/, /\/\.astro/];

interface Props {
  files?: FileMap;
  selectedFile?: string;
  onFileSelect?: (filePath: string) => void;
  rootFolder?: string;
  hideRoot?: boolean;
  collapsed?: boolean;
  allowFolderSelection?: boolean;
  hiddenFiles?: Array<string | RegExp>;
  unsavedFiles?: Set<string>;
  fileHistory?: Record<string, FileHistory>;
  className?: string;
}

interface InlineInputProps {
  depth: number;
  placeholder: string;
  initialValue?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

export const FileTree = memo((props: Props) => {
  const {
    files = {},
    onFileSelect,
    selectedFile,
    rootFolder,
    hideRoot = false,
    collapsed = false,
    allowFolderSelection = false,
    hiddenFiles,
    className,
    unsavedFiles,
    fileHistory = {},
  } = props;

  // Use try-catch to handle potential workbenchStore initialization issues
  let lockedFiles = new Set<string>();

  try {
    if (typeof workbenchStore !== 'undefined' && workbenchStore) {
      lockedFiles = lockedFilesAtom.get();
      console.debug('FileTree accessing locked files:', [...lockedFiles]);
    } else {
      console.warn('workbenchStore not yet initialized in FileTree component');
    }
  } catch (error) {
    console.error('Error accessing locked files in FileTree:', error);
  }

  // Safe version of useStore that won't crash if atoms aren't ready
  const safeUseStore = (atom: any, defaultValue: any) => {
    try {
      return useStore(atom);
    } catch (error) {
      console.warn('Error using store:', error);
      return defaultValue;
    }
  };

  /*
   * We're not directly using these variables but they're kept for future reference
   */
  /*
   * const filesStore = safeUseStore(workbenchStore?.files, {});
   * const selectedFileStore = safeUseStore(workbenchStore?.selectedFile, undefined);
   */
  const lockedFilesStore = safeUseStore(lockedFilesAtom, new Set<string>());

  /*
   * Additional unused variables commented out
   */
  /*
   * const unsavedFilesStore = safeUseStore(workbenchStore?.unsavedFiles, new Set<string>());
   * const fileModifications = workbenchStore.getFileModifcations();
   */

  // Add debugging during mount to track locked files
  useEffect(() => {
    console.debug(
      'FileTree mounted with locked files:',
      lockedFilesStore instanceof Set ? [...lockedFilesStore] : 'not a Set',
    );

    // Debug function to check localStorage directly
    if (typeof localStorage !== 'undefined') {
      try {
        // Find all lock-related keys in localStorage
        const lockKeys = [];

        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);

          if (key && key.includes('bolt-locked-files')) {
            lockKeys.push(key);
          }
        }

        // Log all lock-related data
        console.debug('Lock keys in localStorage:', lockKeys);
        lockKeys.forEach((key) => {
          const value = localStorage.getItem(key);

          if (value) {
            try {
              const parsed = JSON.parse(value);
              console.debug(`Locked files from ${key}:`, parsed);
            } catch (e) {
              console.error(`Error parsing ${key}:`, e);
            }
          }
        });

        // Check if we need to force synchronize locked files
        if (lockedFilesStore.size === 0 && lockKeys.length > 0) {
          console.debug('Found locked files in localStorage but none in store, forcing sync');

          // Try to sync from localStorage directly if the current chat ID is available
          const currentId = getCurrentChatId();
          if (currentId) {
            const chatKey = `bolt-locked-files-${currentId}`;
            const lockedFilesJson = localStorage.getItem(chatKey);

            if (lockedFilesJson) {
              try {
                setTimeout(() => {
                  // Force a sync if workbenchStore is available
                  if (typeof workbenchStore !== 'undefined') {
                    console.debug('Force syncing locked files to workbenchStore');
                    workbenchStore.syncLockedFilesFromGlobal(true);
                  }
                }, 300);
              } catch (syncError) {
                console.error('Error force syncing locked files:', syncError);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error checking localStorage:', error);
      }
    }
  }, []);

  // Force refresh when locked files change
  useEffect(() => {
    console.debug('Locked files updated in FileTree:', [...lockedFilesStore]);
  }, [lockedFilesStore]);

  // Instead of relying on Toast messages, manually suppress them on initial load
  useEffect(() => {
    // Disable toast notifications for initial load
    toast.dismiss();

    // Clear any pending toast messages
    const toastQueue = (toast as any).queue;

    if (toastQueue && Array.isArray(toastQueue)) {
      toastQueue.length = 0;
    }
  }, []);

  // --- Collapsed folders state ---
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(() => new Set());

  // --- Build file list ---
  const computedHiddenFiles = useMemo(() => [...DEFAULT_HIDDEN_FILES, ...(hiddenFiles ?? [])], [hiddenFiles]);
  const fileList = useMemo(
    () => buildFileList(files, rootFolder, hideRoot, computedHiddenFiles),
    [files, rootFolder, hideRoot, computedHiddenFiles],
  );

  useEffect(() => {
    if (collapsed) {
      setCollapsedFolders(new Set(fileList.filter((item) => item.kind === 'folder').map((item) => item.fullPath)));
      return;
    }

    setCollapsedFolders((prevCollapsed) => {
      const newCollapsed = new Set<string>();

      for (const folder of fileList) {
        if (folder.kind === 'folder' && prevCollapsed.has(folder.fullPath)) {
          newCollapsed.add(folder.fullPath);
        }
      }

      return newCollapsed;
    });
  }, [fileList, collapsed]);

  // --- Filtered file list ---
  const filteredFileList = useMemo(() => {
    const list: Node[] = [];
    let lastDepth = Number.MAX_SAFE_INTEGER;

    for (const fileOrFolder of fileList) {
      const depth = fileOrFolder.depth;

      if (lastDepth === depth) {
        lastDepth = Number.MAX_SAFE_INTEGER;
      }

      if (collapsedFolders.has(fileOrFolder.fullPath)) {
        lastDepth = Math.min(lastDepth, depth);
      }

      if (lastDepth < depth) {
        continue;
      }

      list.push(fileOrFolder);
    }

    return list;
  }, [fileList, collapsedFolders]);

  // --- Handlers ---
  const toggleCollapseState = (fullPath: string) => {
    setCollapsedFolders((prevSet: Set<string>) => {
      const newSet = new Set(prevSet);

      if (newSet.has(fullPath)) {
        newSet.delete(fullPath);
      } else {
        newSet.add(fullPath);
      }

      return newSet;
    });
  };

  const onCopyPath = (fileOrFolder: FileNode | FolderNode) => {
    try {
      navigator.clipboard.writeText(fileOrFolder.fullPath);
    } catch (error) {
      logger.error(error);
    }
  };

  const onCopyRelativePath = (fileOrFolder: FileNode | FolderNode) => {
    try {
      navigator.clipboard.writeText(fileOrFolder.fullPath.substring((rootFolder || '').length));
    } catch (error) {
      logger.error(error);
    }
  };

  return (
    <div className={classNames('text-sm', className, 'overflow-y-auto')}>
      {filteredFileList.map((fileOrFolder: Node) => {
        switch (fileOrFolder.kind) {
          case 'file': {
            return (
              <File
                key={fileOrFolder.id}
                selected={selectedFile === fileOrFolder.fullPath}
                file={fileOrFolder}
                unsavedChanges={unsavedFiles?.has(fileOrFolder.fullPath)}
                fileHistory={fileHistory}
                onCopyPath={() => {
                  onCopyPath(fileOrFolder);
                }}
                onCopyRelativePath={() => {
                  onCopyRelativePath(fileOrFolder);
                }}
                onClick={() => {
                  onFileSelect?.(fileOrFolder.fullPath);
                }}
              />
            );
          }
          case 'folder': {
            return (
              <Folder
                key={fileOrFolder.id}
                folder={fileOrFolder}
                selected={allowFolderSelection && selectedFile === fileOrFolder.fullPath}
                collapsed={collapsedFolders.has(fileOrFolder.fullPath)}
                onCopyPath={() => {
                  onCopyPath(fileOrFolder);
                }}
                onCopyRelativePath={() => {
                  onCopyRelativePath(fileOrFolder);
                }}
                onClick={() => {
                  toggleCollapseState(fileOrFolder.fullPath);
                }}
              />
            );
          }
          default: {
            return undefined;
          }
        }
      })}
    </div>
  );
});

export default FileTree;

interface FolderProps {
  folder: FolderNode;
  collapsed: boolean;
  selected?: boolean;
  onCopyPath: () => void;
  onCopyRelativePath: () => void;
  onClick: () => void;
}

interface FolderContextMenuProps {
  onCopyPath?: () => void;
  onCopyRelativePath?: () => void;
  children: ReactNode;
}

function ContextMenuItem({ onSelect, children }: { onSelect?: () => void; children: ReactNode }) {
  return (
    <ContextMenu.Item
      onSelect={onSelect}
      className="flex items-center gap-2 px-2 py-1.5 outline-0 text-sm text-bolt-elements-textPrimary cursor-pointer ws-nowrap text-bolt-elements-item-contentDefault hover:text-bolt-elements-item-contentActive hover:bg-bolt-elements-item-backgroundActive rounded-md"
    >
      <span className="size-4 shrink-0"></span>
      <span>{children}</span>
    </ContextMenu.Item>
  );
}

function InlineInput({ depth, placeholder, initialValue = '', onSubmit, onCancel }: InlineInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();

        if (initialValue) {
          inputRef.current.value = initialValue;
          inputRef.current.select();
        }
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [initialValue]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const value = inputRef.current?.value.trim();

      if (value) {
        onSubmit(value);
      }
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div
      className="flex items-center w-full px-2 bg-bolt-elements-background-depth-4 border border-bolt-elements-item-contentAccent py-0.5 text-bolt-elements-textPrimary"
      style={{ paddingLeft: `${6 + depth * NODE_PADDING_LEFT}px` }}
    >
      <div className="scale-120 shrink-0 i-ph:file-plus text-bolt-elements-textTertiary" />
      <input
        ref={inputRef}
        type="text"
        className="ml-2 flex-1 bg-transparent border-none outline-none py-0.5 text-sm text-bolt-elements-textPrimary placeholder:text-bolt-elements-textTertiary min-w-0"
        placeholder={placeholder}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          setTimeout(() => {
            if (document.activeElement !== inputRef.current) {
              onCancel();
            }
          }, 100);
        }}
      />
    </div>
  );
}

function FileContextMenu({
  onCopyPath,
  onCopyRelativePath,
  fullPath,
  children,
}: FolderContextMenuProps & { fullPath: string }) {
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const depth = useMemo(() => fullPath.split('/').length, [fullPath]);
  const fileName = useMemo(() => path.basename(fullPath), [fullPath]);

  // Use safeUseStore to avoid initialization errors
  const safeUseStore = (atom: any, defaultValue: any) => {
    try {
      return useStore(atom);
    } catch (e) {
      console.warn('Error using store in FileContextMenu:', e);
      return defaultValue;
    }
  };

  const lockedFiles = safeUseStore(lockedFilesAtom, new Set<string>());
  const isLocked = useMemo(() => {
    return isPathLocked(fullPath, lockedFiles);
  }, [fullPath, lockedFiles]);

  const isFolder = useMemo(() => {
    const files = workbenchStore.files.get();
    const fileEntry = files[fullPath];

    return !fileEntry || fileEntry.type === 'folder';
  }, [fullPath]);

  const targetPath = useMemo(() => {
    return isFolder ? fullPath : path.dirname(fullPath);
  }, [fullPath, isFolder]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const items = Array.from(e.dataTransfer.items);
      const files = items.filter((item) => item.kind === 'file');

      for (const item of files) {
        const file = item.getAsFile();

        if (file) {
          try {
            const filePath = path.join(fullPath, file.name);

            // Convert file to binary data (Uint8Array)
            const arrayBuffer = await file.arrayBuffer();
            const binaryContent = new Uint8Array(arrayBuffer);

            const success = await workbenchStore.createFile(filePath, binaryContent);

            if (success) {
              toast.success(`File ${file.name} uploaded successfully`);
            } else {
              toast.error(`Failed to upload file ${file.name}`);
            }
          } catch (error) {
            toast.error(`Error uploading ${file.name}`);
            logger.error(error);
          }
        }
      }

      setIsDragging(false);
    },
    [fullPath],
  );

  const handleCreateFile = async (fileName: string) => {
    const newFilePath = path.join(targetPath, fileName);
    const success = await workbenchStore.createFile(newFilePath, '');

    if (success) {
      toast.success('File created successfully');
    } else {
      toast.error('Failed to create file');
    }

    setIsCreatingFile(false);
  };

  const handleCreateFolder = async (folderName: string) => {
    const newFolderPath = path.join(targetPath, folderName);
    const success = await workbenchStore.createFolder(newFolderPath);

    if (success) {
      toast.success('Folder created successfully');
    } else {
      toast.error('Failed to create folder');
    }

    setIsCreatingFolder(false);
  };

  const handleDelete = async () => {
    try {
      if (!confirm(`Are you sure you want to delete ${isFolder ? 'folder' : 'file'}: ${fileName}?`)) {
        return;
      }

      let success;

      if (isFolder) {
        success = await workbenchStore.deleteFolder(fullPath);
      } else {
        success = await workbenchStore.deleteFile(fullPath);
      }

      if (success) {
        toast.success(`${isFolder ? 'Folder' : 'File'} deleted successfully`);
      } else {
        toast.error(`Failed to delete ${isFolder ? 'folder' : 'file'}`);
      }
    } catch (error) {
      toast.error(`Error deleting ${isFolder ? 'folder' : 'file'}`);
      logger.error(error);
    }
  };

  return (
    <>
      <ContextMenu.Root>
        <ContextMenu.Trigger>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={classNames('relative', {
              'bg-bolt-elements-background-depth-2 border border-dashed border-bolt-elements-item-contentAccent rounded-md':
                isDragging,
            })}
          >
            {children}
          </div>
        </ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Content
            style={{ zIndex: 998 }}
            className="border border-bolt-elements-borderColor rounded-md z-context-menu bg-bolt-elements-background-depth-1 dark:bg-bolt-elements-background-depth-2 data-[state=open]:animate-in animate-duration-100 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-98 w-56"
          >
            <ContextMenu.Group className="p-1 border-b-px border-solid border-bolt-elements-borderColor">
              <ContextMenuItem onSelect={() => setIsCreatingFile(true)}>
                <div className="flex items-center gap-2">
                  <div className="i-ph:file-plus" />
                  New File
                </div>
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => setIsCreatingFolder(true)}>
                <div className="flex items-center gap-2">
                  <div className="i-ph:folder-plus" />
                  New Folder
                </div>
              </ContextMenuItem>
            </ContextMenu.Group>
            <ContextMenu.Group className="p-1">
              <ContextMenuItem onSelect={onCopyPath}>Copy path</ContextMenuItem>
              <ContextMenuItem onSelect={onCopyRelativePath}>Copy relative path</ContextMenuItem>
            </ContextMenu.Group>

            {!isFolder && (
              <ContextMenu.Group className="p-1 border-t-px border-solid border-bolt-elements-borderColor">
                <ContextMenuItem onSelect={() => workbenchStore.toggleLockFile(fullPath)}>
                  <div className="flex items-center gap-2">
                    <div
                      className={
                        isLocked
                          ? 'i-ph:lock-key text-bolt-elements-textSecondary'
                          : 'i-ph:lock-key-open text-bolt-elements-textSecondary'
                      }
                    />
                    {isLocked ? <span className="font-medium">Unlock File</span> : <span>Lock File</span>}
                  </div>
                </ContextMenuItem>
              </ContextMenu.Group>
            )}

            {isFolder && (
              <ContextMenu.Group className="p-1 border-t-px border-solid border-bolt-elements-borderColor">
                <ContextMenuItem onSelect={() => workbenchStore.toggleLockFolder(fullPath)}>
                  <div className="flex items-center gap-2">
                    <div
                      className={
                        isLocked
                          ? 'i-ph:lock-key text-bolt-elements-textSecondary'
                          : 'i-ph:lock-key-open text-bolt-elements-textSecondary'
                      }
                    />
                    {isLocked ? <span className="font-medium">Unlock Folder</span> : <span>Lock Folder</span>}
                  </div>
                </ContextMenuItem>
              </ContextMenu.Group>
            )}

            <ContextMenu.Group className="p-1 border-t-px border-solid border-bolt-elements-borderColor">
              <ContextMenuItem onSelect={handleDelete}>
                <div className="flex items-center gap-2 text-red-500">
                  <div className="i-ph:trash" />
                  Delete {isFolder ? 'Folder' : 'File'}
                </div>
              </ContextMenuItem>
            </ContextMenu.Group>
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu.Root>
      {isCreatingFile && (
        <InlineInput
          depth={depth}
          placeholder="Enter file name..."
          onSubmit={handleCreateFile}
          onCancel={() => setIsCreatingFile(false)}
        />
      )}
      {isCreatingFolder && (
        <InlineInput
          depth={depth}
          placeholder="Enter folder name..."
          onSubmit={handleCreateFolder}
          onCancel={() => setIsCreatingFolder(false)}
        />
      )}
    </>
  );
}

function Folder({ folder, collapsed, selected = false, onCopyPath, onCopyRelativePath, onClick }: FolderProps) {
  // Use safeUseStore to avoid initialization errors
  const safeUseStore = (atom: any, defaultValue: any) => {
    try {
      return useStore(atom);
    } catch (e) {
      console.warn('Error using store in Folder component:', e);
      return defaultValue;
    }
  };

  const lockedFiles = safeUseStore(lockedFilesAtom, new Set<string>());
  const isLocked = useMemo(() => {
    return isPathLocked(folder.fullPath, lockedFiles);
  }, [folder.fullPath, lockedFiles]);

  useEffect(() => {
    // Log locked folders to help with debugging
    if (isLocked) {
      console.debug(`Folder is locked: ${folder.fullPath}`);
    }
  }, [isLocked, folder.fullPath]);

  return (
    <FileContextMenu onCopyPath={onCopyPath} onCopyRelativePath={onCopyRelativePath} fullPath={folder.fullPath}>
      <NodeButton
        className={classNames('group', {
          'bg-transparent text-bolt-elements-item-contentDefault hover:text-bolt-elements-item-contentActive hover:bg-bolt-elements-item-backgroundActive':
            !selected && !isLocked,
          'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent': selected,
          'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30': isLocked && !selected,
        })}
        depth={folder.depth}
        iconClasses={classNames({
          'i-ph:caret-right scale-98': collapsed,
          'i-ph:caret-down scale-98': !collapsed,
        })}
        onClick={onClick}
      >
        <span className={isLocked ? 'text-blue-600 font-medium' : undefined}>
          {folder.name}
          {isLocked && <span className="text-xs text-blue-500 ml-1">(locked)</span>}
        </span>
        {isLocked && <span className="i-ph:lock-key-fill text-blue-500 ml-1 scale-90" title="Locked folder" />}
      </NodeButton>
    </FileContextMenu>
  );
}

interface FileProps {
  file: FileNode;
  selected: boolean;
  unsavedChanges?: boolean;
  fileHistory?: Record<string, FileHistory>;
  onCopyPath: () => void;
  onCopyRelativePath: () => void;
  onClick: () => void;
}

function File({
  file,
  onClick,
  onCopyPath,
  onCopyRelativePath,
  selected,
  unsavedChanges = false,
  fileHistory = {},
}: FileProps) {
  // removed duplicate isLocked declaration
  const { depth, name, fullPath } = file;

  // Use safeUseStore to avoid initialization errors
  const safeUseStore = (atom: any, defaultValue: any) => {
    try {
      return useStore(atom);
    } catch (e) {
      console.warn('Error using store in File component:', e);
      return defaultValue;
    }
  };

  const lockedFiles = safeUseStore(lockedFilesAtom, new Set<string>());
  const isLocked = useMemo(() => {
    return isPathLocked(fullPath, lockedFiles);
  }, [fullPath, lockedFiles]);

  const fileModifications = fileHistory[fullPath];

  const { additions, deletions } = useMemo(() => {
    if (!fileModifications?.originalContent) {
      return { additions: 0, deletions: 0 };
    }

    const normalizedOriginal = fileModifications.originalContent.replace(/\r\n/g, '\n');
    const normalizedCurrent =
      fileModifications.versions[fileModifications.versions.length - 1]?.content.replace(/\r\n/g, '\n') || '';

    if (normalizedOriginal === normalizedCurrent) {
      return { additions: 0, deletions: 0 };
    }

    const changes = diffLines(normalizedOriginal, normalizedCurrent, {
      newlineIsToken: false,
    });

    return changes.reduce(
      (acc, change) => {
        if (change.added) {
          acc.additions += change.count || 0;
        } else if (change.removed) {
          acc.deletions += change.count || 0;
        }

        return acc;
      },
      { additions: 0, deletions: 0 },
    );
  }, [fileModifications]);

  const showStats = additions > 0 || deletions > 0;

  return (
    <FileContextMenu onCopyPath={onCopyPath} onCopyRelativePath={onCopyRelativePath} fullPath={fullPath}>
      <NodeButton
        className={classNames('group', {
          'bg-transparent hover:bg-bolt-elements-item-backgroundActive text-bolt-elements-item-contentDefault':
            !selected && !isLocked,
          'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent': selected,
          'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30': isLocked && !selected,
        })}
        depth={depth}
        iconClasses={classNames('i-ph:file-duotone scale-98', {
          'group-hover:text-bolt-elements-item-contentActive': !selected && !isLocked,
          'text-blue-500': isLocked,
        })}
        onClick={onClick}
      >
        <div
          className={classNames('flex items-center justify-between w-full', {
            'group-hover:text-bolt-elements-item-contentActive': !selected && !isLocked,
          })}
        >
          <div
            className={classNames('flex-1 truncate pr-2', {
              'text-blue-600 font-medium': isLocked,
            })}
          >
            {name}
            {isLocked && <span className="text-xs text-blue-500 ml-1">(locked)</span>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {showStats && (
              <div className="flex items-center gap-1 text-xs">
                {additions > 0 && <span className="text-green-500">+{additions}</span>}
                {deletions > 0 && <span className="text-red-500">-{deletions}</span>}
              </div>
            )}
            {unsavedChanges && <span className="i-ph:circle-fill scale-68 shrink-0 text-orange-500" />}
            {isLocked && (
              <span
                className="i-ph:lock-key-fill scale-100 shrink-0 text-blue-500"
                title="This file is locked and protected from AI modifications"
              />
            )}
          </div>
        </div>
      </NodeButton>
    </FileContextMenu>
  );
}

interface ButtonProps {
  depth: number;
  iconClasses: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

function NodeButton({ depth, iconClasses, onClick, className, children }: ButtonProps) {
  return (
    <button
      className={classNames(
        'flex items-center gap-1.5 w-full pr-2 border-2 border-transparent text-faded py-0.5',
        className,
      )}
      style={{ paddingLeft: `${6 + depth * NODE_PADDING_LEFT}px` }}
      onClick={() => onClick?.()}
    >
      <div className={classNames('scale-120 shrink-0', iconClasses)}></div>
      <div className="truncate w-full text-left">{children}</div>
    </button>
  );
}

type Node = FileNode | FolderNode;

interface BaseNode {
  id: number;
  depth: number;
  name: string;
  fullPath: string;
}

interface FileNode extends BaseNode {
  kind: 'file';
}

interface FolderNode extends BaseNode {
  kind: 'folder';
}

function buildFileList(
  files: FileMap,
  rootFolder = '/',
  hideRoot: boolean,
  hiddenFiles: Array<string | RegExp>,
): Node[] {
  const folderPaths = new Set<string>();
  const fileList: Node[] = [];

  // Safely get locked files
  let lockedFiles = new Set<string>();

  try {
    if (typeof lockedFilesAtom !== 'undefined') {
      lockedFiles = lockedFilesAtom.get();
      console.debug(`Building file list with ${lockedFiles.size} locked files:`, [...lockedFiles]);
    } else {
      console.warn('lockedFilesAtom not available in buildFileList');
    }
  } catch (error) {
    console.error('Error accessing lockedFilesAtom in buildFileList:', error);
  }

  // Check localStorage directly as a fallback for locked files
  // This can help when the atom hasn't been properly initialized yet
  if (lockedFiles.size === 0 && typeof localStorage !== 'undefined') {
    try {
      // Try to get chat-specific locked files
      const chatKey = `bolt-locked-files-${getCurrentChatId()}`;
      const lockedFilesJson = localStorage.getItem(chatKey);

      if (lockedFilesJson) {
        const lockedFilesArray = JSON.parse(lockedFilesJson);
        if (Array.isArray(lockedFilesArray)) {
          lockedFilesArray.forEach((file) => lockedFiles.add(file));
          console.debug('Loaded locked files from localStorage:', lockedFilesArray);
        }
      }
    } catch (err) {
      console.error('Error loading locked files from localStorage:', err);
    }
  }

  let defaultDepth = 0;

  if (rootFolder === '/' && !hideRoot) {
    defaultDepth = 1;
    fileList.push({ kind: 'folder', name: '/', depth: 0, id: 0, fullPath: '/' });
  }

  // First pass: add all files from the files object
  for (const [filePath, dirent] of Object.entries(files)) {
    const segments = filePath.split('/').filter((segment) => segment);
    const fileName = segments.at(-1);

    if (!fileName || isHiddenFile(filePath, fileName, hiddenFiles)) {
      continue;
    }

    let currentPath = '';

    let i = 0;
    let depth = 0;

    while (i < segments.length) {
      const name = segments[i];
      const fullPath = (currentPath += `/${name}`);

      if (!fullPath.startsWith(rootFolder) || (hideRoot && fullPath === rootFolder)) {
        i++;
        continue;
      }

      if (i === segments.length - 1 && dirent?.type === 'file') {
        fileList.push({
          kind: 'file',
          id: fileList.length,
          name,
          fullPath,
          depth: depth + defaultDepth,
        });
      } else if (!folderPaths.has(fullPath)) {
        folderPaths.add(fullPath);

        fileList.push({
          kind: 'folder',
          id: fileList.length,
          name,
          fullPath,
          depth: depth + defaultDepth,
        });
      }

      i++;
      depth++;
    }
  }

  // Second pass: ensure locked files/folders are in the list even if they're not in the files object
  for (const lockedPath of lockedFiles) {
    // Skip if the path is already represented in the file list
    if (fileList.some((item) => normalizePath(item.fullPath) === lockedPath)) {
      continue;
    }

    // Add any missing locked files/folders
    const segments = lockedPath.split('/').filter(Boolean);
    let currentPath = '';

    for (let i = 0; i < segments.length; i++) {
      const name = segments[i];
      currentPath += `/${name}`;

      // Skip if already in the list
      if (folderPaths.has(currentPath)) {
        continue;
      }

      folderPaths.add(currentPath);

      const isLastSegment = i === segments.length - 1;
      const isFile = isLastSegment && files[currentPath]?.type === 'file';

      fileList.push({
        kind: isFile ? 'file' : 'folder',
        id: fileList.length,
        name,
        fullPath: currentPath,
        depth: i + defaultDepth,
      });
    }
  }

  return sortFileList(rootFolder, fileList, hideRoot);
}

// Helper function to get current chat ID (extract from workbench.ts)
function getCurrentChatId(): string | undefined {
  try {
    // First try to get from atom if available
    if (typeof chatId !== 'undefined') {
      return chatId.get();
    }

    // Fallback: extract from URL if on client side
    if (typeof window !== 'undefined') {
      const match = window.location.pathname.match(/\/chat\/([^/]+)/);
      return match ? match[1] : undefined;
    }
  } catch (error) {
    console.error('Error getting current chat ID:', error);
  }

  return undefined;
}

// Reuse the normalizePath function to ensure consistency
function normalizePath(filePath: string): string {
  if (!filePath) return '';

  // Remove potential workdir prefixes like /home/project/
  let normalizedPath = filePath;

  // Common workdir prefixes to strip
  const workdirPrefixes = ['/home/project/', 'home/project/'];

  // Strip any known prefixes
  for (const prefix of workdirPrefixes) {
    if (normalizedPath.startsWith(prefix)) {
      normalizedPath = normalizedPath.substring(prefix.length);
      break;
    }
  }

  // Remove any leading slashes
  while (normalizedPath.startsWith('/')) {
    normalizedPath = normalizedPath.substring(1);
  }

  // Remove any trailing slashes (except for root dir)
  while (normalizedPath.length > 1 && normalizedPath.endsWith('/')) {
    normalizedPath = normalizedPath.substring(0, normalizedPath.length - 1);
  }

  // Normalize consecutive slashes
  normalizedPath = normalizedPath.replace(/\/+/g, '/');

  return normalizedPath;
}

function isHiddenFile(filePath: string, fileName: string, hiddenFiles: Array<string | RegExp>) {
  return hiddenFiles.some((pathOrRegex) => {
    if (typeof pathOrRegex === 'string') {
      return fileName === pathOrRegex;
    }

    return pathOrRegex.test(filePath);
  });
}

/**
 * Sorts the given list of nodes into a tree structure (still a flat list).
 *
 * This function organizes the nodes into a hierarchical structure based on their paths,
 * with folders appearing before files and all items sorted alphabetically within their level.
 *
 * @note This function mutates the given `nodeList` array for performance reasons.
 *
 * @param rootFolder - The path of the root folder to start the sorting from.
 * @param nodeList - The list of nodes to be sorted.
 *
 * @returns A new array of nodes sorted in depth-first order.
 */
function sortFileList(rootFolder: string, nodeList: Node[], hideRoot: boolean): Node[] {
  logger.trace('sortFileList');

  // Log the number of nodes before sorting
  console.debug(`Sorting file list with ${nodeList.length} nodes`);

  const nodeMap = new Map<string, Node>();
  const childrenMap = new Map<string, Node[]>();

  // pre-sort nodes by name and type
  nodeList.sort((a, b) => compareNodes(a, b));

  for (const node of nodeList) {
    nodeMap.set(node.fullPath, node);

    const parentPath = node.fullPath.slice(0, node.fullPath.lastIndexOf('/'));

    if (parentPath !== rootFolder.slice(0, rootFolder.lastIndexOf('/'))) {
      if (!childrenMap.has(parentPath)) {
        childrenMap.set(parentPath, []);
      }

      childrenMap.get(parentPath)?.push(node);
    }
  }

  const sortedList: Node[] = [];

  const depthFirstTraversal = (path: string): void => {
    const node = nodeMap.get(path);

    if (node) {
      sortedList.push(node);
    }

    const children = childrenMap.get(path);

    if (children) {
      for (const child of children) {
        if (child.kind === 'folder') {
          depthFirstTraversal(child.fullPath);
        } else {
          sortedList.push(child);
        }
      }
    }
  };

  if (hideRoot) {
    // if root is hidden, start traversal from its immediate children
    const rootChildren = childrenMap.get(rootFolder) || [];

    for (const child of rootChildren) {
      depthFirstTraversal(child.fullPath);
    }
  } else {
    depthFirstTraversal(rootFolder);
  }

  // Log the number of nodes after sorting
  console.debug(`Sorted file list has ${sortedList.length} nodes`);

  return sortedList;
}

function compareNodes(a: Node, b: Node): number {
  if (a.kind !== b.kind) {
    return a.kind === 'folder' ? -1 : 1;
  }

  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
}

/*
 * Helper function to check if a path should be displayed as locked
 * This checks both direct locks and parent folder locks
 */
function isPathLocked(fullPath: string, lockedFiles: Set<string>): boolean {
  // First normalize the path using workbenchStore's method
  const normalizedPath = workbenchStore.normalizePath(fullPath);

  // Direct lock check
  if (lockedFiles.has(normalizedPath)) {
    return true;
  }

  // Check if any parent folder is locked
  const pathParts = normalizedPath.split('/');

  while (pathParts.length > 1) {
    pathParts.pop(); // Remove the last part

    const parentPath = pathParts.join('/');

    if (lockedFiles.has(parentPath)) {
      return true;
    }
  }

  return false;
}
