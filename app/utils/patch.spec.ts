import { describe, it, expect } from 'vitest';
import { applyUnifiedDiffBody, isUnifiedDiffBody } from './patch';

describe('patch utils', () => {
  it('detects unified diff body', () => {
    const diff = `@@ -1,2 +1,2 @@\n-hello\n+hi`;
    expect(isUnifiedDiffBody(diff)).toBe(true);
  });

  it('applies a simple add/remove hunk', () => {
    const original = ['hello', 'world'].join('\n');
    const diff = [
      '@@ -1,2 +1,2 @@',
      '-hello',
      '+hi',
      ' world',
    ].join('\n');

    const patched = applyUnifiedDiffBody(original, diff);
    expect(patched).toBe(['hi', 'world'].join('\n'));
  });

  it('applies multiple hunks', () => {
    const original = ['a', 'b', 'c', 'd', 'e'].join('\n');
    const diff = [
      '@@ -1,2 +1,2 @@',
      ' a',
      '-b',
      '+B',
      '@@ -4,2 +4,3 @@',
      ' d',
      '+D2',
      ' e',
    ].join('\n');

    const patched = applyUnifiedDiffBody(original, diff);
    expect(patched).toBe(['a', 'B', 'c', 'd', 'D2', 'e'].join('\n'));
  });

  it('fails on context mismatch', () => {
    const original = ['x', 'y'].join('\n');
    const diff = ['@@ -1,2 +1,2 @@', ' z', '-x', '+X'].join('\n');
    const patched = applyUnifiedDiffBody(original, diff);
    expect(patched).toBeNull();
  });
});

