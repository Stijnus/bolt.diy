/**
 * Tests for useUpdateManager hook
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useUpdateManager } from '~/lib/hooks/useUpdateManager';
import * as updateApi from '~/lib/api/updates';

// Mock dependencies
vi.mock('~/lib/hooks/useEnvironment', () => ({
  useEnvironment: vi.fn().mockReturnValue({
    isCloud: false,
    platform: 'local',
    isElectron: false,
    gitSupported: true,
    isRunningLocalServer: true,
  }),
}));

vi.mock('~/lib/api/updates', () => ({
  checkForUpdates: vi.fn(),
  acknowledgeUpdate: vi.fn(),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

// Mock window object for Node.js environment
if (typeof window === 'undefined') {
  global.window = {} as any;
}

Object.defineProperty(global.window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Mock EventSource for testing Git updates
class MockEventSource {
  onmessage: ((event: any) => void) | null = null;
  onerror: (() => void) | null = null;
  url: string;

  constructor(url: string) {
    this.url = url;
  }

  close() {
    // Mock implementation
  }
}

// @ts-ignore - mock EventSource
global.EventSource = MockEventSource;

// Mock fetch for Git updates
global.fetch = vi.fn();

describe('useUpdateManager', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorageMock.clear();

    // Default mock implementations
    (updateApi.checkForUpdates as any).mockResolvedValue({
      available: true,
      version: '1.0.0',
    });

    (updateApi.acknowledgeUpdate as any).mockResolvedValue(undefined);

    (global.fetch as any).mockResolvedValue({
      ok: true,
    });
  });

  it('should check for updates on mount when autoCheck is true', async () => {
    renderHook(() => useUpdateManager({ autoCheck: true }));
    expect(updateApi.checkForUpdates).toHaveBeenCalledTimes(1);
  });

  it('should not check for updates on mount when autoCheck is false', () => {
    renderHook(() => useUpdateManager({ autoCheck: false }));
    expect(updateApi.checkForUpdates).not.toHaveBeenCalled();
  });

  it('should update state when updates are available', async () => {
    (updateApi.checkForUpdates as any).mockResolvedValue({
      available: true,
      version: '1.1.0',
    });

    const { result } = renderHook(() => useUpdateManager());

    // Wait for the check to complete
    await vi.waitFor(() => {
      expect(result.current.updateAvailable).toBe(true);
    });

    expect(result.current.currentVersion).toBe('1.1.0');
    expect(result.current.latestVersion).toBe('1.1.0');
  });

  it('should acknowledge updates correctly', async () => {
    (updateApi.checkForUpdates as any).mockResolvedValue({
      available: true,
      version: '1.2.0',
    });

    const { result } = renderHook(() => useUpdateManager());

    // Wait for the check to complete
    await vi.waitFor(() => {
      expect(result.current.updateAvailable).toBe(true);
    });

    // Acknowledge the update
    await act(async () => {
      await result.current.acknowledgeUpdate();
    });

    expect(updateApi.acknowledgeUpdate).toHaveBeenCalledWith('1.2.0');
    expect(result.current.updateAvailable).toBe(false);
    expect(result.current.lastAcknowledgedVersion).toBe('1.2.0');

    // Check localStorage was updated
    expect(localStorageMock.setItem).toHaveBeenCalledWith('lastAcknowledgedUpdateVersion', JSON.stringify('1.2.0'));
  });

  it('should handle update errors gracefully', async () => {
    (updateApi.checkForUpdates as any).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useUpdateManager());

    // Wait for the check to complete with error
    await vi.waitFor(() => {
      expect(result.current.updateError).toBeTruthy();
    });

    expect(result.current.updateError).toContain('Network error');
    expect(result.current.updateInProgress).toBe(false);
  });

  it('should start Git-based updates correctly', async () => {
    // Explicitly mock environment for this test to ensure Git path is used
    const useEnvironmentModule = await import('~/lib/hooks/useEnvironment');
    vi.mocked(useEnvironmentModule.useEnvironment).mockReturnValue({
      isCloud: false,
      platform: 'local',
      isElectron: false,
      gitSupported: true,
      isRunningLocalServer: true,
    });

    // Mock successful API response
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    // Mock checkForUpdates to return an available update
    (updateApi.checkForUpdates as any).mockResolvedValue({
      available: true,
      version: '1.1.0',
    });

    // Create a new EventSource mock for this test
    const mockEventSource = new MockEventSource('/api/updates/progress');
    const originalEventSource = global.EventSource;
    global.EventSource = vi.fn().mockImplementation(() => mockEventSource) as unknown as typeof EventSource;

    try {
      const { result } = renderHook(() => useUpdateManager({ autoCheck: false }));

      // Manually check for updates
      await act(async () => {
        await result.current.checkForUpdate();
      });

      // Verify update is available
      expect(result.current.updateAvailable).toBe(true);

      // Start the update
      await act(async () => {
        await result.current.startUpdate();
      });

      // Verify the fetch was called correctly
      expect(global.fetch).toHaveBeenCalledWith('/api/updates/start', { method: 'POST' });

      // Verify the update state was updated correctly
      expect(result.current.updateInProgress).toBe(true);
      expect(result.current.updateStage).toBe('downloading');
    } finally {
      // Restore original EventSource
      global.EventSource = originalEventSource;
    }
  });

  it('should cancel updates correctly', async () => {
    const { result } = renderHook(() => useUpdateManager());

    // Wait for initial check
    await vi.waitFor(() => {
      expect(result.current.updateAvailable).toBe(true);
    });

    // Start and then cancel the update
    await act(async () => {
      await result.current.startUpdate();
      result.current.cancelUpdate();
    });

    expect(result.current.updateInProgress).toBe(false);
    expect(result.current.updateStage).toBe('idle');
    expect(result.current.updateProgress).toBe(0);
  });

  it('should auto-acknowledge updates when configured', async () => {
    (updateApi.checkForUpdates as any).mockResolvedValue({
      available: true,
      version: '1.3.0',
    });

    renderHook(() => useUpdateManager({ autoAcknowledge: true }));

    // Wait for the check and auto-acknowledge to complete
    await vi.waitFor(() => {
      expect(updateApi.acknowledgeUpdate).toHaveBeenCalledWith('1.3.0');
    });
  });
});
