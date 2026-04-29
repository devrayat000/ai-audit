import * as cheerio from "cheerio";
import { fetchText } from "../utils/http";
import { fetchRaw } from "./raw-fetcher";
import { renderPage, closeBrowser } from "./playwright-fetcher";
import { discoverSitemapUrls, extractInternalLinks } from "./url-discovery";
import { detectIndustry } from "./industry-detector";
import { isHtmlUrl, normalizeUrl, sameDomain } from "../utils/url";
import type { Industry, PageData, SiteData } from "../types";

export interface CrawlOptions {
  maxPages?: number;
  maxDepth?: number;
  /** max number of pages to fetch/render concurrently */
  maxConcurrency?: number;
  industry?: Industry;
  /** capture a viewport screenshot for the homepage (used by the regenerator preview) */
  screenshotHomepage?: boolean;
  onProgress?: (event: CrawlEvent) => void;
}

export type CrawlEvent =
  | { type: "site:start"; rootUrl: string }
  | { type: "site:robots"; ok: boolean }
  | { type: "site:sitemap"; count: number }
  | { type: "page:start"; url: string; index: number; total: number }
  | { type: "page:done"; url: string; statusCode: number }
  | { type: "page:error"; url: string; error: string }
  | { type: "site:done"; pages: number }
  | { type: "site:analyzer:start"; payload: { key: string } }
  | { type: "page:analyzer:start"; payload: { url: string; key: string } };

interface CrawlOutcome {
  siteData: SiteData;
  pages: PageData[];
  errors: string[];
  /** base64 JPEG of the homepage's rendered viewport, if requested */
  homepageScreenshot?: string;
}

