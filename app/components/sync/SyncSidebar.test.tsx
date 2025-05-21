import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React, { Fragment } from 'react';
import { SyncSidebar } from './SyncSidebar';
import { workbenchStore } from '~/lib/stores/workbench'; // We'll mock parts of this
import type { SyncSettings, SyncStatus, SyncHistoryEntry } from '~/types/sync'; // Assuming these types exist

// --- Mocks ---

// Mock nanostores' useStore
vi.mock('@nanostores/react', () => ({
  useStore: vi.fn((storeAtom) => storeAtom.get()), // Return the current value of the atom
}));

// Mock workbenchStore properties and methods
const mockSyncSettings: SyncSettings = {
  autoSync: false,
  syncOnSave: false,
  excludePatterns: ['initial/pattern.log'],
  syncMode: 'ask',
  projectFolders: {},
  defaultSyncEnabled: true,
  autoSyncInterval: 5,
};

const mockSyncStatus: SyncStatus = {
  isReady: true,
  lastSync: 'Never',
  projectName: 'TestProject',
  folderName: 'TestFolder',
  totalFiles: 10,
  totalSize: '1MB',
  autoSync: false,
  syncOnSave: false,
  hasUnsavedChanges: false,
};

const mockSyncHistory: SyncHistoryEntry[] = [];
const mockConflictState = null;

const mockSaveSyncSettings = vi.fn();
const mockSyncFiles = vi.fn();
const mockSetSyncFolder = vi.fn();

vi.mock('~/lib/stores/workbench', () => ({
  workbenchStore: {
    syncSettings: { get: vi.fn(() => mockSyncSettings), set: vi.fn(), subscribe: vi.fn((cb) => { cb(mockSyncSettings); return () => {};}) },
    syncStatus: { get: vi.fn(() => mockSyncStatus), subscribe: vi.fn((cb) => { cb(mockSyncStatus); return () => {};}) },
    syncHistory: { get: vi.fn(() => mockSyncHistory), subscribe: vi.fn((cb) => { cb(mockSyncHistory); return () => {};}) },
    conflictResolutionState: { get: vi.fn(() => mockConflictState), subscribe: vi.fn((cb) => { cb(mockConflictState); return () => {};}) },
    saveSyncSettings: mockSaveSyncSettings,
    syncFiles: mockSyncFiles,
    setSyncFolder: mockSetSyncFolder,
    // Add any other methods or properties used by SyncSidebar if necessary
  },
}));

vi.mock('~/components/ui/ConflictResolutionDialog', () => ({
  ConflictResolutionDialog: vi.fn(() => <div data-testid="mock-conflict-dialog">Mock Conflict Dialog</div>),
}));

vi.mock('~/components/sync/SyncHistoryList', () => ({
  SyncHistoryList: vi.fn(() => <div data-testid="mock-sync-history">Mock Sync History</div>),
}));

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  return {
    ...actual,
    motion: {
      // Minimal mock for motion.div - just renders children
      // Adjust if specific animation props need to be tested or cause issues
      ...actual.motion,
      div: vi.fn(({ children }) => <div data-testid="motion-div">{children}</div>),
    }
  };
});


vi.mock('react-toastify', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock window.showDirectoryPicker
global.window.showDirectoryPicker = vi.fn();


describe('SyncSidebar UI Interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store mocks to default values for each test
    vi.mocked(workbenchStore.syncSettings.get).mockReturnValue({
      ...mockSyncSettings,
      excludePatterns: ['initial/pattern.log'], // ensure this is reset
      syncMode: 'ask',
    });
     vi.mocked(workbenchStore.syncStatus.get).mockReturnValue(mockSyncStatus);
     vi.mocked(workbenchStore.syncHistory.get).mockReturnValue(mockSyncHistory);
     vi.mocked(workbenchStore.conflictResolutionState.get).mockReturnValue(mockConflictState);
  });

  describe('Sync Mode Selection', () => {
    it('renders the sync mode select element', () => {
      render(<SyncSidebar />);
      // Find by label text, then get the associated select
      const label = screen.getByText('Sync Mode');
      const selectElement = label.parentElement?.parentElement?.querySelector('select');
      expect(selectElement).toBeInTheDocument();
      expect(selectElement).toHaveValue('ask');
    });

    it('calls saveSyncSettings with updated syncMode on change', () => {
      render(<SyncSidebar />);
      const label = screen.getByText('Sync Mode');
      const selectElement = label.parentElement?.parentElement?.querySelector('select');
      expect(selectElement).toBeInTheDocument();
      
      if (!selectElement) throw new Error("Select element not found");

      fireEvent.change(selectElement, { target: { value: 'overwrite' } });

      expect(mockSaveSyncSettings).toHaveBeenCalledTimes(1);
      expect(mockSaveSyncSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          syncMode: 'overwrite',
        })
      );
    });
  });

  describe('Exclude Patterns Management', () => {
    it('renders input field, add button, and initial patterns', () => {
      render(<SyncSidebar />);
      expect(screen.getByPlaceholderText('e.g., node_modules/** or *.log')).toBeInTheDocument();
      expect(screen.getByLabelText('Add pattern')).toBeInTheDocument();
      expect(screen.getByText('initial/pattern.log')).toBeInTheDocument(); // From mockSyncSettings
    });

    it('calls saveSyncSettings when adding a valid new pattern', () => {
      render(<SyncSidebar />);
      const input = screen.getByPlaceholderText('e.g., node_modules/** or *.log');
      const addButton = screen.getByLabelText('Add pattern');

      fireEvent.change(input, { target: { value: 'new/pattern.txt' } });
      fireEvent.click(addButton);

      expect(mockSaveSyncSettings).toHaveBeenCalledTimes(1);
      expect(mockSaveSyncSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          excludePatterns: ['initial/pattern.log', 'new/pattern.txt'],
        })
      );
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith('Exclude pattern added');
    });

    it('does not call saveSyncSettings and shows error toast for empty pattern', () => {
      render(<SyncSidebar />);
      const addButton = screen.getByLabelText('Add pattern');
      fireEvent.click(addButton); // Click with empty input

      expect(mockSaveSyncSettings).not.toHaveBeenCalled();
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith('Pattern cannot be empty');
    });

    it('does not call saveSyncSettings and shows warn toast for duplicate pattern', () => {
       render(<SyncSidebar />);
      const input = screen.getByPlaceholderText('e.g., node_modules/** or *.log');
      const addButton = screen.getByLabelText('Add pattern');

      fireEvent.change(input, { target: { value: 'initial/pattern.log' } }); // Duplicate
      fireEvent.click(addButton);

      expect(mockSaveSyncSettings).not.toHaveBeenCalled();
      expect(vi.mocked(toast.warn)).toHaveBeenCalledWith('Pattern already exists');
    });

    it('calls saveSyncSettings when removing a pattern', () => {
      render(<SyncSidebar />);
      // Find the remove button associated with 'initial/pattern.log'
      const patternText = screen.getByText('initial/pattern.log');
      const removeButton = patternText.parentElement?.querySelector('button[aria-label="Remove pattern"]');
      
      expect(removeButton).toBeInTheDocument();
      if (!removeButton) throw new Error("Remove button not found");

      fireEvent.click(removeButton);

      expect(mockSaveSyncSettings).toHaveBeenCalledTimes(1);
      expect(mockSaveSyncSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          excludePatterns: [], // Initial pattern removed
        })
      );
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith('Exclude pattern removed');
    });
  });
});
