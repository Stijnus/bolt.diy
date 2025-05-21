import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { SyncHistoryItem } from './SyncHistoryItem';
import type { SyncHistoryEntry } from '~/types/sync';

describe('SyncHistoryItem', () => {
  const baseEntry: SyncHistoryEntry = {
    id: '1',
    projectName: 'Test Project',
    timestamp: new Date('2023-10-26T10:00:00Z').getTime(),
    status: 'success',
    statistics: {
      totalFiles: 10,
      syncedFiles: 5,
      totalSize: 1500000, // Approx 1.43 MB
      duration: 1234, // 1.23 s
    },
    files: ['file1.txt', 'file2.txt'],
  };

  it('renders correctly for a successful entry', () => {
    render(<SyncHistoryItem entry={baseEntry} />);

    expect(screen.getByText(new Date(baseEntry.timestamp).toLocaleString())).toBeInTheDocument();
    expect(screen.getByText('Success')).toBeInTheDocument();
    expect(screen.getByText(/Files Synced:/).textContent).toBe('Files Synced: 5');
    expect(screen.getByText(/Total Size:/).textContent).toBe('Total Size: 1.43 MB');
    expect(screen.getByText(/Duration:/).textContent).toBe('Duration: 1.23 s');
    expect(screen.getByText('Success').previousElementSibling).toHaveClass('i-ph:check-circle-duotone');
    expect(screen.queryByText(/Error:/)).not.toBeInTheDocument();
  });

  it('renders correctly for a failed entry', () => {
    const failedEntry: SyncHistoryEntry = {
      ...baseEntry,
      id: '2',
      status: 'failed',
      error: 'Something went wrong',
    };
    render(<SyncHistoryItem entry={failedEntry} />);

    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('Failed').previousElementSibling).toHaveClass('i-ph:x-circle-duotone');
    expect(screen.getByText(/Error:/)).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders correctly for a partial entry', () => {
    const partialEntry: SyncHistoryEntry = { ...baseEntry, id: '3', status: 'partial' };
    render(<SyncHistoryItem entry={partialEntry} />);
    expect(screen.getByText('Partial')).toBeInTheDocument();
    expect(screen.getByText('Partial').previousElementSibling).toHaveClass('i-ph:warning-circle-duotone');
  });
  
  it('renders correctly for an unknown status entry', () => {
    const unknownEntry = { ...baseEntry, id: '4', status: 'unknown' } as SyncHistoryEntry;
    render(<SyncHistoryItem entry={unknownEntry} />);
    expect(screen.getByText('Unknown')).toBeInTheDocument();
    expect(screen.getByText('Unknown').previousElementSibling).toHaveClass('i-ph:question-duotone');
  });


  it('formats 0 bytes correctly', () => {
    const entry: SyncHistoryEntry = { ...baseEntry, statistics: { ...baseEntry.statistics, totalSize: 0 } };
    render(<SyncHistoryItem entry={entry} />);
    expect(screen.getByText(/Total Size:/).textContent).toBe('Total Size: 0 Bytes');
  });

  it('formats bytes in KB correctly', () => {
    const entry: SyncHistoryEntry = { ...baseEntry, statistics: { ...baseEntry.statistics, totalSize: 2048 } }; // 2 KB
    render(<SyncHistoryItem entry={entry} />);
    expect(screen.getByText(/Total Size:/).textContent).toBe('Total Size: 2 KB');
  });
  
  it('formats duration in ms correctly', () => {
    const entry: SyncHistoryEntry = { ...baseEntry, statistics: { ...baseEntry.statistics, duration: 500 } }; // 500 ms
    render(<SyncHistoryItem entry={entry} />);
    expect(screen.getByText(/Duration:/).textContent).toBe('Duration: 500 ms');
  });

  it('handles missing statistics.syncedFiles and falls back to files.length', () => {
    const entry: SyncHistoryEntry = {
      ...baseEntry,
      statistics: {
        // totalFiles: 10, // keep for consistency if needed by other parts of the type
        // @ts-expect-error testing fallback
        syncedFiles: undefined, 
        totalSize: 1000,
        duration: 100,
      },
      files: ['a.txt', 'b.txt', 'c.txt'], // 3 files
    };
    render(<SyncHistoryItem entry={entry} />);
    expect(screen.getByText(/Files Synced:/).textContent).toBe('Files Synced: 3');
  });

  it('handles missing statistics.syncedFiles and files array (defaults to 0)', () => {
    const entry: SyncHistoryEntry = {
      ...baseEntry,
      statistics: {
        // @ts-expect-error testing fallback
        syncedFiles: undefined,
        totalSize: 1000,
        duration: 100,
      },
      files: undefined, // No files array
    };
    render(<SyncHistoryItem entry={entry} />);
    expect(screen.getByText(/Files Synced:/).textContent).toBe('Files Synced: 0');
  });
});
