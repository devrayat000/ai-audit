import type { CheckResult, Category, CheckStatus, PageData, SiteData } from "../types";

export interface PageAnalyzer {
  key: string;
  scope: "page";
  run(input: PageData): CheckResult[] | Promise<CheckResult[]>;
}

export interface SiteAnalyzer {
  key: string;
  scope: "site";
  run(input: SiteData): CheckResult[] | Promise<CheckResult[]>;
}

export type AnyAnalyzer = PageAnalyzer | SiteAnalyzer;

export function makeCheck(opts: {
  analyzerKey: string;
  category: Category;
  scope: "page" | "site";
  name: string;
  shortDescription: string;
  status: CheckStatus;
  score: number;
  maxScore: number;
  message: string;
  evidence?: Record<string, unknown>;
  fixSuggestion: string;
  llmFixAvailable?: boolean;
  pageUrl?: string;
}): CheckResult {
  return {
    analyzerKey: opts.analyzerKey,
    category: opts.category,
    scope: opts.scope,
    name: opts.name,
    shortDescription: opts.shortDescription,
    status: opts.status,
    score: Math.max(0, Math.min(opts.maxScore, opts.score)),
    maxScore: opts.maxScore,
    message: opts.message,
    evidence: opts.evidence ?? {},
    fixSuggestion: opts.fixSuggestion,
    llmFixAvailable: opts.llmFixAvailable ?? false,
    pageUrl: opts.pageUrl,
  };
}

export function statusFromRatio(ratio: number): CheckStatus {
  if (ratio >= 0.85) return "pass";
  if (ratio >= 0.5) return "warn";
  return "fail";
}
