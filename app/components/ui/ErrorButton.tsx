import * as Sentry from '@sentry/react';

// Add this button component to your app to test Sentry's error tracking
export function ErrorButton() {
  return (
    <button
      onClick={() => {
        // Explicitly capture the error with Sentry
        const error = new Error('This is your first error!');
        Sentry.captureException(error);
        console.error('Test error captured:', error);
      }}
      className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
    >
      Break the world
    </button>
  );
}
