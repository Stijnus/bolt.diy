import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { atom, map, computed } from 'nanostores';
import { WorkbenchStore } from './workbench';
import type { SyncSettings, SyncHistoryEntry, ProjectSyncInfo } from '~/types/sync';
import type { EditorDocument, FileEntry, FileMap } from './files'; // Adjust if actual types are different

// --- Mocks ---

// FileSystemDirectoryHandle and related mocks
const mockFileSystem = new Map<string, any>(); // path -> { content: string, type: 'file' | 'directory', children: Map? }

vi.mock('~/lib/persistence/sync-folder', () => ({
  loadSyncFolderHandle: vi.fn(async () => {
    // Return a mock handle if a folder is "set" in tests
    if (mockSyncFolderHandle) return mockSyncFolderHandle;
    return null;
  }),
  saveSyncFolderHandle: vi.fn(async () => {}),
  clearSyncFolderHandle: vi.fn(async () => {}),
}));

vi.mock('~/lib/persistence', () => ({
  getLocalStorage: vi.fn((key) => {
    if (key === 'syncSettings') return mockSyncSettingsStoreInitialValue;
    return null;
  }),
  setLocalStorage: vi.fn(),
  description: { value: 'test-project' }, // Mock project name
}));

vi.mock('react-toastify', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    loading: vi.fn(() => 'toast-id'),
    update: vi.fn(),
    dismiss: vi.fn(),
  },
}));

vi.mock('nanostores', async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    atom: vi.fn((initialValue) => {
      let _value = initialValue;
      const listeners: Set<(value: any) => void> = new Set();
      return {
        get: () => _value,
        set: (newValue: any) => {
          _value = newValue;
          listeners.forEach(fn => fn(_value));
        },
        subscribe: (fn: (value: any) => void) => {
          listeners.add(fn);
          fn(_value); // Immediately call with current value
          return () => listeners.delete(fn);
        },
        // Add other methods if your atom usage is more complex
      };
    }),
    map: vi.fn((initialValue) => {
       let _map = new Map(Object.entries(initialValue || {}));
       const listeners: Set<(value: any) => void> = new Set();
       return {
        get: () => Object.fromEntries(_map),
        set: (newValue: any) => {
            _map = new Map(Object.entries(newValue));
            listeners.forEach(fn => fn(Object.fromEntries(_map)));
        },
        setKey: (key: string, value: any) => {
            _map.set(key, value);
            listeners.forEach(fn => fn(Object.fromEntries(_map)));
        },
        subscribe: (fn: (value: any) => void) => {
          listeners.add(fn);
          fn(Object.fromEntries(_map));
          return () => listeners.delete(fn);
        }
       }
    }),
    computed: vi.fn((stores, cb) => {
      // Simplified computed: assumes stores are atoms/maps with get()
      // This mock might need to be more sophisticated based on actual usage
      let _value = cb(...stores.map(s => s.get()));
      return {
        get: () => cb(...stores.map(s => s.get())), // Recompute on get for simplicity here
        subscribe: (fn: (value: any) => void) => {
            // A real computed would subscribe to underlying stores and only recompute/notify on change.
            // This is a very basic mock.
            fn(_value);
            return () => {};
        }
      }
    }),
  };
});


vi.mock('~/lib/webcontainer', () => ({
  webcontainer: Promise.resolve({
    workdir: '/app',
    fs: {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      rm: vi.fn(),
      mkdir: vi.fn(),
    },
    spawn: vi.fn(),
    on: vi.fn(),
  }),
}));

vi.mock('~/utils/path', () => ({
  path: {
    join: (...args: string[]) => args.join('/'), // Simple join
    basename: (p: string) => p.split('/').pop() || '',
    dirname: (p: string) => p.substring(0, p.lastIndexOf('/')),
  },
}));
vi.mock('~/utils/diff', () => ({
  extractRelativePath: (p: string) => p.startsWith('/app/') ? p.substring(5) : p,
}));

vi.mock('ignore', () => ({
  default: vi.fn(() => ({
    add: vi.fn().mockReturnThis(),
    ignores: vi.fn().mockReturnValue(false), // Default to not ignoring
  })),
}));


