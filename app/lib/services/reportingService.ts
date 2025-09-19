import { openDatabase, getFeaturesByProject } from '~/lib/persistence/db';
import type { Feature, Project, FeatureStatus, FeaturePriority } from '~/components/projects/types';

export interface ReportFilters {
  status?: FeatureStatus[];
  assignee?: string[];
  priority?: FeaturePriority[];
  dateRange?: { start?: string; end?: string }; // completedAt within range if completed, otherwise createdAt
  tags?: string[];
}

export interface FeatureReportRow {
  projectId: string;
  projectName: string;
  featureId: string;
  name: string;
  status: FeatureStatus;
  priority: FeaturePriority;
  complexity?: string;
  assignee?: string;
  tags: string[];
  branch: string;
  base: string;
  estimatedHours?: number;
  actualHours?: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface SummaryReport {
  total: number;
  byStatus: Record<FeatureStatus, number>;
  byAssignee: Record<string, number>;
  totalEstimated: number;
  totalActual: number;
}

export interface ReportData {
  rows: FeatureReportRow[];
  summary: SummaryReport;
}

export async function buildProjectReport(project: Project, filters: ReportFilters = {}): Promise<ReportData> {
  const db = await openDatabase();
  let feats: Feature[] = [];

  if (db) {
    try {
      const canonical = await getFeaturesByProject(db, project.id);
      feats = (canonical as unknown as Feature[]) || project.features || [];
    } catch {
      feats = project.features || [];
    }
  } else {
    feats = project.features || [];
  }

  const inRange = (f: Feature) => {
    if (!filters.dateRange) {
      return true;
    }

    const { start, end } = filters.dateRange;
    const startMs = start ? new Date(start).getTime() : undefined;
    const endMs = end ? new Date(end).getTime() : undefined;
    const keyDate = f.timeTracking.completedAt || f.timeTracking.createdAt;
    const t = new Date(keyDate).getTime();

    if (startMs && t < startMs) {
      return false;
    }

    if (endMs && t > endMs) {
      return false;
    }

    return true;
  };

  const passes = (f: Feature) => {
    if (filters.status && filters.status.length && !filters.status.includes(f.status)) {
      return false;
    }

    if (filters.assignee && filters.assignee.length) {
      const a = f.analytics?.assignee;

      if (!a || !filters.assignee.includes(a)) {
        return false;
      }
    }

    if (filters.priority && filters.priority.length) {
      const p = f.analytics?.priority;

      if (!p || !filters.priority.includes(p)) {
        return false;
      }
    }

    if (filters.tags && filters.tags.length) {
      const tags = f.analytics?.tags || [];

      if (!filters.tags.every((t) => tags.includes(t))) {
        return false;
      }
    }

    if (!inRange(f)) {
      return false;
    }

    return true;
  };

  const filtered = feats.filter(passes);

  const rows: FeatureReportRow[] = filtered.map((f) => ({
    projectId: project.id,
    projectName: project.name,
    featureId: f.id,
    name: f.name,
    status: f.status,
    priority: f.analytics?.priority || 'medium',
    complexity: f.analytics?.complexity,
    assignee: f.analytics?.assignee,
    tags: f.analytics?.tags || [],
    branch: f.branchRef,
    base: f.branchFrom,
    estimatedHours: f.timeTracking?.estimatedHours,
    actualHours: f.timeTracking?.actualHours,
    createdAt: f.timeTracking?.createdAt,
    startedAt: f.timeTracking?.startedAt,
    completedAt: f.timeTracking?.completedAt,
  }));

  const byStatus = {
    pending: 0,
    'in-progress': 0,
    completed: 0,
    blocked: 0,
    cancelled: 0,
  } as Record<FeatureStatus, number>;
  const byAssignee: Record<string, number> = {};
  let totalEstimated = 0;
  let totalActual = 0;

  for (const r of rows) {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;

    if (r.assignee) {
      byAssignee[r.assignee] = (byAssignee[r.assignee] || 0) + 1;
    }

    totalEstimated += r.estimatedHours || 0;
    totalActual += r.actualHours || 0;
  }

  return {
    rows,
    summary: {
      total: rows.length,
      byStatus,
      byAssignee,
      totalEstimated,
      totalActual,
    },
  };
}
