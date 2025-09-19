import { useCallback } from 'react';
import type { Feature, NewFeature } from '~/components/projects/types';
import { featureService } from '~/lib/services/featureService';

export function useFeatures() {
  const addFeature = useCallback(async (projectId: string, newFeature: NewFeature) => {
    return featureService.addFeature(projectId, newFeature);
  }, []);

  const updateFeatureStatus = useCallback(async (projectId: string, featureId: string, status: Feature['status']) => {
    return featureService.updateFeatureStatus(projectId, featureId, status);
  }, []);

  const updateFeatureAnalytics = useCallback(
    async (projectId: string, featureId: string, analytics: Partial<Feature['analytics']>) => {
      return featureService.updateFeatureAnalytics(projectId, featureId, analytics);
    },
    [],
  );

  const startWorkingOnFeature = useCallback(async (projectId: string, featureId: string) => {
    return featureService.startWorkingOnFeature(projectId, featureId);
  }, []);

  const getFeature = useCallback(async (featureId: string) => {
    return featureService.getFeature(featureId);
  }, []);

  const listFeaturesByProject = useCallback(async (projectId: string) => {
    return featureService.listFeaturesByProject(projectId);
  }, []);

  const removeFeature = useCallback(async (projectId: string, featureId: string) => {
    return featureService.removeFeature(projectId, featureId);
  }, []);

  return {
    addFeature,
    updateFeatureStatus,
    updateFeatureAnalytics,
    startWorkingOnFeature,
    getFeature,
    listFeaturesByProject,
    removeFeature,
  };
}
