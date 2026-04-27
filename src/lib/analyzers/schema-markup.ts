import * as cheerio from "cheerio";
import { makeCheck } from "./base";
import type { PageAnalyzer } from "./base";
import type { Industry } from "../types";

const REQUIRED_BY_INDUSTRY: Record<Industry, string[]> = {
  restaurant: ["Restaurant", "PostalAddress", "OpeningHoursSpecification"],
  travel: ["TravelAgency", "TouristAttraction", "LodgingBusiness"],
  service: ["LocalBusiness", "Service", "Organization"],
  ecommerce: ["Product", "Offer", "Organization"],
  blog: ["Article", "BlogPosting", "Organization"],
  general: ["Organization", "WebSite"],
};

interface ParsedSchema {
  types: string[];
  jsonLdCount: number;
  microdataCount: number;
  rdfaCount: number;
  invalidJsonLdBlocks: number;
  raw: unknown[];
}

export function parseSchemaFromHtml(html: string): ParsedSchema {
  const $ = cheerio.load(html);
  const types: string[] = [];
  let jsonLdCount = 0;
  let invalidJsonLdBlocks = 0;
  const raw: unknown[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const txt = $(el).contents().text();
    try {
      const json = JSON.parse(txt);
      raw.push(json);
      jsonLdCount++;
      collectTypes(json, types);
    } catch {
      invalidJsonLdBlocks++;
    }
  });
  const microdataCount = $("[itemscope]").length;
  const rdfaCount = $("[typeof], [property]").length;
  return { types, jsonLdCount, microdataCount, rdfaCount, invalidJsonLdBlocks, raw };
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
  else if (Array.isArray(t)) t.forEach((x) => typeof x === "string" && out.push(x));
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v && typeof v === "object") collectTypes(v, out);
  }
}

export const schemaMarkupAnalyzer: PageAnalyzer = {
  key: "schema-markup",
  scope: "page",
  run(page) {
    const parsed = parseSchemaFromHtml(page.renderedHtml || page.rawHtml);
    const required = REQUIRED_BY_INDUSTRY[page.industry] ?? REQUIRED_BY_INDUSTRY.general;
    const has = (t: string) => parsed.types.some((p) => p.toLowerCase() === t.toLowerCase());
    const matched = required.filter(has).length;
    const ratio = required.length > 0 ? matched / required.length : 1;

    let score = 0;
    if (parsed.jsonLdCount > 0) score += 6;
    score += Math.round(ratio * 10);
    if (parsed.invalidJsonLdBlocks === 0 && parsed.jsonLdCount > 0) score += 2;
    if (has("BreadcrumbList")) score += 1;
    if (has("FAQPage")) score += 1;

    const status = score >= 17 ? "pass" : score >= 8 ? "warn" : "fail";

    const missing = required.filter((r) => !has(r));

    return [
      makeCheck({
        analyzerKey: "schema-markup",
        category: "meta",
        scope: "page",
        name: "Schema Markup",
        shortDescription: "Structured data for AI engines",
        status,
        score,
        maxScore: 20,
        message:
          parsed.jsonLdCount === 0
            ? "No JSON-LD structured data found."
            : `${parsed.jsonLdCount} JSON-LD blocks. Missing for ${page.industry}: ${missing.length === 0 ? "none" : missing.join(", ")}.${parsed.invalidJsonLdBlocks > 0 ? ` ${parsed.invalidJsonLdBlocks} invalid block(s).` : ""}`,
        evidence: {
          types: parsed.types,
          required,
          missing,
          jsonLdCount: parsed.jsonLdCount,
          invalidJsonLdBlocks: parsed.invalidJsonLdBlocks,
          microdataCount: parsed.microdataCount,
          rdfaCount: parsed.rdfaCount,
        },
        fixSuggestion:
          missing.length > 0
            ? `Add JSON-LD blocks for: ${missing.join(", ")}. Use the suggested template (click "Generate fix").`
            : "Schema looks complete. Validate at search.google.com/test/rich-results.",
        llmFixAvailable: missing.length > 0,
        pageUrl: page.url,
      }),
    ];
  },
};