export async function crawlSite(
  inputUrl: string,
  opts: CrawlOptions = {},
): Promise<CrawlOutcome> {
  const {
    maxPages = 25,
    maxDepth = 3,
    maxConcurrency = 4,
    industry: forcedIndustry,
    screenshotHomepage,
    onProgress,
  } = opts;
  const errors: string[] = [];
  const rootUrl = normalizeUrl(inputUrl);
  onProgress?.({ type: "site:start", rootUrl });

  const u = new URL(rootUrl);
  const origin = u.origin;
  const domain = u.hostname;

  const homepagePromise = fetchText(rootUrl);
  const robotsPromise = fetchText(`${origin}/robots.txt`);
  const llmsPromise = fetchText(`${origin}/llms.txt`);
  const llmsFullPromise = fetchText(`${origin}/llms-full.txt`);
  const httpPromise = fetchText(rootUrl.replace(/^https:/, "http:"), {
    timeoutMs: 8000,
  });

  const [homepage, robotsRes, llmsRes, llmsFullRes, httpRes] =
    await Promise.all([
      homepagePromise,
      robotsPromise,
      llmsPromise,
      llmsFullPromise,
      httpPromise,
    ]);
  if (!homepage.ok && homepage.status === 0) {
    errors.push(`Homepage fetch failed: ${homepage.error ?? "unknown"}`);
  }
  const robotsTxt = robotsRes.ok ? robotsRes.body : null;
  onProgress?.({ type: "site:robots", ok: !!robotsTxt });
  const llmsTxt = llmsRes.ok ? llmsRes.body : null;
  const llmsFullTxt = llmsFullRes.ok ? llmsFullRes.body : null;

  const sm = await discoverSitemapUrls(rootUrl, robotsTxt);
  onProgress?.({ type: "site:sitemap", count: sm.urls.length });

  // canonical: did http→https redirect & www match
  const redirectsHttps =
    httpRes.finalUrl.startsWith("https://") || httpRes.status === 0;

  const canonicalHostMatch = (() => {
    try {
      return sameDomain(homepage.finalUrl, rootUrl);
    } catch {
      return true;
    }
  })();

  const certValid = rootUrl.startsWith("https://") && homepage.status > 0;

  // collect schema types from homepage for industry detection
  const homeSchemaTypes = extractSchemaTypes(homepage.body);
  const detected = forcedIndustry
    ? { industry: forcedIndustry, confidence: 1 }
    : detectIndustry(homepage.body, homeSchemaTypes);

  const siteData: SiteData = {
    rootUrl,
    domain,
    robotsTxt,
    robotsTxtStatus: robotsRes.status || null,
    sitemapUrls: sm.urls,
    sitemapStatus: sm.status,
    llmsTxt,
    llmsFullTxt,
    industry: detected.industry,
    homepageHeaders: homepage.headers,
    redirectsHttps,
    canonicalHostMatch,
    certValid,
  };

  // build queue: homepage + sitemap urls + bfs
  const queue: { url: string; depth: number }[] = [];
  const visited = new Set<string>();
  queue.push({ url: rootUrl, depth: 0 });
  for (const su of sm.urls.slice(0, maxPages)) {
    if (sameDomain(su, rootUrl) && isHtmlUrl(su)) {
      queue.push({ url: su, depth: 1 });
    }
  }

  const pages: PageData[] = [];
  let idx = 0;
  let homepageScreenshot: string | undefined;

  const concurrency = Math.max(1, Math.min(maxConcurrency, maxPages));
  const worker = async () => {
    while (queue.length > 0 && pages.length < maxPages) {
      const next = queue.shift();
      if (!next) return;
      const { url, depth } = next;
      if (visited.has(url)) continue;
      visited.add(url);
      if (depth > maxDepth) continue;
      if (!isHtmlUrl(url) || !sameDomain(url, rootUrl)) continue;

      idx++;
      onProgress?.({ type: "page:start", url, index: idx, total: maxPages });

      try {
        const raw = await fetchRaw(url);
        const wantShot = !!screenshotHomepage && url === rootUrl;
        const rendered = await renderPage(url, { screenshot: wantShot });
        if (rendered.screenshotBase64 && !homepageScreenshot) {
          homepageScreenshot = rendered.screenshotBase64;
        }
        const statusCode = rendered.status || raw.status;

        const html = rendered.renderedHtml || raw.body;
        const text =
          rendered.renderedText ||
          cheerio.load(raw.body).root().text().replace(/\s+/g, " ").trim();

        if (pages.length < maxPages) {
          const pageData: PageData = {
            url,
            statusCode,
            rawHtml: raw.body,
            renderedHtml: html,
            renderedText: text,
            responseHeaders: { ...raw.headers, ...rendered.responseHeaders },
            loadTimeMs: rendered.loadTimeMs || raw.durationMs,
            industry: siteData.industry,
          };
          pages.push(pageData);
        }
        onProgress?.({ type: "page:done", url, statusCode });

        // discover more links
        if (depth < maxDepth && pages.length < maxPages) {
          const found = extractInternalLinks(rendered.links, rootUrl);
          for (const f of found) {
            if (!visited.has(f) && pages.length + queue.length < maxPages * 2) {
              queue.push({ url: f, depth: depth + 1 });
            }
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`${url}: ${msg}`);
        onProgress?.({ type: "page:error", url, error: msg });
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  await closeBrowser().catch(() => {});
  onProgress?.({ type: "site:done", pages: pages.length });

  return { siteData, pages, errors, homepageScreenshot };
}

function extractSchemaTypes(html: string): string[] {
  if (!html) return [];
  try {
    const $ = cheerio.load(html);
    const types: string[] = [];
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).contents().text());
        collectTypes(json, types);
      } catch {}
    });
    return types;
  } catch {
    return [];
  }
}

function collectTypes(node: unknown, out: string[]) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    node.forEach((n) => collectTypes(n, out));
    return;
  }
  const obj = node as Record<string, unknown>;
  const t = obj["@type"];
  if (typeof t === "string") out.push(t);
  else if (Array.isArray(t))
    t.forEach((x) => typeof x === "string" && out.push(x));
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v && typeof v === "object") collectTypes(v, out);
  }
}
