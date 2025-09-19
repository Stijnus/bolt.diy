import { useCallback } from 'react';
import { featureService } from '~/lib/services/featureService';
import { timeTrackingService } from '~/lib/services/timeTrackingService';
import type { Feature } from '~/components/projects/types';

export function useTimeTracking() {
  const startFeatureTimer = useCallback(async (projectId: string, featureId: string) => {
    return featureService.startFeatureTimer(projectId, featureId);
  }, []);

  const stopFeatureTimer = useCallback(async (projectId: string, featureId: string) => {
    return featureService.stopFeatureTimer(projectId, featureId);
  }, []);

  const calculateSessionHours = useCallback((startedAt: string, endedAt?: string): number => {
    return timeTrackingService.calculateSessionHours(startedAt, endedAt);
  }, []);

  const updateTimeTracking = useCallback((timeTracking: Feature['timeTracking'], status: Feature['status']) => {
    return timeTrackingService.updateTimeTracking(timeTracking, status);
  }, []);

  const startTimer = useCallback((feature: Feature) => {
    return timeTrackingService.startTimer(feature);
  }, []);

  const stopTimer = useCallback((feature: Feature) => {
    return timeTrackingService.stopTimer(feature);
  }, []);

  return {
    startFeatureTimer,
    stopFeatureTimer,
    calculateSessionHours,
    updateTimeTracking,
    startTimer,
    stopTimer,
  };
}
