import type { PageAnalyzer, SiteAnalyzer } from "./base";
import { aiBotAccessAnalyzer } from "./ai-bot-access";
import { llmsTxtAnalyzer } from "./llms-txt";
import { sitemapAnalyzer } from "./sitemap";
import { httpsSecurityAnalyzer } from "./https-security";
import { schemaMarkupAnalyzer } from "./schema-markup";
import { metaTagsAnalyzer } from "./meta-tags";
import { contentStructureAnalyzer } from "./content-structure";
import { semanticHtmlAnalyzer } from "./semantic-html";
import { imagesAltAnalyzer } from "./images-alt";
import { jsVsRawAnalyzer } from "./js-vs-raw";
import { languageAnalyzer } from "./language";
import { canonicalAnalyzer } from "./canonical";

export const SITE_ANALYZERS: SiteAnalyzer[] = [
  aiBotAccessAnalyzer,
  llmsTxtAnalyzer,
  sitemapAnalyzer,
  httpsSecurityAnalyzer,
];

export const PAGE_ANALYZERS: PageAnalyzer[] = [
  schemaMarkupAnalyzer,
  metaTagsAnalyzer,
  contentStructureAnalyzer,
  semanticHtmlAnalyzer,
  imagesAltAnalyzer,
  jsVsRawAnalyzer,
  languageAnalyzer,
  canonicalAnalyzer,
];

export const ALL_ANALYZER_KEYS = [
  ...SITE_ANALYZERS.map((a) => a.key),
  ...PAGE_ANALYZERS.map((a) => a.key),
];
