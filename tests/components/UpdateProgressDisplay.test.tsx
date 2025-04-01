/**
 * Tests for UpdateProgressDisplay component
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { UpdateProgressDisplay } from '~/components/shared/UpdateProgressDisplay';
import type { UpdateState } from '~/lib/hooks/useUpdateManager';
import '@testing-library/jest-dom';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';

// Create a wrapper with TooltipProvider for testing
const renderWithTooltip = (ui: React.ReactElement) => {
  return render(<TooltipPrimitive.Provider>{ui}</TooltipPrimitive.Provider>);
};

describe('UpdateProgressDisplay', () => {
  // Test rendering with no update in progress

  it('should not render anything when no update is in progress and no error', () => {
    const updateState: Partial<UpdateState> = {
      updateInProgress: false,
      updateProgress: 0,
      updateStage: 'idle',
      updateError: null,
      currentVersion: '1.0.0',
      latestVersion: '1.0.0',
      updateAvailable: false,
    };

    const { container } = renderWithTooltip(<UpdateProgressDisplay updateState={updateState} />);

    expect(container.firstChild).toBeNull();
  });

  // Test rendering with update in progress

  it('should render progress information when update is in progress', () => {
    const updateState: Partial<UpdateState> = {
      updateInProgress: true,
      updateProgress: 50,
      updateStage: 'downloading',
      updateError: null,
    };

    renderWithTooltip(<UpdateProgressDisplay updateState={updateState} />);

    expect(screen.getByText('Downloading updates...')).toBeInTheDocument();

    // Updated to match new UI format
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('complete')).toBeInTheDocument();
  });

  // Test rendering with update error

  it('should render error information when update has an error', () => {
    const updateState: Partial<UpdateState> = {
      updateInProgress: false,
      updateProgress: 0,
      updateStage: 'idle',
      updateError: 'Failed to download update',
    };

    renderWithTooltip(<UpdateProgressDisplay updateState={updateState} />);

    expect(screen.getByText('Update Error')).toBeInTheDocument();
    expect(screen.getByText('Failed to download update')).toBeInTheDocument();

    // Updated button text
    expect(screen.getByText('Copy')).toBeInTheDocument();
  });

  // Test retry button click

  it('should call onRetry when retry button is clicked', () => {
    const onRetry = vi.fn();
    const updateState: Partial<UpdateState> = {
      updateInProgress: false,
      updateProgress: 0,
      updateStage: 'idle',
      updateError: 'Failed to download update',
    };

    renderWithTooltip(<UpdateProgressDisplay updateState={updateState} onRetry={onRetry} />);

    fireEvent.click(screen.getByText('Retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  // Test cancel button click

  it('should call onCancel when cancel button is clicked', () => {
    const onCancel = vi.fn();
    const updateState: Partial<UpdateState> = {
      updateInProgress: true,
      updateProgress: 30,
      updateStage: 'downloading',
      updateError: null,
    };

    renderWithTooltip(<UpdateProgressDisplay updateState={updateState} onCancel={onCancel} />);

    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  // Test different update stages display different messages

  it('should display different messages for different update stages', () => {
    // Test checking stage
    const checkingState: Partial<UpdateState> = {
      updateInProgress: true,
      updateProgress: 25,
      updateStage: 'checking',
      updateError: null,
    };

    const { rerender } = renderWithTooltip(<UpdateProgressDisplay updateState={checkingState} />);

    expect(screen.getByText('Checking for updates...')).toBeInTheDocument();
    expect(screen.getByText('Looking for the latest version')).toBeInTheDocument(); // New description text

    // Test installing stage
    const installingState: Partial<UpdateState> = {
      updateInProgress: true,
      updateProgress: 60,
      updateStage: 'installing',
      updateError: null,
    };

    rerender(<UpdateProgressDisplay updateState={installingState} />);

    expect(screen.getByText('Installing updates...')).toBeInTheDocument();
    expect(screen.getByText('Applying changes to your system')).toBeInTheDocument(); // New description text

    // Test restarting stage
    const restartingState: Partial<UpdateState> = {
      updateInProgress: true,
      updateProgress: 90,
      updateStage: 'restarting',
      updateError: null,
    };

    rerender(<UpdateProgressDisplay updateState={restartingState} />);

    expect(screen.getByText('Restarting application...')).toBeInTheDocument();
    expect(screen.getByText('Almost there!')).toBeInTheDocument(); // New description text
  });

  // Test copy error to clipboard functionality

  it('should handle copy error to clipboard', () => {
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(),
      },
    });

    const updateState: Partial<UpdateState> = {
      updateInProgress: false,
      updateProgress: 0,
      updateStage: 'idle',
      updateError: 'Failed to download update',
    };

    renderWithTooltip(<UpdateProgressDisplay updateState={updateState} />);

    // Click copy button
    fireEvent.click(screen.getByText('Copy'));

    // Check if clipboard API was called with the error message
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Failed to download update');
  });

  // Test show details

  it('should not show details when showDetails is false', () => {
    const updateState: Partial<UpdateState> = {
      updateInProgress: true,
      updateProgress: 50,
      updateStage: 'installing',
      updateError: null,
    };

    renderWithTooltip(<UpdateProgressDisplay updateState={updateState} showDetails={false} />);

    expect(screen.getByText('Installing updates...')).toBeInTheDocument();
    expect(screen.queryByText('50%')).not.toBeInTheDocument();
    expect(screen.queryByText('complete')).not.toBeInTheDocument();
  });

  // Test different stages with correct icons

  it('should render different stages with correct icons', () => {
    const stages: Array<{
      stage: UpdateState['updateStage'];
      message: string;
      description: string;
    }> = [
      { stage: 'checking', message: 'Checking for updates...', description: 'Looking for the latest version' },
      { stage: 'downloading', message: 'Downloading updates...', description: 'Downloading version' },
      { stage: 'installing', message: 'Installing updates...', description: 'Applying changes to your system' },
      { stage: 'restarting', message: 'Restarting application...', description: 'Almost there!' },
    ];

    const { rerender } = renderWithTooltip(
      <UpdateProgressDisplay
        updateState={{
          updateInProgress: true,
          updateProgress: 25,
          updateStage: stages[0].stage,
        }}
      />,
    );

    // Test each stage
    stages.forEach((stageInfo) => {
      rerender(
        <UpdateProgressDisplay
          updateState={{
            updateInProgress: true,
            updateProgress: 25,
            updateStage: stageInfo.stage,
          }}
        />,
      );
      expect(screen.getByText(stageInfo.message)).toBeInTheDocument();

      // Check for description text (partial match for downloading since it includes version)
      if (stageInfo.stage === 'downloading') {
        expect(screen.getByText(/Downloading version/)).toBeInTheDocument();
      } else {
        expect(screen.getByText(stageInfo.description)).toBeInTheDocument();
      }
    });
  });
});