// --- Helper for Mock FileSystemDirectoryHandle ---
let mockSyncFolderHandle: any = null;
let writtenFiles = new Map<string, string>(); // To track what's "written" to the mock handle

const createMockFileHandle = (name: string, content: string) => ({
  name,
  kind: 'file' as const,
  getFile: vi.fn(async () => new File([content], name, { type: 'text/plain' })),
  createWritable: vi.fn(async () => {
    let buffer = '';
    return {
      write: vi.fn(async (data) => { buffer += data.toString(); }),
      close: vi.fn(async () => { writtenFiles.set(name, buffer); }),
    };
  }),
});

const createMockDirectoryHandle = (name: string, initialFiles: Record<string, string> = {}) => {
  const files = new Map<string, any>();
  for (const [fileName, content] of Object.entries(initialFiles)) {
    files.set(fileName, createMockFileHandle(fileName, content));
  }

  return {
    name,
    kind: 'directory' as const,
    values: vi.fn(() => Array.from(files.values())),
    getFileHandle: vi.fn(async (fileName: string, options?: { create?: boolean }) => {
      if (files.has(fileName)) {
        return files.get(fileName);
      }
      if (options?.create) {
        const newFile = createMockFileHandle(fileName, '');
        files.set(fileName, newFile);
        return newFile;
      }
      throw new DOMException('File not found', 'NotFoundError');
    }),
    getDirectoryHandle: vi.fn(async (dirName: string, options?: { create?: boolean }) => {
      // Simplified: assumes flat structure for tests or pre-created nested structures
      if (files.has(dirName) && files.get(dirName).kind === 'directory') {
        return files.get(dirName);
      }
      if (options?.create) {
        const newDir = createMockDirectoryHandle(dirName);
        files.set(dirName, newDir);
        return newDir;
      }
      throw new DOMException('Directory not found', 'NotFoundError');
    }),
    removeEntry: vi.fn(async (entryName: string) => {
      files.delete(entryName);
    }),
  };
};

// --- Global Test State ---
let store: WorkbenchStore;
const mockSyncSettingsStoreInitialValue: SyncSettings = {
  autoSync: false,
  syncOnSave: false,
  excludePatterns: ['node_modules/**', '*.log'],
  syncMode: 'ask', // Default for tests
  projectFolders: {},
  defaultSyncEnabled: true,
  autoSyncInterval: 5,
};

