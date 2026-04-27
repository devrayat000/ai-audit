import * as cheerio from "cheerio";
import { makeCheck } from "./base";
import { parseSchemaFromHtml } from "./schema-markup";
import type { PageAnalyzer } from "./base";

function findDateInJson(node: unknown, key: string): string | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const r = findDateInJson(n, key);
      if (r) return r;
    }
    return null;
  }
  const obj = node as Record<string, unknown>;
  if (typeof obj[key] === "string") return obj[key] as string;
  for (const k of Object.keys(obj)) {
    if (typeof obj[k] === "object") {
      const r = findDateInJson(obj[k], key);
      if (r) return r;
    }
  }
  return null;
}

export const freshnessAnalyzer: PageAnalyzer = {
  key: "freshness",
  scope: "page",
  run(page) {
    const html = page.renderedHtml || page.rawHtml;
    const $ = cheerio.load(html);
    const parsed = parseSchemaFromHtml(html);
    let datePublished: string | null = null;
    let dateModified: string | null = null;
    for (const block of parsed.raw) {
      datePublished = datePublished ?? findDateInJson(block, "datePublished");
      dateModified = dateModified ?? findDateInJson(block, "dateModified");
    }
    const visibleDate = $("time[datetime]").attr("datetime") ?? "";
    let score = 0;
    if (datePublished) score += 2;
    if (dateModified) score += 2;
    if (visibleDate) score += 1;
    score = Math.min(score, 5);
    const status = score >= 3 ? "pass" : score >= 1 ? "warn" : "fail";
    return [
      makeCheck({
        analyzerKey: "freshness",
        category: "eeat",
        scope: "page",
        name: "Freshness Signals",
        shortDescription: "datePublished / dateModified",
        status,
        score,
        maxScore: 5,
        message:
          datePublished || dateModified
            ? `published=${datePublished ?? "—"}, modified=${dateModified ?? "—"}`
            : "No published or modified dates found.",
        evidence: { datePublished, dateModified, visibleDate },
        fixSuggestion:
          score === 5
            ? "Freshness signals present."
            : "Expose datePublished and dateModified in JSON-LD or in a visible <time datetime> element.",
        pageUrl: page.url,
      }),
    ];
  },
};
