import { crawlSite, type CrawlEvent } from "../lib/crawler";
import { SITE_ANALYZERS, PAGE_ANALYZERS } from "../lib/analyzers";
import {
  categoryBreakdown,
  pickTopRecommendations,
  scorePage,
  scoreSite,
} from "../lib/scoring/score-engine";
import { detectIndustry } from "../lib/crawler/industry-detector";
import * as cheerio from "cheerio";
import type {
  AuditReport,
  CheckResult,
  Industry,
  PageData,
  PageReport,
  SiteData,
} from "../lib/types";
import { shortId } from "../lib/utils/url";
import { getWritable } from "workflow";

export interface RunAuditInput {
  url: string;
  industry?: Industry;
  maxPages?: number;
  onProgress?: (e: CrawlEvent) => void;
}

export async function auditWorkflow(
  input: RunAuditInput,
): Promise<AuditReport> {
  "use workflow";

  const startedAt = new Date();

  const { siteData, pages, errors } = await crawlSiteStep(input);

  let industryConfidence = 1;
  if (!input.industry) {
    industryConfidence = await detectIndustryStep(siteData, pages);
  }

  const siteChecks = await runSiteAnalyzersStep(siteData, errors);
  const pageReports = await runPageAnalyzersStep(pages, errors);

  return compileReportStep({
    siteData,
    pages,
    errors,
    siteChecks,
    pageReports,
    industryConfidence,
    startedAt,
  });
}

async function crawlSiteStep(input: RunAuditInput) {
  "use step";
  const writable = getWritable<string>();
  const writer = writable.getWriter();

  const result = await crawlSite(input.url, {
    industry: input.industry,
    maxPages: input.maxPages ?? 15,
    onProgress: async (e) => {
      await writeStreamChunk(writer, e);
      input.onProgress?.(e);
    },
  });

  writer.releaseLock();
  return result;
}

async function detectIndustryStep(siteData: SiteData, pages: PageData[]) {
  "use step";
  const home = pages.find((p) => p.url === siteData.rootUrl) ?? pages[0];
  if (home) {
    const types = collectSchemaTypes(home.renderedHtml || home.rawHtml);
    const det = detectIndustry(home.renderedHtml || home.rawHtml, types);
    return det.confidence;
  }
  return 1;
}

async function runSiteAnalyzersStep(siteData: SiteData, errors: string[]) {
  "use step";
  const writable = getWritable<string>();
  const writer = writable.getWriter();

  const siteChecks: CheckResult[] = [];
  for (const a of SITE_ANALYZERS) {
    try {
      await writeStreamChunk(writer, {
        type: "site:analyzer:start",
        payload: { key: a.key },
      });
      const r = await a.run(siteData);
      siteChecks.push(...r);
    } catch (e) {
      errors.push(
        `site analyzer ${a.key}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
  writer.releaseLock();
  return siteChecks;
}

async function runPageAnalyzersStep(pages: PageData[], errors: string[]) {
  "use step";
  const writable = getWritable<string>();
  const writer = writable.getWriter();

  const pageReports: PageReport[] = [];
  for (const p of pages) {
    const checks: CheckResult[] = [];
    for (const a of PAGE_ANALYZERS) {
      try {
        await writeStreamChunk(writer, {
          type: "page:analyzer:start",
          payload: { url: p.url, key: a.key },
        });
        const r = await a.run(p);
        checks.push(...r);
      } catch (e) {
        errors.push(
          `${p.url} ${a.key}: ${e instanceof Error ? e.message : String(e)}`,
        );
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
  writer.releaseLock();
  return pageReports;
}

async function compileReportStep(opts: {
  siteData: SiteData;
  pages: PageData[];
  errors: string[];
  siteChecks: CheckResult[];
  pageReports: PageReport[];
  industryConfidence: number;
  startedAt: Date;
}) {
  "use step";
  const writable = getWritable<string>();
  const writer = writable.getWriter();
  const allChecks = [
    ...opts.siteChecks,
    ...opts.pageReports.flatMap((p) => p.checks),
  ];
  const overall = scoreSite(
    opts.siteChecks,
    opts.pageReports.map((p) => p.pageScore),
  );
  const breakdown = categoryBreakdown(allChecks);
  const top = pickTopRecommendations(allChecks, 6);

  const report: AuditReport = {
    id: shortId(),
    rootUrl: opts.siteData.rootUrl,
    domain: opts.siteData.domain,
    industry: opts.siteData.industry,
    industryConfidence: opts.industryConfidence,
    status: "completed",
    totalPages: opts.pages.length,
    pagesAnalyzed: opts.pageReports.length,
    overallScore: overall.score,
    grade: overall.grade,
    createdAt: opts.startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    siteChecks: opts.siteChecks,
    pages: opts.pageReports,
    categoryScores: breakdown,
    topRecommendations: top,
    errors: opts.errors,
  };
  await writeStreamChunk(writer, report);
  await writer.write("data: [DONE]\n\n");
  writer.releaseLock();
  return report;
}

async function writeStreamChunk<T>(
  writer: WritableStreamDefaultWriter<string>,
  payload: T,
): Promise<void> {
  await writer.write(`data: ${JSON.stringify(payload)}\n\n`);
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
  else if (Array.isArray(t))
    t.forEach((x) => typeof x === "string" && out.push(x));
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
