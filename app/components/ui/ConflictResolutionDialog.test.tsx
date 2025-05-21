import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ConflictResolutionDialog } from './ConflictResolutionDialog';

// Mock the Dialog and Button components if they are complex or have side effects not relevant to this test.
// For now, we assume they render children and pass through props like onClick.
vi.mock('~/components/ui/Dialog', () => ({
  Dialog: ({ children, open, onOpenChange }: { children: React.ReactNode, open: boolean, onOpenChange: (open: boolean) => void }) => 
    open ? <div data-testid="dialog-mock" onClick={() => onOpenChange(false)}>{children}</div> : null,
  DialogContent: ({ children, className }: { children: React.ReactNode, className?: string }) => <div className={className}>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
  DialogFooter: ({ children, className }: { children: React.ReactNode, className?: string }) => <div className={className}>{children}</div>,
  DialogClose: ({ children }: { children: React.ReactNode }) => <button>{children}</button>, // Basic mock
}));

vi.mock('~/components/ui/Button', () => ({
  Button: ({ children, onClick, variant }: { children: React.ReactNode, onClick?: () => void, variant?: string }) => (
    <button onClick={onClick} data-variant={variant}>{children}</button>
  ),
}));


describe('ConflictResolutionDialog', () => {
  const mockFilePath = 'path/to/conflicting/file.txt';
  const mockOnResolve = vi.fn();
  const mockOnClose = vi.fn();

  const defaultProps = {
    isOpen: true,
    filePath: mockFilePath,
    onResolve: mockOnResolve,
    onClose: mockOnClose,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly when open', () => {
    render(<ConflictResolutionDialog {...defaultProps} />);

    expect(screen.getByText('File Conflict')).toBeInTheDocument();
    expect(screen.getByText(mockFilePath)).toBeInTheDocument();
    expect(screen.getByText('Use My Version')).toBeInTheDocument();
    expect(screen.getByText('Use Remote Version')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(<ConflictResolutionDialog {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('File Conflict')).not.toBeInTheDocument();
  });

  it('calls onResolve("local") and onClose when "Use My Version" button is clicked', () => {
    render(<ConflictResolutionDialog {...defaultProps} />);
    fireEvent.click(screen.getByText('Use My Version'));
    expect(mockOnResolve).toHaveBeenCalledWith('local');
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('calls onResolve("remote") and onClose when "Use Remote Version" button is clicked', () => {
    render(<ConflictResolutionDialog {...defaultProps} />);
    fireEvent.click(screen.getByText('Use Remote Version'));
    expect(mockOnResolve).toHaveBeenCalledWith('remote');
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
  
  it('calls onClose when the dialog requests to be closed (e.g. overlay click or escape key)', () => {
    // This test depends on the mock implementation of Dialog.
    // Our mock calls onOpenChange(false) when the dialog mock itself is clicked.
    render(<ConflictResolutionDialog {...defaultProps} />);
    const dialogMock = screen.getByTestId('dialog-mock');
    fireEvent.click(dialogMock); // Simulate clicking the overlay or an equivalent action
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('displays the correct file path', () => {
    const alternativeFilePath = 'another/path/file.js';
    render(<ConflictResolutionDialog {...defaultProps} filePath={alternativeFilePath} />);
    expect(screen.getByText(alternativeFilePath)).toBeInTheDocument();
  });
});
