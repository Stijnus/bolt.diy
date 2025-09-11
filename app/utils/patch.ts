import { createScopedLogger } from "~/utils/logger";

const logger = createScopedLogger("patch");

// Detects if a string looks like a unified diff BODY (without ---/+++ headers)
export function isUnifiedDiffBody(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trimStart();
  if (!trimmed.startsWith("@@")) return false;
  // Basic sanity: contains at least one hunk header and +/-/space lines
  return /@@\s*-\d+(?:,\d+)?\s*\+\d+(?:,\d+)?\s*@@/.test(text);
}

interface Hunk {
  aStart: number;
  aLen: number;
  bStart: number;
  bLen: number;
  lines: string[];
}

function parseHunks(diffBody: string): Hunk[] {
  const lines = diffBody.replace(/\r\n?/g, "\n").split("\n");
  const hunks: Hunk[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const m = line && line.match(/^@@\s*-(\d+)(?:,(\d+))?\s*\+(\d+)(?:,(\d+))?\s*@@/);
    if (!m) {
      // skip until a hunk header appears (ignore stray text)
      i++;
      continue;
    }
    const aStart = parseInt(m[1], 10);
    const aLen = m[2] ? parseInt(m[2], 10) : 1;
    const bStart = parseInt(m[3], 10);
    const bLen = m[4] ? parseInt(m[4], 10) : 1;
    i++;
    const hunkLines: string[] = [];
    while (i < lines.length && !/^@@\s*-\d+/.test(lines[i])) {
      const l = lines[i];
      if (l === "\\ No newline at end of file") {
        i++;
        continue;
      }
      // Only accept context/insert/delete lines
      if (l.startsWith(" ") || l.startsWith("+") || l.startsWith("-")) {
        hunkLines.push(l);
        i++;
        continue;
      }
      // any other line -> stop this hunk
      break;
    }
    hunks.push({ aStart, aLen, bStart, bLen, lines: hunkLines });
  }
  return hunks;
}

// Applies a headerless unified diff body to original content. Returns null on failure.
export function applyUnifiedDiffBody(original: string, diffBody: string): string | null {
  try {
    const origLines = original.replace(/\r\n?/g, "\n").split("\n");
    const result: string[] = [];
    const hunks = parseHunks(diffBody);

    let oldIdx = 0; // 0-based index into origLines

    for (const h of hunks) {
      const targetOldStart = Math.max(0, h.aStart - 1);
      // Copy unchanged lines before this hunk
      if (targetOldStart < oldIdx) {
        // overlapping or out of order hunks -> fail
        logger.warn("Patch apply failed: overlapping hunks");
        return null;
      }
      for (; oldIdx < targetOldStart; oldIdx++) {
        result.push(origLines[oldIdx] ?? "");
      }

      // Apply hunk
      for (const l of h.lines) {
        const prefix = l[0];
        const text = l.slice(1);
        if (prefix === " ") {
          // context line must match original
          const cur = origLines[oldIdx] ?? "";
          if (cur !== text) {
            logger.warn("Patch apply failed: context mismatch", { expected: text, got: cur });
            return null;
          }
          result.push(cur);
          oldIdx++;
        } else if (prefix === "-") {
          // deletion: advance oldIdx without adding
          oldIdx++;
        } else if (prefix === "+") {
          // insertion: add text
          result.push(text);
        } else {
          // invalid line in hunk
          logger.warn("Patch apply failed: invalid hunk line", { line: l });
          return null;
        }
      }
    }

    // Append remaining lines
    for (; oldIdx < origLines.length; oldIdx++) {
      result.push(origLines[oldIdx] ?? "");
    }

    return result.join("\n");
  } catch (e) {
    logger.error("Patch apply threw error", e as any);
    return null;
  }
}

