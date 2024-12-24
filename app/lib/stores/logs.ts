import { atom, map } from 'nanostores';
import Cookies from 'js-cookie';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('LogStore');

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'debug' | 'performance';
  message: string;
  details?: Record<string, any>;
  category: 'system' | 'provider' | 'user' | 'error' | 'network' | 'performance' | 'lifecycle';
  duration?: number;
  context?: {
    route?: string;
    component?: string;
    session?: string;
    featureFlags?: Record<string, boolean>;
    environment?: {
      browser?: string;
      os?: string;
      device?: string;
    };
    severity?: 'low' | 'medium' | 'high';
    docsLink?: string;
  };
  route?: string;
  component?: string;
  session?: string;
  featureFlags?: Record<string, boolean>;
  browser?: string;
  os?: string;
  device?: string;
  severity?: 'low' | 'medium' | 'high';
  docsLink?: string;
}

interface PerformanceMetrics {
  startTime: number;
  duration?: number;
  fps?: number;
  memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
  };
}

interface NetworkRequestDetails {
  url: string;
  method: string;
  payload?: any;
  headers?: Record<string, string>;
  retryCount?: number;
  startTime: number;
  endTime?: number;
}

interface APIErrorDetails {
  endpoint: string;
  errorType: string;
  errorMessage: string;
  timestamp: string;
  suggestion?: string;
  actionRequired?: boolean;
  [key: string]: any; // Allow for additional properties
}

const MAX_LOGS = 1000;
const MAX_LOG_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

class LogStore {
  private _logs = map<Record<string, LogEntry>>({});
  showLogs = atom(true);
  private _metrics: Map<string, PerformanceMetrics> = new Map();

  constructor() {
    this._loadLogs();
  }

  private _loadLogs() {
    const savedLogs = Cookies.get('eventLogs');

    if (savedLogs) {
      try {
        const parsedLogs = JSON.parse(savedLogs);
        this._logs.set(parsedLogs);
      } catch (error) {
        logger.error('Failed to parse logs from cookies:', error);
      }
    }
  }

  private _saveLogs() {
    const currentLogs = this._logs.get();
    Cookies.set('eventLogs', JSON.stringify(currentLogs));
  }

  private _generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private _trimLogs() {
    const currentLogs = Object.entries(this._logs.get());
    const now = Date.now();

    const filteredLogs = currentLogs.filter(([, log]) => {
      const logTimestamp = new Date(log.timestamp).getTime();
      return now - logTimestamp <= MAX_LOG_AGE;
    });

    if (filteredLogs.length > MAX_LOGS) {
      const sortedLogs = filteredLogs.sort(
        ([, a], [, b]) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
      const newLogs = Object.fromEntries(sortedLogs.slice(0, MAX_LOGS));
      this._logs.set(newLogs);
    } else {
      this._logs.set(Object.fromEntries(filteredLogs));
    }
  }

  getLogs(): LogEntry[] {
    return Object.values(this._logs.get()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }

  addLog(
    message: string,
    level: LogEntry['level'] = 'info',
    category: LogEntry['category'] = 'system',
    details?: Record<string, any>,
    context?: LogEntry['context'],
  ) {
    const id = this._generateId();
    const entry: LogEntry = {
      id,
      timestamp: new Date().toISOString(),
      level,
      message,
      details,
      category,
      context,
    };

    this._logs.setKey(id, entry);
    this._trimLogs();
    this._saveLogs();

    return id;
  }

  // Component Lifecycle Logging
  logLifecycle(component: string, event: string, details?: Record<string, any>) {
    return this.addLog(
      `${component}: ${event}`,
      'debug',
      'lifecycle',
      {
        ...details,
        timestamp: new Date().toISOString(),
        route: typeof window !== 'undefined' ? window.location.pathname : undefined,
      },
      {
        component,
        route: typeof window !== 'undefined' ? window.location.pathname : undefined,
      },
    );
  }

  // User Action Logging
  logUserAction(action: string, component: string, details?: Record<string, any>) {
    return this.addLog(`User Action: ${action}`, 'info', 'user', {
      component,
      ...details,
      timestamp: new Date().toISOString(),
      route: typeof window !== 'undefined' ? window.location.pathname : undefined,
    });
  }

  // Performance Monitoring
  startPerformanceMetric(id: string) {
    if (typeof window === 'undefined') {
      return;
    }

    this._metrics.set(id, {
      startTime: performance.now(),
      fps: 0,
    });
  }

  endPerformanceMetric(id: string, type: string) {
    if (typeof window === 'undefined') {
      return;
    }

    const metric = this._metrics.get(id);

    if (!metric) {
      return;
    }

    const endTime = performance.now();
    const duration = endTime - metric.startTime;

    // Check if performance.memory is available (Chrome only)
    const memory =
      typeof performance !== 'undefined' && (performance as any).memory
        ? {
            usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
            totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
          }
        : undefined;

    this.addLog(`Performance Metric: ${type}`, 'performance', 'performance', {
      id,
      duration,
      memory,
      fps: metric.fps,
      timestamp: new Date().toISOString(),
    });

    this._metrics.delete(id);
  }

  // Public method to access metrics
  getMetric(id: string): PerformanceMetrics | undefined {
    return this._metrics.get(id);
  }

  // Network Request Logging
  logNetworkRequest(details: NetworkRequestDetails) {
    const duration = details.endTime ? details.endTime - details.startTime : undefined;

    return this.addLog(`Network Request: ${details.method} ${details.url}`, 'info', 'network', {
      ...details,
      duration,
      timestamp: new Date().toISOString(),
    });
  }

  // Enhanced Error Logging
  logError(message: string, error?: Error | unknown, details?: Record<string, any>, docsLink?: string) {
    const errorDetails = {
      ...details,
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
              cause: error.cause,
            }
          : error,
      context: {
        route: typeof window !== 'undefined' ? window.location.pathname : undefined,
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
        timestamp: new Date().toISOString(),
        environment:
          typeof window !== 'undefined'
            ? {
                browser: navigator.userAgent,
                os: navigator.platform,
                device: navigator.userAgent,
              }
            : undefined,
        docsLink,
      },
    };
    return this.addLog(message, 'error', 'error', errorDetails);
  }

  // WebSocket State Logging
  logWebSocketState(url: string, state: string, details?: Record<string, any>) {
    return this.addLog(`WebSocket ${state}: ${url}`, 'info', 'network', {
      ...details,
      timestamp: new Date().toISOString(),
    });
  }

  // API events with detailed logging
  logAPIRequest(endpoint: string, method: string, details?: Record<string, any>) {
    const requestDetails = {
      endpoint,
      method,
      timestamp: new Date().toISOString(),
      ...details,
    };
    return this.addLog(`API Request: ${method} ${endpoint}`, 'info', 'system', requestDetails);
  }

  logAPIResponse(endpoint: string, status: number, duration: number, details?: Record<string, any>) {
    const responseDetails = {
      endpoint,
      status,
      duration,
      success: status >= 200 && status < 300,
      ...details,
    };
    const level = status >= 400 ? 'error' : status >= 300 ? 'warning' : 'info';

    return this.addLog(`API Response: ${endpoint} (${status})`, level, 'system', responseDetails);
  }

  logAPIError(endpoint: string, error: any, details?: Record<string, any>) {
    const errorDetails: APIErrorDetails = {
      endpoint,
      errorType: error?.name || 'UnknownError',
      errorMessage: error?.message || 'An unknown error occurred',
      timestamp: new Date().toISOString(),
      ...details,
    };

    // Special handling for missing API key
    if (error?.message?.includes('API key') || error?.response?.status === 401) {
      errorDetails.suggestion = 'Please check your API key configuration in the settings';
      errorDetails.actionRequired = true;
    }

    return this.addLog(`API Error: ${endpoint} - ${errorDetails.errorMessage}`, 'error', 'system', errorDetails);
  }

  // System events
  logSystem(message: string, details?: Record<string, any>) {
    return this.addLog(message, 'info', 'system', details);
  }

  // Provider events
  logProvider(message: string, details?: Record<string, any>) {
    return this.addLog(message, 'info', 'provider', details);
  }

  // Warning events
  logWarning(
    message: string,
    details?: Record<string, any>,
    severity?: 'low' | 'medium' | 'high',
    context?: Record<string, any>,
  ) {
    return this.addLog(message, 'warning', 'system', {
      ...details,
      ...context,
      severity,
      timestamp: new Date().toISOString(),
    });
  }

  // Debug events
  logDebug(message: string, step?: string, variables?: Record<string, any>, details?: Record<string, any>) {
    return this.addLog(message, 'debug', 'system', {
      ...details,
      step,
      variables,
      timestamp: new Date().toISOString(),
    });
  }

  clearLogs() {
    this._logs.set({});
    this._saveLogs();
  }
}

export const logStore = new LogStore();