describe('WorkbenchStore - SyncFiles Conflict Resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    writtenFiles.clear();
    mockFileSystem.clear();

    // Resetting nanostore mocks for atom and map to ensure fresh state
    (atom as any).mockImplementation((initialValue: any) => {
      let _value = initialValue;
      const listeners: Set<(value: any) => void> = new Set();
      return {
        get: () => _value,
        set: (newValue: any) => { _value = newValue; listeners.forEach(fn => fn(_value)); },
        subscribe: (fn: (value: any) => void) => { listeners.add(fn); fn(_value); return () => listeners.delete(fn); },
      };
    });
    (map as any).mockImplementation((initialValue: any = {}) => {
      let _map = new Map(Object.entries(initialValue));
      const listeners: Set<(value: any) => void> = new Set();
      const mapStore = {
        get: () => Object.fromEntries(_map),
        set: (newValue: any) => { _map = new Map(Object.entries(newValue)); listeners.forEach(fn => fn(mapStore.get())); },
        setKey: (key: string, value: any) => { _map.set(key, value); listeners.forEach(fn => fn(mapStore.get())); },
        subscribe: (fn: (value: any) => void) => { listeners.add(fn); fn(mapStore.get()); return () => listeners.delete(fn); },
      };
      return mapStore;
    });
    
    store = new WorkbenchStore();

    // Setup default sync folder and session for most tests
    mockSyncFolderHandle = createMockDirectoryHandle('sync-root');
    store.syncFolder.set(mockSyncFolderHandle);
    store.currentSession.set({
      id: 'test-session',
      timestamp: Date.now(),
      lastSync: 0, // Important for initial sync logic
      files: new Set(),
      history: [],
      statistics: [],
      projectName: 'test-project',
      projectFolder: 'test-project',
    });
     // Initialize knownFileStates for the store instance
    (store as any)['#knownFileStates'] = new Map<string, { content: string; timestamp: number }>();
  });

  const setupFileConflict = (
    localContent: string,
    remoteContent: string,
    knownContent: string, // Content known to the store before sync
    filePath: string = 'file.txt'
  ) => {
    const fullPath = `/app/${filePath}`;
    // Store's current files
    store.files.set({ [fullPath]: { type: 'file', content: localContent, isBinary: false } as FileEntry });
    
    // Remote file system state
    mockSyncFolderHandle = createMockDirectoryHandle('sync-root', { [filePath]: remoteContent });
    store.syncFolder.set(mockSyncFolderHandle);

    // Store's known state of the file
    (store as any)['#knownFileStates'].set(filePath, { content: knownContent, timestamp: Date.now() - 10000 });
    
    // Ensure session indicates a previous sync, so it's not an initial sync
    const currentSession = store.currentSession.get();
    if (currentSession) {
      store.currentSession.set({...currentSession, lastSync: Date.now() - 20000 });
    }
  };


  describe("syncMode: 'ask'", () => {
    beforeEach(() => {
      store.syncSettings.set({ ...store.syncSettings.get(), syncMode: 'ask' });
    });

    it("resolves conflict with 'local' (user chooses local)", async () => {
      setupFileConflict('local changes', 'remote changes', 'initial content');
      
      // Simulate user choosing 'local'
      // The actual promise resolve is internal to syncFiles when conflictResolutionState is set
      // So we check the effect of that choice.
      // We need to ensure that when conflictResolutionState.set is called, the promise resolves.
      // This can be tricky. We can spy on conflictResolutionState.set.
      const conflictResolver = vi.spyOn(store.conflictResolutionState, 'set');
      conflictResolver.mockImplementationOnce((state: any) => {
        if (state && state.resolvePromise) {
          state.resolvePromise('local'); // Simulate immediate user choice
        }
        // Call original or a simplified mock for atom.set if needed for other parts
         const originalAtom = atom(null); // get a base atom behavior
         originalAtom.set(state); // this calls the setter
        return {} as any; // return value for store.conflictResolutionState.set
      });


      await store.syncFiles();

      expect(writtenFiles.get('file.txt')).toBe('local changes');
      expect((store as any)['#knownFileStates'].get('file.txt')?.content).toBe('local changes');
      expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Synced 1 file'));
      expect(conflictResolver).toHaveBeenCalledWith(expect.objectContaining({ filePath: 'file.txt' }));
    });

    it("resolves conflict with 'remote' (user chooses remote)", async () => {
      setupFileConflict('local changes', 'remote changes', 'initial content');
      
      const conflictResolver = vi.spyOn(store.conflictResolutionState, 'set');
      conflictResolver.mockImplementationOnce((state: any) => {
        if (state && state.resolvePromise) {
          state.resolvePromise('remote');
        }
        const originalAtom = atom(null);
        originalAtom.set(state);
        return {} as any;
      });

      await store.syncFiles();

      expect(writtenFiles.has('file.txt')).toBe(false); // Should not write if remote is chosen
      expect((store as any)['#knownFileStates'].get('file.txt')?.content).toBe('remote changes');
      expect(toast.info).toHaveBeenCalledWith('All files are up to date'); // Or specific message for skipped due to remote choice
      expect(conflictResolver).toHaveBeenCalledWith(expect.objectContaining({ filePath: 'file.txt' }));
    });

    it("resolves conflict with 'cancel' (user cancels dialog)", async () => {
      setupFileConflict('local changes', 'remote changes', 'initial content');
      
      const conflictResolver = vi.spyOn(store.conflictResolutionState, 'set');
      conflictResolver.mockImplementationOnce((state: any) => {
        if (state && state.resolvePromise) {
          state.resolvePromise('cancel');
        }
        const originalAtom = atom(null);
        originalAtom.set(state);
        return {} as any;
      });

      await store.syncFiles();
      
      expect(writtenFiles.has('file.txt')).toBe(false); // Should not write
      expect((store as any)['#knownFileStates'].get('file.txt')?.content).toBe('remote changes'); // Stays remote
      expect(toast.info).toHaveBeenCalledWith('All files are up to date');
      expect(conflictResolver).toHaveBeenCalledWith(expect.objectContaining({ filePath: 'file.txt' }));
    });
  });

  describe("syncMode: 'overwrite'", () => {
    it('overwrites remote file on conflict', async () => {
      store.syncSettings.set({ ...store.syncSettings.get(), syncMode: 'overwrite' });
      setupFileConflict('local overwrite', 'remote original', 'initial content');

      await store.syncFiles();

      expect(writtenFiles.get('file.txt')).toBe('local overwrite');
      expect((store as any)['#knownFileStates'].get('file.txt')?.content).toBe('local overwrite');
      expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Synced 1 file'));
    });
  });

  describe("syncMode: 'skip'", () => {
    it('skips local changes on conflict', async () => {
      store.syncSettings.set({ ...store.syncSettings.get(), syncMode: 'skip' });
      setupFileConflict('local changes to be skipped', 'remote version to keep', 'initial content');

      await store.syncFiles();

      expect(writtenFiles.has('file.txt')).toBe(false); // Should not write
      expect((store as any)['#knownFileStates'].get('file.txt')?.content).toBe('remote version to keep');
      expect(toast.info).toHaveBeenCalledWith('All files are up to date'); // Or a specific "skipped" message
    });
  });
  
  // TODO: Add tests for initial sync (no knownFileStates, no lastSync in session)
  // TODO: Test excludePatterns interaction with conflicts
});

