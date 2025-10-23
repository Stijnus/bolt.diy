/**
 * Test script to demonstrate Supabase project name sanitization
 * Run with: node test-name-sanitization.js
 */

// Replicate the sanitization logic
function sanitizeProjectName(name) {
  // Convert to lowercase
  let sanitized = name.toLowerCase();

  // Replace spaces and underscores with hyphens
  sanitized = sanitized.replace(/[\s_]+/g, '-');

  // Remove invalid characters (keep only lowercase letters, numbers, hyphens)
  sanitized = sanitized.replace(/[^a-z0-9-]/g, '');

  // Remove leading/trailing hyphens
  sanitized = sanitized.replace(/^-+|-+$/g, '');

  // Remove consecutive hyphens
  sanitized = sanitized.replace(/-+/g, '-');

  // Ensure minimum length (if too short, generate a valid name)
  if (sanitized.length < 2) {
    sanitized = 'project-' + Math.random().toString(36).substring(2, 8);
  }

  // Ensure maximum length
  if (sanitized.length > 63) {
    sanitized = sanitized.substring(0, 63);
    // Make sure it doesn't end with a hyphen after truncation
    sanitized = sanitized.replace(/-+$/, '');
  }

  return sanitized;
}

function validateProjectName(name) {
  if (!name || name.length < 2) {
    return { valid: false, error: 'Project name must be at least 2 characters long' };
  }

  if (name.length > 63) {
    return { valid: false, error: 'Project name must be at most 63 characters long' };
  }

  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(name)) {
    return {
      valid: false,
      error: 'Project name must start and end with lowercase letters or numbers, and only contain lowercase letters, numbers, and hyphens',
    };
  }

  return { valid: true };
}

// Test cases
const testCases = [
  { input: 'My Project', expected: 'my-project' },
  { input: 'Task Manager', expected: 'task-manager' },
  { input: 'task_manager', expected: 'task-manager' },
  { input: 'My App 2024!!!', expected: 'my-app-2024' },
  { input: '-myapp-', expected: 'myapp' },
  { input: 'TaskManager', expected: 'taskmanager' },
  { input: 'kanban-board', expected: 'kanban-board' },
  { input: 'my@project#123', expected: 'myproject123' },
  { input: 'APP___NAME', expected: 'app-name' },
  { input: 'a', expected: /^project-[a-z0-9]{6}$/ }, // Auto-generated
  { input: 'a'.repeat(70), expected: (val) => val.length === 63 }, // Truncated
];

console.log('🧪 Testing Supabase Project Name Sanitization\n');
console.log('=' .repeat(70));

let passed = 0;
let failed = 0;

testCases.forEach((test, index) => {
  const sanitized = sanitizeProjectName(test.input);
  const validation = validateProjectName(sanitized);
  
  let success = false;
  if (typeof test.expected === 'function') {
    success = test.expected(sanitized);
  } else if (test.expected instanceof RegExp) {
    success = test.expected.test(sanitized);
  } else {
    success = sanitized === test.expected;
  }

  const icon = success && validation.valid ? '✅' : '❌';
  const status = success && validation.valid ? 'PASS' : 'FAIL';
  
  if (success && validation.valid) {
    passed++;
  } else {
    failed++;
  }

  console.log(`\nTest ${index + 1}: ${status} ${icon}`);
  console.log(`  Input:      "${test.input}"`);
  console.log(`  Sanitized:  "${sanitized}"`);
  console.log(`  Valid:      ${validation.valid ? 'Yes' : 'No'}`);
  
  if (!validation.valid) {
    console.log(`  Error:      ${validation.error}`);
  }
  
  if (typeof test.expected === 'string') {
    console.log(`  Expected:   "${test.expected}"`);
    console.log(`  Match:      ${success ? 'Yes' : 'No'}`);
  }
});

console.log('\n' + '='.repeat(70));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${testCases.length} tests\n`);

if (failed === 0) {
  console.log('🎉 All tests passed! The sanitization fix is working correctly.\n');
} else {
  console.log('⚠️  Some tests failed. Please review the sanitization logic.\n');
  process.exit(1);
}
