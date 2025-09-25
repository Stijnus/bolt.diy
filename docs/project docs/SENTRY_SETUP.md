# Sentry Integration Setup

This document describes the Sentry integration setup for the Bolt.diy project.

## Overview

Sentry has been integrated to provide error tracking, performance monitoring, and session replay capabilities for the application.

## Configuration

### Basic Setup

Sentry is initialized in `app/entry.client.tsx` with the following configuration:

- **DSN**: `https://266a47107dab59fff67b9f6fd7ad9753@o4509994987683840.ingest.de.sentry.io/4509994989256785`
- **Organization**: `nastman`
- **Project**: `javascript-react`
- **Tracing**: Enabled (1.0 sample rate)
- **Replays**: Enabled (0.1 session sample rate, 1.0 error sample rate)
- **Logs**: Enabled with console logging integration

### Source Maps

Source maps are automatically uploaded during the build process:

```bash
npm run build  # This includes source map upload
```

Manual source map upload:
```bash
npm run sentry:sourcemaps
```

## Components

### Error Boundary

A custom error boundary (`SentryErrorBoundary`) wraps the entire application to catch and report React component errors.

### Test Components

- **ErrorButton**: A test button that intentionally throws an error (available in development mode in Settings)
- **SentryErrorBoundary**: Catches React errors and displays a user-friendly error page

## Usage Examples

### Error Tracking

```typescript
import { captureException } from '~/utils/sentry';

// Capture an exception
try {
  // Some risky code
} catch (error) {
  captureException(error, { userId: '123', action: 'login' });
}
```

### Performance Monitoring

```typescript
import { startSpan, trackApiCall } from '~/utils/sentry';

// Custom span for UI interactions
startSpan({ op: 'ui.click', name: 'Button Click' }, () => {
  // Your code here
});

// API call tracking
const result = await trackApiCall('GET', '/api/users', async () => {
  return fetch('/api/users').then(r => r.json());
});
```

### Logging

```typescript
import { logger } from '~/utils/sentry';

// Structured logging
logger.error('Failed to process payment', {
  orderId: 'order_123',
  amount: 99.99
});

logger.fmt`Cache miss for user: ${userId}`;
```

### User Context

```typescript
import { setUser, setTag, setContext } from '~/utils/sentry';

// Set user information
setUser({
  id: '123',
  email: 'user@example.com',
  username: 'johndoe'
});

// Add tags
setTag('subscription', 'premium');

// Add context
setContext('user_session', {
  loginTime: new Date().toISOString(),
  deviceType: 'desktop'
});
```

## Testing

### Error Testing

1. Go to Settings → Development Tools (only visible in development mode)
2. Click the "Break the world" button
3. This will intentionally throw an error that should appear in your Sentry dashboard

### Manual Error Generation

```typescript
// In browser console or component
throw new Error('Test error from Bolt.diy');
```

## Configuration Files

- **`.sentryclirc`**: Sentry CLI configuration
- **`app/entry.client.tsx`**: Sentry initialization
- **`app/utils/sentry.ts`**: Utility functions for Sentry operations
- **`app/components/ui/SentryErrorBoundary.tsx`**: React error boundary
- **`app/components/ui/ErrorButton.tsx`**: Test error button

## Environment Setup

To complete the setup, you need to:

1. **Get Sentry Auth Token**:
   - Go to Sentry dashboard → Settings → Developer Settings → Auth Tokens
   - Create a new token with `project:releases` scope
   - Replace `YOUR_SENTRY_AUTH_TOKEN_HERE` in `.sentryclirc`

2. **Verify Configuration**:
   - Run `npm run build` to test source map upload
   - Check Sentry dashboard for new releases and source maps

## Troubleshooting

### Source Maps Not Uploading

1. Check your Sentry auth token is valid
2. Verify the organization and project names match your Sentry setup
3. Ensure the build directory (`./build/client`) exists

### Errors Not Appearing

1. Check browser console for Sentry initialization errors
2. Verify the DSN is correct
3. Check network tab for failed requests to Sentry

### Missing Source Context

1. Ensure source maps are uploaded after each build
2. Check that your build process isn't minifying code in a way that breaks source maps
3. Verify the source map files exist in the build directory

## Best Practices

1. **Use structured logging** with context objects
2. **Set user context** when users log in
3. **Add breadcrumbs** for debugging complex user flows
4. **Use custom spans** for performance monitoring of key operations
5. **Test error scenarios** in development before deploying

## Security Notes

- Never commit your Sentry auth token to version control
- Use environment variables for sensitive configuration
- The DSN is public and safe to include in client-side code
