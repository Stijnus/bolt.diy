import { openDatabase, getFeaturesByProject } from '~/lib/persistence/db';
import type { Project, Feature, ChartDataPoint } from '~/components/projects/types';

export interface ComputedAnalytics {
  totalFeatures: number;
  completedFeatures: number;
  inProgressFeatures: number;
  totalHoursTracked: number;
  averageCompletionTime: number; // hours
  completionRate: number; // percentage
  recentCompletions: number; // last 7 days
  activeProjects: number;
  activeDevelopers: number;
  velocity7d: ChartDataPoint[];
}

export async function computeAnalytics(
  projects: Project[],
  selectedProject?: Project | null,
): Promise<ComputedAnalytics> {
  const db = await openDatabase();
  const projectsToAnalyze = selectedProject ? [selectedProject] : projects;

  // Load canonical features for each project when possible
  let allFeatures: (Feature & { projectId?: string })[] = [];

  if (db) {
    for (const p of projectsToAnalyze) {
      try {
        const feats = await getFeaturesByProject(db, p.id);

        if (Array.isArray(feats)) {
          allFeatures = allFeatures.concat((feats as unknown as Feature[]).map((f) => ({ ...f, projectId: p.id })));
        } else if (Array.isArray(p.features)) {
          allFeatures = allFeatures.concat(p.features.map((f) => ({ ...f, projectId: p.id })));
        }
      } catch {
        // Fallback to embedded
        if (Array.isArray(p.features)) {
          allFeatures = allFeatures.concat(p.features.map((f) => ({ ...f, projectId: p.id })));
        }
      }
    }
  } else {
    for (const p of projectsToAnalyze) {
      if (Array.isArray(p.features)) {
        allFeatures = allFeatures.concat(p.features.map((f) => ({ ...f, projectId: p.id })));
      }
    }
  }

  const totalFeatures = allFeatures.length;
  const completedFeatures = allFeatures.filter((f) => f.status === 'completed').length;
  const inProgressFeatures = allFeatures.filter((f) => f.status === 'in-progress').length;

  const totalHoursTracked = allFeatures.reduce((acc, f) => acc + (f.timeTracking.actualHours || 0), 0);

  // Average completion time: based on actualHours when available; otherwise from timestamps
  const completed = allFeatures.filter((f) => f.status === 'completed');
  const avgCompletionTime = (() => {
    if (completed.length === 0) {
      return 0;
    }

    const durations = completed.map((f) => {
      if (typeof f.timeTracking.actualHours === 'number') {
        return f.timeTracking.actualHours;
      }

      const start = f.timeTracking.startedAt ? new Date(f.timeTracking.startedAt).getTime() : undefined;
      const end = f.timeTracking.completedAt ? new Date(f.timeTracking.completedAt).getTime() : undefined;

      if (start && end && end > start) {
        return (end - start) / (1000 * 60 * 60);
      }

      return 0;
    });
    const sum = durations.reduce((a, b) => a + b, 0);

    return sum / durations.length;
  })();

  const completionRate = totalFeatures > 0 ? (completedFeatures / totalFeatures) * 100 : 0;

  // Velocity (last 7 days)
  const now = new Date();
  const velocity7d: ChartDataPoint[] = [];

  for (let i = 6; i >= 0; i--) {
    const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);

    const value = allFeatures.filter((f) => {
      const completedAt = f.timeTracking.completedAt ? new Date(f.timeTracking.completedAt) : undefined;
      return completedAt && completedAt >= dayStart && completedAt <= dayEnd;
    }).length;
    velocity7d.push({ label: day.toLocaleDateString('en-US', { weekday: 'short' }), value, date: day.toISOString() });
  }

  const recentCompletions = velocity7d.reduce((a, b) => a + b.value, 0);

  const activeProjects = projectsToAnalyze.filter((p) => !p.archived).length;
  const activeDevelopers = new Set(allFeatures.map((f) => f.analytics?.assignee).filter(Boolean) as string[]).size;

  return {
    totalFeatures,
    completedFeatures,
    inProgressFeatures,
    totalHoursTracked,
    averageCompletionTime: avgCompletionTime,
    completionRate,
    recentCompletions,
    activeProjects,
    activeDevelopers,
    velocity7d,
  };
}
