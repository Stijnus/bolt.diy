import type { Feature, FeatureTimeTracking } from '~/components/projects/types';

export interface TimeTrackingService {
  startTimer(feature: Feature): FeatureTimeTracking;
  stopTimer(feature: Feature): FeatureTimeTracking;
  calculateSessionHours(startedAt: string, endedAt?: string): number;
  updateTimeTracking(timeTracking: FeatureTimeTracking, status: Feature['status']): FeatureTimeTracking;
}

export const timeTrackingService: TimeTrackingService = {
  startTimer(feature: Feature): FeatureTimeTracking {
    const now = new Date().toISOString();

    return {
      ...feature.timeTracking,
      startedAt: now,
      lastUpdated: now,
    };
  },

  stopTimer(feature: Feature): FeatureTimeTracking {
    if (!feature.timeTracking?.startedAt) {
      return feature.timeTracking;
    }

    const now = new Date().toISOString();
    const sessionHours = this.calculateSessionHours(feature.timeTracking.startedAt, now);
    const currentActualHours = feature.timeTracking.actualHours || 0;

    return {
      ...feature.timeTracking,
      actualHours: Math.round((currentActualHours + sessionHours) * 10) / 10,
      lastUpdated: now,
      startedAt: undefined, // Clear the start time
    };
  },

  calculateSessionHours(startedAt: string, endedAt?: string): number {
    const startTime = new Date(startedAt);
    const endTime = endedAt ? new Date(endedAt) : new Date();

    const sessionHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);

    return Math.round(sessionHours * 10) / 10;
  },

  updateTimeTracking(timeTracking: FeatureTimeTracking, status: Feature['status']): FeatureTimeTracking {
    const now = new Date().toISOString();
    const updatedTracking = { ...timeTracking, lastUpdated: now };

    switch (status) {
      case 'in-progress':
        if (!timeTracking.startedAt) {
          updatedTracking.startedAt = now;
        }

        break;

      case 'completed':
        if (timeTracking.startedAt && !timeTracking.completedAt) {
          updatedTracking.completedAt = now;

          // Calculate actual hours if not already set
          if (!updatedTracking.actualHours && timeTracking.startedAt) {
            const sessionHours = this.calculateSessionHours(timeTracking.startedAt, now);
            updatedTracking.actualHours = sessionHours;
          }
        }

        break;

      case 'pending':
      case 'blocked':
      case 'cancelled':
        // Clear startedAt for these statuses if it exists
        if (timeTracking.startedAt) {
          const sessionHours = this.calculateSessionHours(timeTracking.startedAt, now);
          const currentActualHours = timeTracking.actualHours || 0;
          updatedTracking.actualHours = Math.round((currentActualHours + sessionHours) * 10) / 10;
          updatedTracking.startedAt = undefined;
        }

        break;
    }

    return updatedTracking;
  },
};
