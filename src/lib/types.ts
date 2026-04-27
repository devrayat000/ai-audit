export type CheckStatus = "pass" | "warn" | "fail";

export type Category =
  | "access"
  | "structure"
  | "content"
  | "meta"
  | "security"
  | "performance"
  | "eeat";

export type Industry =
  | "restaurant"
  | "travel"
  | "service"
  | "ecommerce"
  | "blog"
  | "general";

export interface CheckResult {
  analyzerKey: string;
  category: Category;
  scope: "page" | "site";
  name: string;
  shortDescription: string;
  status: CheckStatus;
  score: number;
  maxScore: number;
  message: string;
  evidence: Record<string, unknown>;
  fixSuggestion: string;
  llmFixAvailable: boolean;
  pageUrl?: string;
}

export interface PageData {
  url: string;
  statusCode: number;
  rawHtml: string;
  renderedHtml: string;
  renderedText: string;
  responseHeaders: Record<string, string>;
  loadTimeMs: number;
  industry: Industry;
}

export interface SiteData {
  rootUrl: string;
  domain: string;
  robotsTxt: string | null;
  robotsTxtStatus: number | null;
  sitemapUrls: string[];
  sitemapStatus: number | null;
  llmsTxt: string | null;
  llmsFullTxt: string | null;
  industry: Industry;
  homepageHeaders: Record<string, string>;
  redirectsHttps: boolean;
  canonicalHostMatch: boolean;
  certValid: boolean;
}

export interface PageReport {
  url: string;
  title: string;
  statusCode: number;
  pageScore: number;
  pageGrade: string;
  rawHtmlLength: number;
  renderedHtmlLength: number;
  jsDependencyRatio: number;
  checks: CheckResult[];
  rawHtmlPreview: string;
  renderedHtmlPreview: string;
}

export interface AuditReport {
  id: string;
  rootUrl: string;
  domain: string;
  industry: Industry;
  industryConfidence: number;
  status: "completed" | "failed";
  totalPages: number;
  pagesAnalyzed: number;
  overallScore: number;
  grade: string;
  createdAt: string;
  completedAt: string;
  siteChecks: CheckResult[];
  pages: PageReport[];
  categoryScores: Record<Category, { score: number; max: number }>;
  topRecommendations: CheckResult[];
  errors: string[];
}

export interface BaseAnalyzer<T = PageData | SiteData> {
  key: string;
  scope: "page" | "site";
  run(input: T): Promise<CheckResult[]> | CheckResult[];
}
