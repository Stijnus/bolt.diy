import * as Sentry from '@sentry/react';
import { useEffect, useState } from 'react';

export function SentryTest() {
  const [sentryStatus, setSentryStatus] = useState<string>('Checking...');
  const [lastError, setLastError] = useState<string>('');

  useEffect(() => {
    // Test if Sentry is properly initialized
    try {
      console.log('🔍 Checking Sentry availability...', { Sentry });

      // Check if Sentry is available and has the expected methods
      if (typeof Sentry !== 'undefined') {
        console.log('✅ Sentry object found:', Object.keys(Sentry));

        if (Sentry.captureException && Sentry.captureMessage) {
          console.log('✅ Sentry methods available');
          setSentryStatus('✅ Sentry is initialized');

          // Send a debug message to confirm it's working
          Sentry.captureMessage('Sentry initialization test', 'debug');
        } else {
          console.log('❌ Sentry methods missing');
          setSentryStatus('❌ Sentry methods not available');
        }
      } else {
        console.log('❌ Sentry object not found');
        setSentryStatus('❌ Sentry not available');
      }
    } catch (error) {
      console.error('❌ Error checking Sentry:', error);
      setSentryStatus('❌ Error checking Sentry: ' + error);
    }
  }, []);

  const testSentryError = () => {
    try {
      setLastError('Sending test error...');
      const error = new Error('Sentry Test Error - ' + new Date().toISOString());
      Sentry.captureException(error);
      console.log('✅ Test error sent to Sentry:', error);
      setLastError('✅ Test error sent to Sentry');
    } catch (err) {
      console.error('❌ Failed to send error to Sentry:', err);
      setLastError('❌ Failed to send error: ' + err);
    }
  };

  const testSentryMessage = () => {
    try {
      setLastError('Sending test message...');
      Sentry.captureMessage('Sentry Test Message - ' + new Date().toISOString(), 'info');
      console.log('✅ Test message sent to Sentry');
      setLastError('✅ Test message sent to Sentry');
    } catch (err) {
      console.error('❌ Failed to send message to Sentry:', err);
      setLastError('❌ Failed to send message: ' + err);
    }
  };

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
      <h3 className="text-lg font-semibold mb-4">Sentry Status Test</h3>
      <div className="space-y-3">
        <div className="text-sm">
          <strong>Status:</strong> {sentryStatus}
        </div>

        <div className="text-sm">
          <strong>Last Action:</strong> {lastError || 'None'}
        </div>

        <div className="flex gap-2">
          <button
            onClick={testSentryError}
            className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
          >
            Test Error
          </button>
          <button
            onClick={testSentryMessage}
            className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
          >
            Test Message
          </button>
        </div>

        <div className="text-xs text-gray-600 dark:text-gray-400">
          Check browser console and network tab for Sentry requests
        </div>
      </div>
    </div>
  );
}
