export interface BuildErrorSummary {
  summary: string;
  highlights: string; // concise lines suitable for a code block
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

  // Select important lines
  const important: string[] = [];

  for (const l of lines) {
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

  return {
    summary: summaryParts.join(' '),
    highlights: top.join('\n'),
  };
}
