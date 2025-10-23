import { WebContainer } from '@webcontainer/api';
import { WORK_DIR_NAME } from '~/utils/constants';
import { cleanStackTrace } from '~/utils/stacktrace';

interface WebContainerContext {
  loaded: boolean;
}

export const webcontainerContext: WebContainerContext = import.meta.hot?.data.webcontainerContext ?? {
  loaded: false,
};

if (import.meta.hot) {
  import.meta.hot.data.webcontainerContext = webcontainerContext;
}

export let webcontainer: Promise<WebContainer> = new Promise(() => {
  // noop for ssr
});

if (!import.meta.env.SSR) {
  webcontainer =
    import.meta.hot?.data.webcontainer ??
    Promise.resolve()
      .then(() => {
        console.log('🚀 [WebContainer] Starting boot process...');
        console.log('🔍 [WebContainer] Environment check:', {
          sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined' ? '✅' : '❌',
          webAssembly: typeof WebAssembly !== 'undefined' ? '✅' : '❌',
          serviceWorker: 'serviceWorker' in navigator ? '✅' : '❌',
        });

        return WebContainer.boot({
          coep: 'credentialless',
          workdirName: WORK_DIR_NAME,
          forwardPreviewErrors: true, // Enable error forwarding from iframes
        });
      })
      .then(async (webcontainer) => {
        console.log('✅ [WebContainer] Boot successful!');
        webcontainerContext.loaded = true;

        const { workbenchStore } = await import('~/lib/stores/workbench');

        console.log('📥 [WebContainer] Loading inspector script...');

        const response = await fetch('/inspector-script.js');

        if (!response.ok) {
          console.warn(`⚠️ [WebContainer] Inspector script returned ${response.status}`);
        }

        const inspectorScript = await response.text();
        await webcontainer.setPreviewScript(inspectorScript);
        console.log('✅ [WebContainer] Inspector script loaded');

        // Listen for preview errors
        webcontainer.on('preview-message', (message) => {
          console.log('📨 [WebContainer] Preview message:', message);

          // Handle both uncaught exceptions and unhandled promise rejections
          if (message.type === 'PREVIEW_UNCAUGHT_EXCEPTION' || message.type === 'PREVIEW_UNHANDLED_REJECTION') {
            const isPromise = message.type === 'PREVIEW_UNHANDLED_REJECTION';
            const title = isPromise ? 'Unhandled Promise Rejection' : 'Uncaught Exception';
            workbenchStore.actionAlert.set({
              type: 'preview',
              title,
              description: 'message' in message ? message.message : 'Unknown error',
              content: `Error occurred at ${message.pathname}${message.search}${message.hash}\nPort: ${message.port}\n\nStack trace:\n${cleanStackTrace(message.stack || '')}`,
              source: 'preview',
            });
          }
        });

        console.log('✅ [WebContainer] Fully initialized and ready');

        return webcontainer;
      })
      .catch((error) => {
        console.error('❌ [WebContainer] Boot failed:', error);
        console.error('📋 [WebContainer] Error details:', {
          message: error.message,
          name: error.name,
          stack: error.stack?.split('\n').slice(0, 5).join('\n'),
          sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
          webAssembly: typeof WebAssembly !== 'undefined',
          serviceWorker: 'serviceWorker' in navigator,
        });

        // Check for common issues
        if (typeof SharedArrayBuffer === 'undefined') {
          console.error('💡 [WebContainer] SharedArrayBuffer is not available.');
          console.error('   This usually means Cross-Origin-Embedder-Policy (COEP) header is missing.');
          console.error('   Check your server configuration.');
        }

        if (!('serviceWorker' in navigator)) {
          console.error('💡 [WebContainer] Service Workers are not supported in this browser.');
          console.error('   Use Chrome 109+, Edge 109+, or Brave.');
        }

        throw error;
      });

  if (import.meta.hot) {
    import.meta.hot.data.webcontainer = webcontainer;
  }
}
