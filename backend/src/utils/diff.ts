export interface DiffChange {
  type: 'added' | 'removed' | 'context';
  lineNumber: number;
  content: string;
}

/**
 * Compute line-level diff between two prompt strings.
 * Returns a list of changes with context lines.
 */
export function computeDiff(original: string, revised: string): DiffChange[] {
  if (original === revised) return [];

  const originalLines = original.split('\n');
  const revisedLines = revised.split('\n');

  // Simple LCS-based diff
  const lcs = buildLCS(originalLines, revisedLines);
  const changes: DiffChange[] = [];

  let oi = 0;
  let ri = 0;
  let li = 0;

  while (oi < originalLines.length || ri < revisedLines.length) {
    if (li < lcs.length && oi < originalLines.length && ri < revisedLines.length && originalLines[oi] === lcs[li] && revisedLines[ri] === lcs[li]) {
      changes.push({ type: 'context', lineNumber: ri + 1, content: lcs[li] });
      oi++;
      ri++;
      li++;
    } else if (oi < originalLines.length && (li >= lcs.length || originalLines[oi] !== lcs[li])) {
      changes.push({ type: 'removed', lineNumber: oi + 1, content: originalLines[oi] });
      oi++;
    } else if (ri < revisedLines.length && (li >= lcs.length || revisedLines[ri] !== lcs[li])) {
      changes.push({ type: 'added', lineNumber: ri + 1, content: revisedLines[ri] });
      ri++;
    }
  }

  return changes;
}

function buildLCS(a: string[], b: string[]): string[] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const result: string[] = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return result;
}
