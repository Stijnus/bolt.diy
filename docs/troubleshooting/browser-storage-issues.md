# Browser Storage Issues and Troubleshooting

## Overview

Browser storage corruption can cause various mysterious application failures including stream timeouts, template selection loops, and LLM response failures. This document outlines common issues and solutions.

## Common Symptoms

### Stream Timeouts and Recovery Loops
- **Symptoms**: Repeated stream recovery attempts, "Max retries reached" errors
- **Logs**: `WARN stream-recovery Stream timeout detected`, `ERROR stream-recovery Max retries reached`
- **Cause**: Corrupted chat state, message history, or API configuration in localStorage/IndexedDB

### Template Selection Issues
- **Symptoms**: "Vite React" template selection for existing projects, unwanted starter template creation
- **Cause**: Corrupted `autoSelectTemplate` setting or file state data

### LLM Response Failures
- **Symptoms**: No response from LLM, immediate errors after sending messages
- **Cause**: Malformed provider settings, corrupted API keys, or invalid prompt data

## Quick Resolution

### Clear All Browser Storage
1. Open browser Developer Tools (F12)
2. Go to Application/Storage tab
3. Select "Storage" in left sidebar
4. Click "Clear site data" or manually clear:
   - Local Storage
   - Session Storage
   - IndexedDB
   - Cookies (if needed)
5. Refresh the application

### Alternative: Incognito/Private Mode
Test the application in incognito/private browsing mode to verify if storage corruption is the issue.

## Prevention and Monitoring

### Automatic Storage Health Monitoring
The application now includes automatic storage monitoring that:
- Performs health checks on startup and periodically
- Detects quota issues and storage corruption
- Automatically cleans stale data when storage is full
- Logs storage-related issues for debugging

### Manual Storage Health Check
```javascript
// In browser console
import('./lib/utils/storage').then(({ SafeStorage }) => {
  const health = SafeStorage.healthCheck();
  console.log('Storage health:', health);
});
```

## Storage Data Types and Locations

### localStorage Keys
- `provider_settings` - LLM provider configurations
- `promptId` - Selected prompt template
- `autoSelectTemplate` - Template auto-selection setting
- `contextOptimizationEnabled` - Context optimization setting
- `isEventLogsEnabled` - Event logging setting
- `bolt_tab_configuration` - UI tab configuration
- `chat_*` - Chat history data
- `log_*` - Application log data

### IndexedDB Stores
- Chat histories and message data
- File system state and locked files
- Workbench and preview states

## Recovery Procedures

### Partial Recovery (Preserve Some Data)
1. Export chat history before clearing storage
2. Note down API keys and provider settings
3. Clear only problematic storage areas
4. Re-import/reconfigure as needed

### Complete Reset
1. Clear all browser storage for the application
2. Reconfigure API keys and provider settings
3. Restore chat history from exports if available

## Code Changes Made

### Enhanced Project Detection
- Added robust project file detection to prevent template selection issues
- Detects existing package.json, app/, src/, and config files

### Storage Error Handling
- Created `SafeStorage` utility class with comprehensive error handling
- Automatic quota management and stale data cleanup
- Health monitoring and periodic checks

### Unified Prompt System
- Optimized build mode prompts for 40-60% token reduction
- Maintained discuss mode functionality with dedicated prompts
- Added project context awareness

## Future Improvements

### Planned Enhancements
- Storage corruption detection and automatic recovery
- User-friendly storage health dashboard
- Automatic backup and restore of critical settings
- Storage usage optimization and compression

### Monitoring
- Enhanced logging for storage operations
- Performance metrics for storage operations
- User notifications for storage issues

## Related Issues

This troubleshooting was developed after identifying that browser storage corruption was the root cause of mysterious application failures that initially appeared to be prompt system or template selection bugs.

## See Also

- [Developer Tools Storage Tab Documentation](https://developer.chrome.com/docs/devtools/storage/)
- [Web Storage API Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API)
- [IndexedDB Debugging Guide](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB)