import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { toast } from 'react-toastify';
import { Switch } from '~/components/ui/Switch';
import { logStore, type LogEntry } from '~/lib/stores/logs';
import { useStore } from '@nanostores/react';
import { classNames } from '~/utils/classNames';
import { IconButton } from '~/components/ui/IconButton';

export default function EventLogsTab() {
  const showLogs = useStore(logStore.showLogs);
  const [logLevel, setLogLevel] = useState<LogEntry['level'] | 'all'>('info');
  const [autoScroll, setAutoScroll] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'message' | 'level' | 'category' | 'timestamp'>('message');
  const componentId = useMemo(() => `event-logs-${Date.now()}`, []);

  const filteredLogs = useMemo(() => {
    const logs = logStore.getLogs(); // Already sorted newest first
    return logs.filter((log) => {
      if (logLevel !== 'all' && log.level !== logLevel) {
        return false;
      }

      if (!searchQuery) {
        return true;
      }

      const query = searchQuery.toLowerCase();

      switch (searchType) {
        case 'message':
          return log.message.toLowerCase().includes(query);
        case 'level':
          return log.level.toLowerCase().includes(query);
        case 'category':
          return log.category.toLowerCase().includes(query);
        case 'timestamp':
          return log.timestamp.toLowerCase().includes(query);
        default:
          return true;
      }
    });
  }, [logLevel, searchQuery, searchType]);

  // Performance monitoring
  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    const targetFPS = 60;
    const measurementInterval = 1000; // 1 second

    const measureFPS = () => {
      const currentTime = performance.now();
      frameCount++;

      if (currentTime - lastTime >= measurementInterval) {
        const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));

        if (fps < targetFPS * 0.8) {
          // If FPS drops below 80% of target
          logStore.logSystem('event-logs-fps-drop', {
            fps,
            targetFPS,
            component: 'EventLogsTab',
          });
        }

        frameCount = 0;
        lastTime = currentTime;
      }
    };

    const frameId = requestAnimationFrame(measureFPS);

    return () => cancelAnimationFrame(frameId);
  }, [componentId]);

  const handleAutoScrollChange = useCallback((checked: boolean) => {
    logStore.logUserAction('toggle-auto-scroll', 'EventLogsTab', {
      enabled: checked,
    });
    setAutoScroll(checked);
  }, []);

  const handleSearchQueryChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  }, []);

  const handleSearchTypeChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    setSearchType(event.target.value as 'message' | 'level' | 'category' | 'timestamp');
  }, []);

  const handleLogLevelChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    setLogLevel(event.target.value as LogEntry['level'] | 'all');
  }, []);

  const handleClearLogs = useCallback(() => {
    logStore.clearLogs();
    toast.success('Logs cleared');
  }, []);

  const handleExportLogs = useCallback(() => {
    const logs = logStore.getLogs();
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `event-logs-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Logs exported');
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-4 p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <span>Show Logs</span>
          <Switch checked={showLogs} onCheckedChange={(checked) => logStore.showLogs.set(checked)} />
        </div>
        <div className="flex items-center gap-2">
          <span>Auto Scroll</span>
          <Switch checked={autoScroll} onCheckedChange={handleAutoScrollChange} />
        </div>
        <select
          value={logLevel}
          onChange={handleLogLevelChange}
          className="px-2 py-1 text-sm border border-gray-300 rounded dark:border-gray-700 dark:bg-gray-800"
        >
          <option value="all">All Levels</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="error">Error</option>
          <option value="debug">Debug</option>
          <option value="performance">Performance</option>
        </select>
        <div className="flex items-center gap-2">
          <select
            value={searchType}
            onChange={handleSearchTypeChange}
            className="px-2 py-1 text-sm border border-gray-300 rounded dark:border-gray-700 dark:bg-gray-800"
          >
            <option value="message">Message</option>
            <option value="level">Level</option>
            <option value="category">Category</option>
            <option value="timestamp">Timestamp</option>
          </select>
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchQueryChange}
              placeholder="Search logs..."
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded dark:border-gray-700 dark:bg-gray-800"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <IconButton
            className="text-gray-500 hover:text-gray-700"
            icon="i-ph:trash"
            onClick={handleClearLogs}
            title="Clear Logs"
          />
          <IconButton
            className="text-gray-500 hover:text-gray-700"
            icon="i-ph:download"
            onClick={handleExportLogs}
            title="Export Logs"
          />
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <pre className="p-4 text-sm">
          {filteredLogs.map((log) => (
            <div
              key={log.id}
              className={classNames('mb-2', {
                'text-red-500': log.level === 'error',
                'text-yellow-500': log.level === 'warning',
                'text-blue-500': log.level === 'debug',
                'text-purple-500': log.level === 'performance',
              })}
            >
              [{log.timestamp}] [{log.level.toUpperCase()}] {log.message}
              {log.details && <div className="ml-4 text-gray-500">{JSON.stringify(log.details, null, 2)}</div>}
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}
