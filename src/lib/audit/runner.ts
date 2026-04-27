import { crawlSite, type CrawlEvent } from "../crawler";
import { SITE_ANALYZERS, PAGE_ANALYZERS } from "../analyzers";
import { categoryBreakdown, pickTopRecommendations, scorePage, scoreSite } from "../scoring/score-engine";
import { detectIndustry } from "../crawler/industry-detector";
import * as cheerio from "cheerio";
import type { AuditReport, CheckResult, Industry, PageReport, SiteData } from "../types";
import { shortId } from "../utils/url";

export interface RunAuditInput {
  url: string;
  industry?: Industry;
  maxPages?: number;
  onProgress?: (e: CrawlEvent) => void;
}

export async function runAudit(input: RunAuditInput): Promise<AuditReport> {
  const startedAt = new Date();
  const { siteData, pages, errors } = await crawlSite(input.url, {
    industry: input.industry,
    maxPages: input.maxPages ?? 15,
    onProgress: input.onProgress,
  });

  // industry confidence (recompute when not forced)
  let industryConfidence = 1;
  if (!input.industry) {
    const home = pages.find((p) => p.url === siteData.rootUrl) ?? pages[0];
    if (home) {
      const types = collectSchemaTypes(home.renderedHtml || home.rawHtml);
      const det = detectIndustry(home.renderedHtml || home.rawHtml, types);
      industryConfidence = det.confidence;
    }
  }

  // run site analyzers
  const siteChecks: CheckResult[] = [];
  for (const a of SITE_ANALYZERS) {
    try {
      const r = await a.run(siteData);
      siteChecks.push(...r);
    } catch (e) {
      errors.push(`site analyzer ${a.key}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // run page analyzers per page
  const pageReports: PageReport[] = [];
  for (const p of pages) {
    const checks: CheckResult[] = [];
    for (const a of PAGE_ANALYZERS) {
      try {
        const r = await a.run(p);
        checks.push(...r);
      } catch (e) {
        errors.push(`${p.url} ${a.key}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    const ps = scorePage(checks);
    const $ = cheerio.load(p.renderedHtml || p.rawHtml);
    const title = $("title").first().text().trim() || p.url;
    const rawLen = stripText(p.rawHtml).length;
    const renderedLen = stripText(p.renderedHtml).length;
    const ratio = renderedLen > 0 ? rawLen / renderedLen : 1;
    pageReports.push({
      url: p.url,
      title,
      statusCode: p.statusCode,
      pageScore: ps.score,
      pageGrade: ps.grade,
      rawHtmlLength: p.rawHtml.length,
      renderedHtmlLength: p.renderedHtml.length,
      jsDependencyRatio: 1 - ratio,
      checks,
      rawHtmlPreview: p.rawHtml.slice(0, 4000),
      renderedHtmlPreview: p.renderedHtml.slice(0, 4000),
    });
  }

  const allChecks = [...siteChecks, ...pageReports.flatMap((p) => p.checks)];
  const overall = scoreSite(siteChecks, pageReports.map((p) => p.pageScore));
  const breakdown = categoryBreakdown(allChecks);
  const top = pickTopRecommendations(allChecks, 6);

  const report: AuditReport = {
    id: shortId(),
    rootUrl: siteData.rootUrl,
    domain: siteData.domain,
    industry: siteData.industry,
    industryConfidence,
    status: "completed",
    totalPages: pages.length,
    pagesAnalyzed: pageReports.length,
    overallScore: overall.score,
    grade: overall.grade,
    createdAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    siteChecks,
    pages: pageReports,
    categoryScores: breakdown,
    topRecommendations: top,
    errors,
  };

  return report;
}

function stripText(html: string): string {
  if (!html) return "";
  try {
    const $ = cheerio.load(html);
    $("script, style, noscript").remove();
    return $("body").text().replace(/\s+/g, " ").trim();
  } catch {
    return "";
  }
}

function collectSchemaTypes(html: string): string[] {
  if (!html) return [];
  try {
    const $ = cheerio.load(html);
    const types: string[] = [];
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).contents().text());
        walk(json, types);
      } catch {}
    });
    return types;
  } catch {
    return [];
  }
}
function walk(node: unknown, out: string[]) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) return node.forEach((n) => walk(n, out));
  const obj = node as Record<string, unknown>;
  const t = obj["@type"];
  if (typeof t === "string") out.push(t);
  else if (Array.isArray(t)) t.forEach((x) => typeof x === "string" && out.push(x));
  for (const k of Object.keys(obj)) walk(obj[k], out);
}

export function findSiteContext(report: AuditReport): SiteData {
  return {
    rootUrl: report.rootUrl,
    domain: report.domain,
    robotsTxt: null,
    robotsTxtStatus: null,
    sitemapUrls: [],
    sitemapStatus: null,
    llmsTxt: null,
    llmsFullTxt: null,
    industry: report.industry,
    homepageHeaders: {},
    redirectsHttps: false,
    canonicalHostMatch: false,
    certValid: false,
  };
}
