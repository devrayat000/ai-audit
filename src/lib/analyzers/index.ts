import type { PageAnalyzer, SiteAnalyzer } from "./base";
import { aiBotAccessAnalyzer } from "./ai-bot-access";
import { llmsTxtAnalyzer } from "./llms-txt";
import { sitemapAnalyzer } from "./sitemap";
import { httpsSecurityAnalyzer } from "./https-security";
import { canonicalDomainAnalyzer } from "./canonical-domain";
import { schemaMarkupAnalyzer } from "./schema-markup";
import { metaTagsAnalyzer } from "./meta-tags";
import { contentStructureAnalyzer } from "./content-structure";
import { readabilityAnalyzer } from "./readability";
import { semanticHtmlAnalyzer } from "./semantic-html";
import { eeatAnalyzer } from "./eeat";
import { imagesAltAnalyzer } from "./images-alt";
import { jsVsRawAnalyzer } from "./js-vs-raw";
import { internalLinkingAnalyzer } from "./internal-linking";
import { mobileAnalyzer } from "./mobile";
import { languageAnalyzer } from "./language";
import { canonicalAnalyzer } from "./canonical";
import { performanceAnalyzer } from "./performance";
import { freshnessAnalyzer } from "./freshness";
import { aiContentPatternsAnalyzer } from "./ai-content-patterns";

export const SITE_ANALYZERS: SiteAnalyzer[] = [
  aiBotAccessAnalyzer,
  llmsTxtAnalyzer,
  sitemapAnalyzer,
  httpsSecurityAnalyzer,
  canonicalDomainAnalyzer,
];

export const PAGE_ANALYZERS: PageAnalyzer[] = [
  schemaMarkupAnalyzer,
  metaTagsAnalyzer,
  contentStructureAnalyzer,
  readabilityAnalyzer,
  semanticHtmlAnalyzer,
  eeatAnalyzer,
  imagesAltAnalyzer,
  jsVsRawAnalyzer,
  internalLinkingAnalyzer,
  mobileAnalyzer,
  languageAnalyzer,
  canonicalAnalyzer,
  performanceAnalyzer,
  freshnessAnalyzer,
  aiContentPatternsAnalyzer,
];

export const ALL_ANALYZER_KEYS = [
  ...SITE_ANALYZERS.map((a) => a.key),
  ...PAGE_ANALYZERS.map((a) => a.key),
];
