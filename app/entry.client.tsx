import { RemixBrowser } from '@remix-run/react';
import * as Sentry from '@sentry/react';
import { startTransition } from 'react';
import { hydrateRoot } from 'react-dom/client';

// Initialize Sentry
Sentry.init({
  dsn: 'https://266a47107dab59fff67b9f6fd7ad9753@o4509994987683840.ingest.de.sentry.io/4509994989256785',
  enableLogs: true,

  /*
   * Setting this option to true will send default PII data to Sentry.
   * For example, automatic IP address collection on events
   */
  sendDefaultPii: true,

  // Enable tracing for performance monitoring
  tracesSampleRate: 1.0,

  // Enable replay for session recordings
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    // Send console.log, console.warn, and console.error calls as logs to Sentry
    Sentry.consoleLoggingIntegration({ levels: ['log', 'warn', 'error'] }),
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
});

startTransition(() => {
  hydrateRoot(document.getElementById('root')!, <RemixBrowser />);
});
