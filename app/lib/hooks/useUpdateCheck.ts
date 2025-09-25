import { useCallback, useEffect, useState } from 'react';
import { checkForUpdates, type UpdateCheckResult } from '~/lib/api/updates';

interface UseUpdateCheckState {
  hasUpdate: boolean;
  latestVersion: string | null;
  error: string | null;
  isLoading: boolean;
  retry: () => void;
}

function resolveError(result: UpdateCheckResult | null, unknownError: unknown): string {
  if (result?.error) {
    return result.error.message;
  }

  if (unknownError instanceof Error) {
    return unknownError.message;
  }

  return 'Failed to check for updates';
}

export function useUpdateCheck(): UseUpdateCheckState {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const performCheck = useCallback(async () => {
    setIsLoading(true);
    let result: UpdateCheckResult | null = null;

    try {
      result = await checkForUpdates();
      setHasUpdate(result.available);
      setLatestVersion(result.version ?? null);
      setError(result.error ? result.error.message : null);
    } catch (err) {
      setError(resolveError(result, err));
      setHasUpdate(false);
      setLatestVersion(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      if (!isMounted) {
        return;
      }
      await performCheck();
    };

    run();

    return () => {
      isMounted = false;
    };
  }, [performCheck]);

  return {
    hasUpdate,
    latestVersion,
    error,
    isLoading,
    retry: () => {
      void performCheck();
    },
  };
}
