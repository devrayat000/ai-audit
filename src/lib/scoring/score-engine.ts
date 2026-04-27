import type { Category, CheckResult } from "../types";
import { CATEGORY_WEIGHTS } from "./weights";
import { gradeFromScore } from "./grade";

const ALL_CATEGORIES: Category[] = [
  "access",
  "structure",
  "content",
  "meta",
  "security",
  "performance",
  "eeat",
];

function categoryRatio(checks: CheckResult[], category: Category): { score: number; max: number; ratio: number } {
  const subset = checks.filter((c) => c.category === category && c.maxScore > 0);
  const score = subset.reduce((a, c) => a + c.score, 0);
  const max = subset.reduce((a, c) => a + c.maxScore, 0);
  return { score, max, ratio: max > 0 ? score / max : 1 };
}

export function categoryBreakdown(checks: CheckResult[]): Record<Category, { score: number; max: number }> {
  const out = {} as Record<Category, { score: number; max: number }>;
  for (const c of ALL_CATEGORIES) {
    const r = categoryRatio(checks, c);
    out[c] = { score: Math.round(r.ratio * 100), max: 100 };
  }
  return out;
}

export function weightedScore(checks: CheckResult[]): number {
  let total = 0;
  let weightUsed = 0;
  for (const cat of ALL_CATEGORIES) {
    const r = categoryRatio(checks, cat);
    if (r.max === 0) continue;
    const w = CATEGORY_WEIGHTS[cat];
    total += r.ratio * w;
    weightUsed += w;
  }
  if (weightUsed === 0) return 0;
  return Math.round((total / weightUsed) * 100);
}

export function scorePage(pageChecks: CheckResult[]): { score: number; grade: string } {
  const score = weightedScore(pageChecks);
  return { score, grade: gradeFromScore(score) };
}

export function scoreSite(siteChecks: CheckResult[], pageScores: number[]): { score: number; grade: string } {
  const siteRatio = weightedScore(siteChecks) / 100;
  const pageAvg = pageScores.length === 0 ? 0 : pageScores.reduce((a, b) => a + b, 0) / pageScores.length / 100;
  const combined = Math.round((0.6 * pageAvg + 0.4 * siteRatio) * 100);
  return { score: combined, grade: gradeFromScore(combined) };
}

export function pickTopRecommendations(allChecks: CheckResult[], n = 5): CheckResult[] {
  return [...allChecks]
    .filter((c) => c.status !== "pass" && c.maxScore > 0)
    .sort((a, b) => {
      const aGap = a.maxScore - a.score;
      const bGap = b.maxScore - b.score;
      return bGap - aGap;
    })
    .slice(0, n);
}
