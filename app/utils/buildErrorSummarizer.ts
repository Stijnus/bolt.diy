export interface BuildErrorSummary {
  summary: string;
  highlights: string; // concise lines suitable for a code block
  files?: Array<{
    file: string;
    errors: Array<{ line?: number; col?: number; code?: string; message: string }>;
  }>;
  hints?: string[]; // optional fix hints
}

// Extracts key error lines from build output and produces a short summary.
export function summarizeBuildOutput(raw: string | undefined): BuildErrorSummary {
  if (!raw) {
    return { summary: '', highlights: '' };
  }

  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Heuristic patterns for common build failures
  const patterns: Array<{ re: RegExp; label: string }> = [
    { re: /module not found|cannot find module/i, label: 'Module not found' },
    { re: /ts\d{4}/i, label: 'TypeScript error' },
    { re: /syntaxerror|syntax error/i, label: 'Syntax error' },
    { re: /referenceerror|is not defined/i, label: 'Reference error' },
    { re: /export .* was not found|does not contain an export/i, label: 'Incorrect export/import' },
    { re: /failed to compile|build failed|error/i, label: 'Generic build error' },
    { re: /vite|webpack|rollup/i, label: 'Bundler error' },
  ];

  // Select important lines and parse TypeScript error shape: path:line:col - error TSxxxx: message
  const important: string[] = [];
  const fileErrors = new Map<string, Array<{ line?: number; col?: number; code?: string; message: string }>>();

  const tsLineRe =
    /^(?<file>[\w\-./]+\.(?:tsx?|jsx|ts|js|css|scss|json)):(?<line>\d+)(?::(?<col>\d+))?\s+-\s+error\s+(?<code>TS\d{3,4})\s*:\s*(?<msg>.*)$/i;

  for (const l of lines) {
    const m = l.match(tsLineRe);

    if (m && m.groups) {
      important.push(l);

      const file = m.groups.file;

      const entry = {
        line: m.groups.line ? Number(m.groups.line) : undefined,
        col: m.groups.col ? Number(m.groups.col) : undefined,
        code: m.groups.code,
        message: m.groups.msg.trim(),
      };

      const arr = fileErrors.get(file) ?? [];
      arr.push(entry);
      fileErrors.set(file, arr);
      continue;
    }

    if (
      /(ERROR|Error|ERR!|Failed|SyntaxError|ReferenceError|TypeError)/.test(l) ||
      /(TS\d{3,4})/.test(l) ||
      /(\.tsx?|\.jsx?|\.vue|\.svelte|\.css|\.scss|\.json)(:\d+(:\d+)?)?/.test(l) ||
      /(module not found|cannot find module)/i.test(l)
    ) {
      important.push(l);
    }
  }

  // Deduplicate and cap
  const dedup = Array.from(new Set(important));
  const top = dedup.slice(0, 40); // concise but enough context

  // Count categories
  const counts = new Map<string, number>();

  for (const p of patterns) {
    const n = top.filter((l) => p.re.test(l)).length;

    if (n > 0) {
      counts.set(p.label, n);
    }
  }

  // Build summary sentence(s)
  const bullets: string[] = [];

  for (const [label, n] of counts) {
    bullets.push(`${label} (${n})`);
  }

  // Try to detect most likely culprit file
  const fileMatch = top
    .map((l) => l.match(/([\w\-./]+\.(tsx?|jsx?|css|scss|json))(?:\:(\d+)(?::(\d+))?)?/))
    .find((m) => !!m);

  const fileInfo = fileMatch ? fileMatch[1] + (fileMatch[2] ? `:${fileMatch[2]}` : '') : undefined;

  const summaryParts: string[] = [];

  if (bullets.length) {
    summaryParts.push(`Detected: ${bullets.join(', ')}.`);
  }

  if (fileInfo) {
    summaryParts.push(`First offending file: ${fileInfo}.`);
  }

  if (!summaryParts.length) {
    summaryParts.push('Build failed with errors (see highlights).');
  }

  // Generate fix hints for common TS codes
  const hints: string[] = [];
  const allCodes = top.join(' ');

  if (/TS6133/.test(allCodes)) {
    hints.push('Remove unused imports/vars (TS6133) or prefix with underscore.');
  }

  if (/TS2741/.test(allCodes)) {
    hints.push('Missing required prop (TS2741): provide required prop or make it optional in the component type.');
  }

  if (/TS2322/.test(allCodes)) {
    hints.push('Type mismatch (TS2322): coerce or change types (e.g., parse number from string).');
  }

  if (/TS2339/.test(allCodes) && /import\.meta\.env/.test(allCodes)) {
    hints.push(
      'Add Vite types for import.meta.env (add "types": ["vite/client"] to tsconfig or a env.d.ts with /// <reference types=\"vite/client\" />).',
    );
  }

  if (/module not found|cannot find module/i.test(allCodes)) {
    hints.push('Missing dependency or wrong import path: check package.json and file paths.');
  }

  const files = Array.from(fileErrors.entries()).map(([file, errors]) => ({ file, errors }));

  return {
    summary: summaryParts.join(' '),
    highlights: top.join('\n'),
    files: files.length ? files : undefined,
    hints: hints.length ? hints : undefined,
  };
}
