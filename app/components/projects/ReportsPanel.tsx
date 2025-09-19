/* eslint-disable padding-line-between-statements */
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FileDown, Filter } from 'lucide-react';
import { Button } from '~/components/ui/Button';
import { Label } from '~/components/ui/Label';
import type { FeatureStatus, FeaturePriority, Project } from './types';
import { buildProjectReport, type ReportFilters } from '~/lib/services/reportingService';
import { rowsToCSV, downloadCSV } from '~/utils/csv';

interface ReportsPanelProps {
  project: Project;
}

export function ReportsPanel({ project }: ReportsPanelProps) {
  const [filters, setFilters] = useState<ReportFilters>({});
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);
  const [summary, setSummary] = useState<any | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const { rows, summary } = await buildProjectReport(project, filters);
      setRows(rows);
      setSummary(summary);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [project.id]);

  const statuses: FeatureStatus[] = ['pending', 'in-progress', 'completed', 'blocked', 'cancelled'];
  const priorities: FeaturePriority[] = ['low', 'medium', 'high', 'critical'];

  const exportCSV = () => {
    const csv = rowsToCSV(rows, [
      'projectId',
      'projectName',
      'featureId',
      'name',
      'status',
      'priority',
      'assignee',
      'tags',
      'branch',
      'base',
      'estimatedHours',
      'actualHours',
      'createdAt',
      'startedAt',
      'completedAt',
    ]);
    downloadCSV(`${project.name.replace(/\s+/g, '_')}_report.csv`, csv);
  };

  const updateFilter = (f: Partial<ReportFilters>) => {
    setFilters((prev) => ({ ...prev, ...f }));
  };

  const applyFilters = async () => {
    await refresh();
  };

  return (
    <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-xl shadow-sm hover:shadow-lg hover:shadow-orange-500/20 transition-all duration-300 mt-6">
      <div className="p-6 border-b border-bolt-elements-borderColor flex items-center justify-between">
        <h2 className="text-lg font-semibold text-bolt-elements-textPrimary">Reports</h2>
        <div className="flex gap-2">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              onClick={exportCSV}
              variant="outline"
              size="sm"
              className="inline-flex items-center gap-2 hover:text-bolt-elements-item-contentAccent hover:border-bolt-elements-item-backgroundAccent hover:bg-bolt-elements-item-backgroundAccent transition-colors"
            >
              <FileDown className="w-4 h-4" /> Export CSV
            </Button>
          </motion.div>
        </div>
      </div>

      <div className="p-4">
        {/* Filters */}
        <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs text-bolt-elements-textSecondary">Status</Label>
            <select
              multiple
              value={(filters.status as any) || []}
              onChange={(e) =>
                updateFilter({ status: Array.from(e.target.selectedOptions).map((o) => o.value as FeatureStatus) })
              }
              className="flex h-10 w-full rounded-md border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 px-3 py-2 text-sm text-bolt-elements-textPrimary ring-offset-bolt-elements-background-depth-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bolt-elements-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label className="text-xs text-bolt-elements-textSecondary">Priority</Label>
            <select
              multiple
              value={(filters.priority as any) || []}
              onChange={(e) =>
                updateFilter({ priority: Array.from(e.target.selectedOptions).map((o) => o.value as FeaturePriority) })
              }
              className="flex h-10 w-full rounded-md border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 px-3 py-2 text-sm text-bolt-elements-textPrimary ring-offset-bolt-elements-background-depth-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bolt-elements-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {priorities.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label className="text-xs text-bolt-elements-textSecondary">Start Date</Label>
            <input
              type="date"
              value={filters.dateRange?.start || ''}
              onChange={(e) => updateFilter({ dateRange: { ...(filters.dateRange || {}), start: e.target.value } })}
              className="flex h-10 w-full rounded-md border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 px-3 py-2 text-sm text-bolt-elements-textPrimary ring-offset-bolt-elements-background-depth-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bolt-elements-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div>
            <Label className="text-xs text-bolt-elements-textSecondary">End Date</Label>
            <input
              type="date"
              value={filters.dateRange?.end || ''}
              onChange={(e) => updateFilter({ dateRange: { ...(filters.dateRange || {}), end: e.target.value } })}
              className="flex h-10 w-full rounded-md border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 px-3 py-2 text-sm text-bolt-elements-textPrimary ring-offset-bolt-elements-background-depth-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bolt-elements-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>

        <div className="mb-4">
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              onClick={applyFilters}
              variant="outline"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500/10 to-red-500/10 hover:from-orange-500/20 hover:to-red-500/20 border-orange-500/30 hover:border-orange-500/50 hover:text-bolt-elements-item-contentAccent transition-all duration-300 shadow-sm hover:shadow-lg hover:shadow-orange-500/20 font-medium"
            >
              <Filter className="w-4 h-4" /> Apply Filters
            </Button>
          </motion.div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
          <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300">
            <div className="text-xs text-bolt-elements-textSecondary">Total</div>
            <div className="text-lg font-semibold text-bolt-elements-textPrimary">{summary?.total ?? 0}</div>
          </div>
          <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20 hover:shadow-lg hover:shadow-green-500/10 transition-all duration-300">
            <div className="text-xs text-bolt-elements-textSecondary">Completed</div>
            <div className="text-lg font-semibold text-bolt-elements-textPrimary">
              {summary?.byStatus?.completed ?? 0}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20 hover:shadow-lg hover:shadow-yellow-500/10 transition-all duration-300">
            <div className="text-xs text-bolt-elements-textSecondary">In Progress</div>
            <div className="text-lg font-semibold text-bolt-elements-textPrimary">
              {summary?.byStatus?.['in-progress'] ?? 0}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/20 hover:shadow-lg hover:shadow-purple-500/10 transition-all duration-300">
            <div className="text-xs text-bolt-elements-textSecondary">Est. Hours</div>
            <div className="text-lg font-semibold text-bolt-elements-textPrimary">{summary?.totalEstimated ?? 0}</div>
          </div>
          <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20 hover:shadow-lg hover:shadow-red-500/10 transition-all duration-300">
            <div className="text-xs text-bolt-elements-textSecondary">Actual Hours</div>
            <div className="text-lg font-semibold text-bolt-elements-textPrimary">{summary?.totalActual ?? 0}</div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-bolt-elements-textSecondary border-b border-bolt-elements-borderColor">
                <th className="px-2 py-2">Feature</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Priority</th>
                <th className="px-2 py-2">Assignee</th>
                <th className="px-2 py-2">Est</th>
                <th className="px-2 py-2">Actual</th>
                <th className="px-2 py-2">Created</th>
                <th className="px-2 py-2">Completed</th>
                <th className="px-2 py-2">Branch</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-2 py-6 text-bolt-elements-textTertiary">
                    Loading report...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-2 py-6 text-bolt-elements-textTertiary">
                    No results
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.featureId}
                    className="border-b border-bolt-elements-borderColor text-bolt-elements-textPrimary"
                  >
                    <td className="px-2 py-2">{r.name}</td>
                    <td className="px-2 py-2">{r.status}</td>
                    <td className="px-2 py-2">{r.priority}</td>
                    <td className="px-2 py-2">{r.assignee || '-'}</td>
                    <td className="px-2 py-2">{r.estimatedHours ?? '-'}</td>
                    <td className="px-2 py-2">{r.actualHours ?? '-'}</td>
                    <td className="px-2 py-2">{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '-'}</td>
                    <td className="px-2 py-2">{r.completedAt ? new Date(r.completedAt).toLocaleDateString() : '-'}</td>
                    <td className="px-2 py-2 font-mono text-xs">{r.branch}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
