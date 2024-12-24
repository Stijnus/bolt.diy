import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { toast } from 'react-toastify';
import { Switch } from '~/components/ui/Switch';
import { logStore, type LogEntry } from '~/lib/stores/logs';
import { useStore } from '@nanostores/react';
import { classNames } from '~/utils/classNames';

export default function EventLogsTab() {
  const showLogs = useStore(logStore.showLogs);
  const [logLevel, setLogLevel] = useState<LogEntry['level'] | 'all'>('info');
  const [autoScroll, setAutoScroll] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [, forceUpdate] = useState({});
  const componentId = useMemo(() => `event-logs-${Date.now()}`, []);

  const filteredLogs = useMemo(() => {
    const logs = logStore.getLogs(); // Already sorted newest first
    return logs.filter((log) => {
      const matchesLevel = !logLevel || log.level === logLevel || logLevel === 'all';
      const matchesSearch =
        !searchQuery ||
        log.message?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        JSON.stringify(log.details)?.toLowerCase()?.includes(searchQuery?.toLowerCase());

      return matchesLevel && matchesSearch;
    });
  }, [logLevel, searchQuery]);

  // Component Lifecycle Logging
  useEffect(() => {
    // Start performance measurement
    logStore.startPerformanceMetric(componentId);

    // Log component mount
    logStore.logLifecycle('EventLogsTab', 'mounted', {
      settings: {
        showLogs,
        logLevel,
        autoScroll,
      },
    });

    // Initialize system logging
    logStore.logSystem('Event logging initialized', {
      version: process.env.NEXT_PUBLIC_APP_VERSION,
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
      featureFlags: {
        showLogs,
        autoScroll,
      },
    });

    return () => {
      logStore.logLifecycle('EventLogsTab', 'unmounted');
      logStore.endPerformanceMetric(componentId, 'component-lifecycle');
    };
  }, [componentId, showLogs, logLevel, autoScroll]);

  // Monitor Performance
  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();

    const measureFPS = () => {
      const now = performance.now();
      frameCount++;

      if (now - lastTime >= 1000) {
        const fps = Math.round((frameCount * 1000) / (now - lastTime));
        const metric = logStore.getMetric(componentId);

        if (metric) {
          metric.fps = fps;
        }

        frameCount = 0;
        lastTime = now;
      }

      requestAnimationFrame(measureFPS);
    };

    const frameId = requestAnimationFrame(measureFPS);

    return () => cancelAnimationFrame(frameId);
  }, [componentId]);

  // Log state changes
  useEffect(() => {
    logStore.logLifecycle('EventLogsTab', 'state-updated', {
      logLevel,
      autoScroll,
      searchQuery,
    });
  }, [logLevel, autoScroll, searchQuery]);

  // Auto-scroll effect
  useEffect(() => {
    const container = document.querySelector('.logs-container');

    if (container && autoScroll) {
      container.scrollTop = 0; // Scroll to top instead of bottom
    }
  }, [filteredLogs, autoScroll]);

  // Enhanced handlers with logging
  const handleClearLogs = useCallback(() => {
    const startTime = performance.now();

    if (confirm('Are you sure you want to clear all logs?')) {
      try {
        logStore.logUserAction('clear-logs', 'EventLogsTab', {
          logCount: filteredLogs.length,
        });

        logStore.clearLogs();
        toast.success('Logs cleared successfully');
        forceUpdate({});

        logStore.logSystem('Logs cleared', {
          duration: performance.now() - startTime,
        });
      } catch (error) {
        logStore.logError('Failed to clear logs', error);
        toast.error('Failed to clear logs');
      }
    }
  }, [filteredLogs.length]);

  const handleExportLogs = useCallback(() => {
    const startTime = performance.now();

    try {
      logStore.logUserAction('export-logs', 'EventLogsTab', {
        logCount: filteredLogs.length,
      });

      const logText = logStore.getLogs().map(formatLogEntry).join('\n\n');

      const blob = new Blob([logText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `event-logs-${new Date().toISOString()}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      logStore.logSystem('Logs exported', {
        duration: performance.now() - startTime,
        size: blob.size,
      });

      toast.success('Logs exported successfully');
    } catch (error) {
      logStore.logError('Failed to export logs', error);
      toast.error('Failed to export logs');
    }
  }, [filteredLogs.length]);

  const handleLogLevelChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const newLevel = event.target.value as LogEntry['level'] | 'all';
      logStore.logUserAction('change-log-level', 'EventLogsTab', {
        previousLevel: logLevel,
        newLevel,
      });
      setLogLevel(newLevel);
    },
    [logLevel],
  );

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = event.target.value;
    logStore.logUserAction('search-logs', 'EventLogsTab', {
      query: newQuery,
    });
    setSearchQuery(newQuery);
  }, []);

  const handleAutoScrollChange = useCallback((checked: boolean) => {
    logStore.logUserAction('toggle-auto-scroll', 'EventLogsTab', {
      enabled: checked,
    });
    setAutoScroll(checked);
  }, []);

  // Enhanced log formatting
  const formatLogEntry = useCallback((log: LogEntry) => {
    const timestamp = new Date(log.timestamp).toLocaleString();
    const level = log.level.toUpperCase();
    const duration = log.duration ? ` (${log.duration.toFixed(2)}ms)` : '';
    const context = log.context ? `\nContext: ${JSON.stringify(log.context, null, 2)}` : '';

    return `[${level}] ${timestamp}${duration}\n${log.message}${context}${
      log.details ? '\nDetails: ' + JSON.stringify(log.details, null, 2) : ''
    }`;
  }, []);

  const renderLogDetails = useCallback((log: LogEntry) => {
    if (!log.details) {
      return null;
    }

    if (log.level === 'error' && log.details.endpoint) {
      return (
        <div className="mt-2 space-y-2">
          <div className="flex flex-col space-y-1">
            <span className="text-xs text-bolt-elements-textSecondary">Endpoint: {log.details.endpoint}</span>
            {log.details.status && (
              <span className="text-xs text-bolt-elements-textSecondary">Status: {log.details.status}</span>
            )}
            {log.details.suggestion && (
              <div className="text-xs text-yellow-500 bg-yellow-500/10 p-2 rounded-md mt-1">
                Suggestion: {log.details.suggestion}
              </div>
            )}
          </div>
          <pre className="text-xs text-bolt-elements-textSecondary overflow-x-auto whitespace-pre-wrap break-all bg-bolt-elements-bg-depth-2 p-2 rounded-md">
            {JSON.stringify(log.details, null, 2)}
          </pre>
        </div>
      );
    }

    return (
      <pre className="mt-2 text-xs text-bolt-elements-textSecondary overflow-x-auto whitespace-pre-wrap break-all">
        {JSON.stringify(log.details, null, 2)}
      </pre>
    );
  }, []);

  return (
    <div className="p-4 h-full flex flex-col">
      <div className="flex flex-col space-y-4 mb-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 className="text-lg font-medium text-bolt-elements-textPrimary">Event Logs</h3>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-bolt-elements-textSecondary whitespace-nowrap">Show Actions</span>
              <Switch checked={showLogs} onCheckedChange={(checked) => logStore.showLogs.set(checked)} />
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-bolt-elements-textSecondary whitespace-nowrap">Auto-scroll</span>
              <Switch checked={autoScroll} onCheckedChange={handleAutoScrollChange} />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={logLevel}
            onChange={handleLogLevelChange}
            className="flex-1 p-2 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-prompt-background text-bolt-elements-textPrimary focus:outline-none focus:ring-2 focus:ring-bolt-elements-focus transition-all lg:max-w-[20%] text-sm min-w-[100px]"
          >
            <option value="all">All</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
            <option value="debug">Debug</option>
            <option value="performance">Performance</option>
          </select>
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full bg-white dark:bg-bolt-elements-background-depth-4 relative px-2 py-1.5 rounded-md focus:outline-none placeholder-bolt-elements-textTertiary text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary border border-bolt-elements-borderColor"
            />
          </div>
          {showLogs && (
            <div className="flex items-center gap-2 flex-nowrap">
              <button
                onClick={handleExportLogs}
                className="rounded-lg px-4 py-2 bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text hover:bg-bolt-elements-button-primary-backgroundHover"
              >
                Export Logs
              </button>
              <button
                onClick={handleClearLogs}
                className="rounded-lg px-4 py-2 bg-bolt-elements-button-danger-background text-bolt-elements-button-danger-text hover:bg-bolt-elements-button-danger-backgroundHover"
              >
                Clear Logs
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-bolt-elements-bg-depth-1 rounded-lg p-4 h-[calc(100vh - 250px)] min-h-[400px] overflow-y-auto logs-container">
        {filteredLogs.length === 0 ? (
          <div className="text-center text-bolt-elements-textSecondary py-8">No logs found</div>
        ) : (
          filteredLogs.map((log, index) => (
            <div
              key={index}
              className="text-sm mb-3 font-mono border-b border-bolt-elements-borderColor pb-2 last:border-0"
            >
              <div className="flex items-start space-x-2 flex-wrap">
                <span className={`font-bold ${getLevelColor(log.level)} whitespace-nowrap`}>
                  [{log.level.toUpperCase()}]
                </span>
                <span className="text-bolt-elements-textSecondary whitespace-nowrap">
                  {new Date(log.timestamp).toLocaleString()}
                </span>
                <span
                  className={classNames(
                    'text-bolt-elements-textPrimary break-all',
                    log.details?.actionRequired && 'font-semibold',
                  )}
                >
                  {log.message}
                </span>
              </div>
              {renderLogDetails(log)}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function getLevelColor(level: LogEntry['level']) {
  switch (level) {
    case 'info':
      return 'text-blue-500';
    case 'warning':
      return 'text-yellow-500';
    case 'error':
      return 'text-red-500';
    case 'debug':
      return 'text-gray-500';
    case 'performance':
      return 'text-green-500';
    default:
      return 'text-bolt-elements-textPrimary';
  }
}
