import type { AuditReport, Industry, PageData, SiteData } from "../types";

export type RegenStrategy = "static-surgery" | "next-project";

export type TranslationMode = "none" | "literal" | "transcreate" | "bilingual";

export type TextClassification =
  | "preserve"
  | "preserve-pn"
  | "literal"
  | "transcreate"
  | "flag-legal";

export interface DetectedLanguage {
  language: string;
  script: string;
  direction: "ltr" | "rtl";
  confidence: number;
  needsConfirmation: boolean;
}

export interface GlossaryEntry {
  source: string;
  handling: "preserve" | "transliterate" | "translate";
  target: string;
  origin: "auto" | "user";
}

export interface TranslationConfig {
  mode: TranslationMode;
  sourceLanguage: string;
  sourceScript: string;
  sourceDirection: "ltr" | "rtl";
  targetLanguage: string;
  targetDirection: "ltr" | "rtl";
  targetFontFamily?: string;
  glossary: GlossaryEntry[];
  industry: Industry;
}

export interface FixToggle {
  analyzerKey: string;
  enabled: boolean;
}

export interface RegenInput {
  rootUrl: string;
  industry: Industry;
  strategy: RegenStrategy;
  proof: string;
  fixes: FixToggle[];
  translation?: TranslationConfig;
  inlineAssets?: boolean;
  audit?: AuditReport;
  maxPages?: number;
}

export interface RegenFile {
  path: string;
  content: string | Uint8Array;
  encoding?: "utf8" | "binary";
}

export interface PageDiff {
  url: string;
  before: string;
  after: string;
  changes: { type: "added" | "removed" | "context"; line: string }[];
}

export interface TranslationWarning {
  pageUrl: string;
  selector: string;
  kind: "overflow" | "truncation" | "rtl-flip" | "legal-flag" | "preservation-fail";
  message: string;
}

export interface RegenResult {
  strategy: RegenStrategy;
  rootUrl: string;
  domain: string;
  files: RegenFile[];
  fixesApplied: string[];
  pageDiffs: PageDiff[];
  homepagePreview: string;
  translationWarnings: TranslationWarning[];
  totalSizeBytes: number;
  durationMs: number;
  zipBase64: string;
  notes: string[];
}

export interface RegenContext {
  site: SiteData;
  pages: PageData[];
  industry: Industry;
  fixes: Set<string>;
  translation?: TranslationConfig;
}