describe('WorkbenchStore - SyncFiles with Exclude Patterns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    writtenFiles.clear();
    mockFileSystem.clear();

    // Resetting nanostore mocks
    (atom as any).mockImplementation((initialValue: any) => {
      let _value = initialValue;
      const listeners: Set<(value: any) => void> = new Set();
      return {
        get: () => _value,
        set: (newValue: any) => { _value = newValue; listeners.forEach(fn => fn(_value)); },
        subscribe: (fn: (value: any) => void) => { listeners.add(fn); fn(_value); return () => listeners.delete(fn); },
      };
    });
    (map as any).mockImplementation((initialValue: any = {}) => {
      let _map = new Map(Object.entries(initialValue));
      const listeners: Set<(value: any) => void> = new Set();
      const mapStore = {
        get: () => Object.fromEntries(_map),
        set: (newValue: any) => { _map = new Map(Object.entries(newValue)); listeners.forEach(fn => fn(mapStore.get())); },
        setKey: (key: string, value: any) => { _map.set(key, value); listeners.forEach(fn => fn(mapStore.get())); },
        subscribe: (fn: (value: any) => void) => { listeners.add(fn); fn(mapStore.get()); return () => listeners.delete(fn); },
      };
      return mapStore;
    });
    
    store = new WorkbenchStore();

    mockSyncFolderHandle = createMockDirectoryHandle('sync-root-exclude-test');
    store.syncFolder.set(mockSyncFolderHandle);
    store.currentSession.set({
      id: 'test-session-exclude',
      timestamp: Date.now(),
      lastSync: Date.now() - 20000, // Previously synced
      files: new Set(),
      history: [],
      statistics: [],
      projectName: 'test-project-exclude',
      projectFolder: 'test-project-exclude',
    });
    (store as any)['#knownFileStates'] = new Map<string, { content: string; timestamp: number }>();
  });

  it('excludes files based on patterns', async () => {
    store.syncSettings.set({
      ...store.syncSettings.get(),
      excludePatterns: ['*.log', 'temp/**', 'dist/specific-file.js'],
    });

    const filesToSync: FileMap = {
      '/app/file1.txt': { type: 'file', content: 'content1', isBinary: false },
      '/app/error.log': { type: 'file', content: 'log content', isBinary: false },
      '/app/temp/ignoreme.txt': { type: 'file', content: 'temp content', isBinary: false },
      '/app/temp/deep/other.js': { type: 'file', content: 'nested temp', isBinary: false },
      '/app/src/app.js': { type: 'file', content: 'app code', isBinary: false },
      '/app/dist/specific-file.js': { type: 'file', content: 'dist specific', isBinary: false },
      '/app/dist/another-file.js': { type: 'file', content: 'dist other', isBinary: false },
    };
    store.files.set(filesToSync);

    // Spy on getFileHandle to see if it's called for excluded files
    const getFileHandleSpy = vi.spyOn(mockSyncFolderHandle, 'getFileHandle');
    const getDirectoryHandleSpy = vi.spyOn(mockSyncFolderHandle, 'getDirectoryHandle');


    await store.syncFiles();

    // Check what was actually written (or attempted to be written)
    expect(writtenFiles.has('file1.txt')).toBe(true);
    expect(writtenFiles.get('file1.txt')).toBe('content1');

    expect(writtenFiles.has('error.log')).toBe(false);
    expect(getFileHandleSpy).not.toHaveBeenCalledWith('error.log', expect.anything());
    
    expect(writtenFiles.has('temp/ignoreme.txt')).toBe(false);
    // For directory exclusion, we'd check if getDirectoryHandle was called for 'temp' with create:true
    // or if getFileHandle was called for files within 'temp'
    // Our current mock structure for getDirectoryHandle is simple.
    // A more robust check would be to see that no files under temp/ were written.
    expect(writtenFiles.has('temp/deep/other.js')).toBe(false);

    expect(writtenFiles.has('src/app.js')).toBe(true);
    expect(writtenFiles.get('src/app.js')).toBe('app code');

    expect(writtenFiles.has('dist/specific-file.js')).toBe(false);
    expect(getFileHandleSpy).not.toHaveBeenCalledWith('dist/specific-file.js', expect.anything());
    
    expect(writtenFiles.has('dist/another-file.js')).toBe(true);
    expect(writtenFiles.get('dist/another-file.js')).toBe('dist other');

    // Check toast message for the count of synced files
    // It should be 3 files: file1.txt, src/app.js, dist/another-file.js
    expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/Synced 3 files?/));

    // Verify knownFileStates: only non-excluded files should be there
    expect((store as any)['#knownFileStates'].has('file1.txt')).toBe(true);
    expect((store as any)['#knownFileStates'].has('error.log')).toBe(false);
    expect((store as any)['#knownFileStates'].has('temp/ignoreme.txt')).toBe(false);
    expect((store as any)['#knownFileStates'].has('temp/deep/other.js')).toBe(false);
    expect((store as any)['#knownFileStates'].has('src/app.js')).toBe(true);
    expect((store as any)['#knownFileStates'].has('dist/specific-file.js')).toBe(false);
    expect((store as any)['#knownFileStates'].has('dist/another-file.js')).toBe(true);
  });

   it('handles exclude patterns that might create empty parent directories if not careful', async () => {
    store.syncSettings.set({
      ...store.syncSettings.get(),
      excludePatterns: ['parent/child/file.txt'],
    });

    const filesToSync: FileMap = {
      '/app/parent/child/file.txt': { type: 'file', content: 'excluded', isBinary: false },
      '/app/parent/another.txt': { type: 'file', content: 'sibling', isBinary: false },
    };
    store.files.set(filesToSync);
    
    // Mock that 'parent' and 'parent/child' directories get created by getDirectoryHandle
    const parentDirMock = createMockDirectoryHandle('parent');
    const childDirMock = createMockDirectoryHandle('child');
    
    vi.spyOn(mockSyncFolderHandle, 'getDirectoryHandle')
      .mockResolvedValueOnce(parentDirMock) // for 'parent'
      .mockResolvedValueOnce(childDirMock); // for 'parent/child'
    
    vi.spyOn(parentDirMock, 'getDirectoryHandle').mockResolvedValueOnce(childDirMock);


    await store.syncFiles();

    expect(writtenFiles.has('parent/child/file.txt')).toBe(false);
    expect(writtenFiles.has('parent/another.txt')).toBe(true);
    expect(writtenFiles.get('parent/another.txt')).toBe('sibling');
    
    // Ensure getDirectoryHandle was called to create 'parent' and 'parent/child'
    // for 'parent/another.txt' but not necessarily for the excluded file.
    expect(mockSyncFolderHandle.getDirectoryHandle).toHaveBeenCalledWith('parent', { create: true });
    // This check is tricky because 'parent/child' might be created if other files were there.
    // The key is that 'parent/child/file.txt' itself is not written.

    expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/Synced 1 file?/));
  });
});
