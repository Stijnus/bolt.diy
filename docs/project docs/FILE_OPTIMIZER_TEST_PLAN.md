# File Change Optimizer Test Plan

## Quick Validation Tests

### Test 1: Basic Optimization (5 minutes)
**Prompt:** "Create a simple React counter component"
**Expected:** Should create new files normally
**Check:** Look for optimization stats in browser dev tools console

### Test 2: Redundant Changes (5 minutes)
**Prompt:** "Add the same React counter component again"
**Expected:** Should skip creating duplicate files
**Check:** Console should show files skipped due to high similarity

### Test 3: Minor Whitespace Changes (3 minutes)
**Prompt:** "Add some extra blank lines to the counter component"
**Expected:** Should skip whitespace-only changes
**Check:** Files should not be rewritten

### Test 4: Large File Handling (5 minutes)
**Prompt:** "Create a large configuration file with 500+ lines of JSON data"
**Expected:** Should use fast heuristics instead of expensive diff
**Check:** Console logs should mention "Skipping diff for large file"

## Comprehensive Test Suite

### Test 5: Real Bug Fix Scenario (10 minutes)
```
1. Create: "Build a simple todo app with React"
2. Then: "Fix the bug where completed todos don't show strikethrough"
3. Check: Should detect bug fix intent and allow small targeted changes
```

### Test 6: Performance Test (10 minutes)
```
1. Create: "Build a full-stack app with multiple components"
2. Then: "Change just one import statement in one file"
3. Check: Should skip rewriting all other unchanged files
```

### Test 7: Binary/Asset Files (5 minutes)
```
1. Ask to: "Add a favicon and some images to the project"
2. Check: Binary files should bypass optimization entirely
```

### Test 8: Configuration Files (5 minutes)
```
1. Ask to: "Update package.json and tsconfig.json"
2. Check: Critical config files should write immediately
```

## How to Monitor Optimization

### Browser Console Logs
Look for these log patterns:
```
[FileChangeOptimizer] summary { analyzed: X, written: Y, skipped: Z, optimizationRate: "N%" }
[opt] filename.js -> skip (95.2% sim, 1.8% change) :: High similarity 95.2%
📝 Queued file change: src/App.js (len=1234)
Skipping diff for large file package-lock.json (50000 bytes)
```

### Optimization Statistics
Check the ActionRunner optimization stats:
- `totalFilesAnalyzed`: Total files processed
- `filesSkipped`: Files that were optimized away
- `filesModified`: Files that were updated
- `filesCreated`: New files created
- `optimizationRate`: Percentage of files skipped

## Success Criteria

### ✅ Working Correctly If:
1. **New projects create files normally** (no false positives)
2. **Duplicate requests skip files** (50%+ optimization rate)
3. **Small changes are detected and applied** (bug fixes work)
4. **Large files use fast processing** (no performance issues)
5. **Console shows detailed optimization logs**

### ⚠️ Issues If:
1. **No files are created** (optimizer too aggressive)
2. **All files always rewrite** (optimizer not working)
3. **Important changes are skipped** (false negatives)
4. **Browser freezes on large files** (performance regression)

## Advanced Testing

### Performance Benchmark
```javascript
// Add to browser console to measure timing
console.time('file-optimization');
// Run test scenario
console.timeEnd('file-optimization');
```

### Memory Usage Monitor
```javascript
// Monitor memory usage during optimization
setInterval(() => {
  const used = performance.memory.usedJSHeapSize / 1024 / 1024;
  console.log(`Memory usage: ${used.toFixed(2)} MB`);
}, 1000);
```

## Test Prompts for Different Scenarios

### Similarity Detection
- "Create the same component again"
- "Add the exact same function to utils.js"

### Whitespace Changes
- "Add some blank lines to make the code more readable"
- "Fix indentation in the existing files"

### Comment Changes
- "Add detailed comments to explain the code"
- "Remove all comments from the files"

### Bug Fix Detection
- "Fix the error where buttons don't respond to clicks"
- "Resolve the styling issue with the header"

### Large File Tests
- "Generate a comprehensive test file with 100+ test cases"
- "Create a large JSON configuration with detailed settings"

## Quick 5-Minute Smoke Test

1. **Create Project:** "Build a React calculator app"
2. **Duplicate Request:** "Create the same calculator app"
3. **Check Console:** Should see high optimization rate (>80%)
4. **Minor Change:** "Add a comment to explain the calculator logic"
5. **Verify:** Comments should be skipped if comment-only changes

If all these pass, the optimizer is working correctly!