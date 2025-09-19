import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { Feature, FeatureStatus, Project } from './types';
import { getOrCreateWorkflow } from '~/lib/services/workflowService';

interface KanbanBoardProps {
  project: Project;
  onStatusChange: (featureId: string, status: FeatureStatus) => void;
}

type Column = {
  id: string;
  title: string;
  status: FeatureStatus;
  wipLimit?: number;
  order: number;
};

export function KanbanBoard({ project, onStatusChange }: KanbanBoardProps) {
  const [columns, setColumns] = useState<Column[]>([]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const wf = await getOrCreateWorkflow(project.id);

      if (!mounted) {
        return;
      }

      const cols: Column[] = wf.columns
        .map((c) => ({
          id: c.id,
          title: c.title,
          status: c.status as FeatureStatus,
          wipLimit: c.wipLimit,
          order: c.order,
        }))
        .sort((a, b) => a.order - b.order);
      setColumns(cols);
    })();

    return () => {
      mounted = false;
    };
  }, [project.id]);

  const featuresByStatus = useMemo(() => {
    const map: Record<FeatureStatus, Feature[]> = {
      pending: [],
      'in-progress': [],
      completed: [],
      blocked: [],
      cancelled: [],
    } as any;
    (project.features || []).forEach((f) => {
      (map[f.status] ||= []).push(f);
    });

    return map;
  }, [project.features]);

  const onDragStart = (e: React.DragEvent<HTMLDivElement>, feature: Feature) => {
    e.dataTransfer.setData('text/plain', feature.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>, status: FeatureStatus) => {
    const id = e.dataTransfer.getData('text/plain');

    if (!id) {
      return;
    }

    onStatusChange(id, status);
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-bolt-elements-textPrimary">Kanban</h3>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {columns.map((col) => {
          const items = featuresByStatus[col.status] || [];
          const atWipLimit = typeof col.wipLimit === 'number' && items.length >= col.wipLimit;

          return (
            <div
              key={col.id}
              className="flex flex-col bg-gradient-to-b from-bolt-elements-background-depth-2 to-bolt-elements-background-depth-3 rounded-xl border border-bolt-elements-borderColor shadow-sm hover:shadow-lg transition-all duration-300"
            >
              <div className="px-4 py-3 border-b border-bolt-elements-borderColor flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-bolt-elements-textPrimary">{col.title}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${atWipLimit ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary'}`}
                  >
                    {items.length}
                    {col.wipLimit ? `/${col.wipLimit}` : ''}
                  </span>
                </div>
              </div>

              <div
                className="flex-1 p-3 min-h-48 rounded-b-xl"
                onDragOver={(e) => onDragOver(e as unknown as React.DragEvent<HTMLDivElement>)}
                onDrop={(e) => onDrop(e as unknown as React.DragEvent<HTMLDivElement>, col.status)}
              >
                <div className="space-y-3">
                  {items.length === 0 && (
                    <div className="text-sm text-bolt-elements-textTertiary px-2 py-8 text-center">No items</div>
                  )}
                  {items.map((f) => (
                    <motion.div
                      key={f.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ scale: 1.01 }}
                      draggable
                      onDragStart={(e) => onDragStart(e as unknown as React.DragEvent<HTMLDivElement>, f)}
                      className="bg-gradient-to-br from-bolt-elements-background-depth-1 to-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-lg p-3 cursor-move hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300 hover:border-blue-500/30"
                      title={f.name}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="text-sm font-medium text-bolt-elements-textPrimary line-clamp-2">{f.name}</div>
                        <span className="text-xs font-mono text-bolt-elements-textSecondary">{f.branchRef}</span>
                      </div>
                      {f.analytics?.assignee && (
                        <div className="text-xs text-bolt-elements-textSecondary mt-1">@{f.analytics.assignee}</div>
                      )}
                      {f.timeTracking?.estimatedHours && (
                        <div className="text-xs text-bolt-elements-textTertiary mt-1">
                          Est {f.timeTracking.estimatedHours}h
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
