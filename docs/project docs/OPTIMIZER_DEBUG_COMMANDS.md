# File Optimizer Debug Commands

## Browser Console Commands for Testing

### Check Optimization Stats
```javascript
// Get current optimization statistics
const workbench = window.__WORKBENCH_STORE__;
if (workbench?.firstArtifact?.runner) {
  const stats = workbench.firstArtifact.runner.getOptimizationStats();
  console.table(stats);
}
```

### Enable Verbose Logging
```javascript
// Enable debug logging for file optimizer
localStorage.setItem('debug', '*FileChangeOptimizer*,*ActionRunner*');
// Reload page for changes to take effect
```

### Monitor File Changes in Real-Time
```javascript
// Watch for file optimization events
const originalLog = console.log;
console.log = function(...args) {
  if (args[0] && args[0].includes('[opt]')) {
    console.group('🔧 File Optimization');
    originalLog.apply(console, arguments);
    console.groupEnd();
  } else {
    originalLog.apply(console, arguments);
  }
};
```

### Force Optimization Flush
```javascript
// Manually trigger pending file optimizations
const workbench = window.__WORKBENCH_STORE__;
if (workbench?.firstArtifact?.runner) {
  workbench.firstArtifact.runner.flushPendingFileChanges();
}
```

### Check File Optimization Settings
```javascript
// View current optimization thresholds
const fileOptimizer = window.__FILE_CHANGE_OPTIMIZER__;
if (fileOptimizer) {
  console.log('Similarity threshold:', fileOptimizer._similarityThreshold);
  console.log('Change threshold:', fileOptimizer._minimalChangeThreshold);
}
```

### Reset Optimization Cache
```javascript
// Clear similarity computation cache
const fileOptimizer = window.__FILE_CHANGE_OPTIMIZER__;
if (fileOptimizer) {
  fileOptimizer._similarityCache.clear();
  console.log('Cache cleared');
}
```

## Test Scenarios with Expected Outputs

### Scenario 1: New File Creation
```
Input: "Create a React component"
Expected Console Output:
✅ [opt] src/Component.js -> create (0% sim, 100% change) :: New file creation
✅ 📝 Queued file change: src/Component.js (len=456)
```

### Scenario 2: Duplicate File Skip
```
Input: "Create the same React component"
Expected Console Output:
✅ [opt] src/Component.js -> skip (98.5% sim, 1.2% change) :: High similarity 98.5%
✅ [FileChangeOptimizer] summary { analyzed: 1, written: 0, skipped: 1, optimizationRate: "100.0%" }
```

### Scenario 3: Large File Handling
```
Input: Large file (>1MB)
Expected Console Output:
✅ Skipping diff for large file package-lock.json (1048576 bytes)
✅ [opt] package-lock.json -> create (0% sim, 100% change) :: New file creation
```

### Scenario 4: Comment-Only Changes
```
Input: "Add comments to explain the code"
Expected Console Output:
✅ [opt] src/Component.js -> skip (95.0% sim, 2.1% change) :: Comment-only changes
```

## Troubleshooting

### If No Optimization Logs Appear:
1. Check browser console for errors
2. Verify debug logging is enabled
3. Ensure you're using a supported model
4. Check if optimization is disabled in settings

### If Everything Gets Skipped:
- Thresholds might be too aggressive
- Check similarity calculations in console
- Verify intent detection is working

### If Nothing Gets Skipped:
- Optimization might be disabled
- Cache might be corrupted
- Check for JavaScript errors

## Performance Monitoring

### Memory Usage
```javascript
setInterval(() => {
  const memory = performance.memory;
  console.log(`Heap: ${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`);
}, 5000);
```

### Timing Analysis
```javascript
// Wrap optimization calls to measure performance
const originalOptimize = fileOptimizer.optimizeFileChanges;
fileOptimizer.optimizeFileChanges = async function(...args) {
  console.time('optimization');
  const result = await originalOptimize.apply(this, args);
  console.timeEnd('optimization');
  return result;
};
```