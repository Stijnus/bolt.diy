import * as Sentry from '@sentry/react';

// Error tracking utility
export const captureException = (error: Error, context?: Record<string, any>) => {
  if (context) {
    Sentry.withScope((scope) => {
      Object.keys(context).forEach((key) => {
        scope.setTag(key, context[key]);
      });
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
};

// Custom span instrumentation for UI actions
export const startSpan = Sentry.startSpan;

// Custom span for UI click events
export const trackButtonClick = (buttonName: string, callback: () => void) => {
  Sentry.startSpan(
    {
      op: 'ui.click',
      name: `Button Click: ${buttonName}`,
    },
    () => {
      callback();
    },
  );
};

// Custom span for API calls
export const trackApiCall = async <T>(method: string, url: string, callback: () => Promise<T>): Promise<T> => {
  return Sentry.startSpan(
    {
      op: 'http.client',
      name: `${method} ${url}`,
    },
    async () => {
      return await callback();
    },
  );
};

// Logger utilities
export const logger = Sentry.logger;

// Performance monitoring
export const startTransaction = (name: string, op: string) => {
  return Sentry.startSpan(
    {
      op,
      name,
    },
    () => {
      // Empty span callback
    },
  );
};

// User feedback
export const captureUserFeedback = (name: string, email: string, comments: string) => {
  // Sentry v8+: captureFeedback replaces captureUserFeedback
  if ((Sentry as any).captureFeedback) {
    (Sentry as any).captureFeedback({ name, email, message: comments });
  } else {
    (Sentry as any).captureUserFeedback?.({ name, email, comments });
  }
};

// Set user context
export const setUser = (user: { id: string; email?: string; username?: string }) => {
  Sentry.setUser(user);
};

// Set tags
export const setTag = (key: string, value: string) => {
  Sentry.setTag(key, value);
};

// Set context
export const setContext = (key: string, context: Record<string, any>) => {
  Sentry.setContext(key, context);
};

// Add breadcrumb for debugging
export const addBreadcrumb = (message: string, category?: string, level?: Sentry.Breadcrumb['level']) => {
  Sentry.addBreadcrumb({
    message,
    category: category || 'custom',
    level: level || 'info',
  });
};
