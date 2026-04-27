import type { PageDiff } from "./types";

interface DiffLine { type: "added" | "removed" | "context"; line: string }

function lcs(a: string[], b: string[]): number[][] {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      if (a[i] === b[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  return dp;
}

function lineDiff(a: string[], b: string[]): DiffLine[] {
  const dp = lcs(a, b);
  const out: DiffLine[] = [];
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ type: "context", line: a[i] });
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: "removed", line: a[i] });
      i++;
    } else {
      out.push({ type: "added", line: b[j] });
      j++;
    }
  }
  while (i < a.length) { out.push({ type: "removed", line: a[i++] }); }
  while (j < b.length) { out.push({ type: "added", line: b[j++] }); }
  return out;
}

function normalize(html: string): string[] {
  return html
    .replace(/>\s+</g, ">\n<")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

export function diffPage(url: string, before: string, after: string, maxLines = 800): PageDiff {
  const a = normalize(before).slice(0, maxLines);
  const b = normalize(after).slice(0, maxLines);
  return { url, before: a.join("\n"), after: b.join("\n"), changes: lineDiff(a, b).slice(0, maxLines) };
}
