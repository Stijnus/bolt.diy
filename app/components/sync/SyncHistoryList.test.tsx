import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { SyncHistoryList } from './SyncHistoryList';
import type { SyncHistoryEntry } from '~/types/sync';

// Mock SyncHistoryItem
vi.mock('./SyncHistoryItem', () => ({
  SyncHistoryItem: vi.fn(({ entry }: { entry: SyncHistoryEntry }) => (
    <div data-testid="sync-history-item" data-entry-id={entry.id || entry.timestamp}>
      Mocked Item: {entry.id || entry.timestamp}
    </div>
  )),
}));

describe('SyncHistoryList', () => {
  const mockHistory: SyncHistoryEntry[] = [
    {
      id: '1',
      projectName: 'Test Project 1',
      timestamp: new Date('2023-10-26T10:00:00Z').getTime(),
      status: 'success',
      statistics: { totalFiles: 1, syncedFiles: 1, totalSize: 100, duration: 50 },
    },
    {
      id: '2',
      projectName: 'Test Project 2',
      timestamp: new Date('2023-10-25T10:00:00Z').getTime(),
      status: 'failed',
      error: 'Failure',
      statistics: { totalFiles: 2, syncedFiles: 0, totalSize: 0, duration: 20 },
    },
     { // Entry without explicit ID to test timestamp fallback for key
      projectName: 'Test Project 3',
      timestamp: new Date('2023-10-24T10:00:00Z').getTime(),
      status: 'success',
      statistics: { totalFiles: 3, syncedFiles: 3, totalSize: 300, duration: 70 },
    },
  ];

  it('renders "No sync history available." when history is empty', () => {
    render(<SyncHistoryList history={[]} />);
    expect(screen.getByText('No sync history available.')).toBeInTheDocument();
    expect(screen.queryByTestId('sync-history-item')).not.toBeInTheDocument();
  });

  it('renders a list of SyncHistoryItem components when history is provided', () => {
    render(<SyncHistoryList history={mockHistory} />);
    
    const items = screen.getAllByTestId('sync-history-item');
    expect(items).toHaveLength(mockHistory.length);

    // Check if SyncHistoryItem mock was called with correct props
    expect(vi.mocked(SyncHistoryItem).mock.calls[0][0].entry).toBe(mockHistory[0]);
    expect(items[0]).toHaveTextContent(`Mocked Item: ${mockHistory[0].id}`);
    expect(items[0]).toHaveAttribute('data-entry-id', mockHistory[0].id);


    expect(vi.mocked(SyncHistoryItem).mock.calls[1][0].entry).toBe(mockHistory[1]);
    expect(items[1]).toHaveTextContent(`Mocked Item: ${mockHistory[1].id}`);
    expect(items[1]).toHaveAttribute('data-entry-id', mockHistory[1].id);
    
    expect(vi.mocked(SyncHistoryItem).mock.calls[2][0].entry).toBe(mockHistory[2]);
    expect(items[2]).toHaveTextContent(`Mocked Item: ${mockHistory[2].timestamp}`); // Fallback to timestamp
    expect(items[2]).toHaveAttribute('data-entry-id', String(mockHistory[2].timestamp));


  });

  it('renders the title "Sync History"', () => {
    render(<SyncHistoryList history={[]} />);
    expect(screen.getByText('Sync History')).toBeInTheDocument();
    // Check for icon presence if important, e.g., by checking its class
    expect(screen.getByText('Sync History').previousElementSibling).toHaveClass('i-ph:clock-counter-clockwise-duotone');
  });
});
