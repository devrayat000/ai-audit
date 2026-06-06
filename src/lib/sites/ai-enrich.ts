import Anthropic from "@anthropic-ai/sdk";
import type { AuditReport, CheckResult } from "../types";
import type {
  GeoEnrichment,
  GuestReview,
  PublishedSite,
  RatingSummary,
  RestaurantData,
} from "./types";
import { parseJsonLenient } from "./json-extract";

function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY ?? "";
  if (!apiKey) return null;
  try {
    return new Anthropic({ apiKey });
  } catch (e) {
    console.warn("[ai-enrich] Anthropic init failed:", e);
    return null;
  }
}

function relevantAuditFindings(report?: AuditReport): CheckResult[] {
  if (!report) return [];
  const all = [...report.siteChecks, ...report.pages.flatMap((p) => p.checks)];
  return all
    .filter((c) => c.status !== "pass")
    .sort((a, b) => b.maxScore - a.maxScore - (b.score - a.score))
    .slice(0, 12);
}

function compactSitePayload(site: PublishedSite): Record<string, unknown> {
  const d = site.data;
  if (d.industry === "restaurant") {
    const r = d as RestaurantData;
    return {
      industry: "restaurant",
      name: r.name,
      description: r.description,
      cuisine: r.cuisine,
      priceRange: r.priceRange,
      hero: r.hero,
      about: r.about,
      highlights: r.highlights,
      contact: r.contact,
      hours: r.hours,
      menuSampleItems: (r.menu?.sections ?? [])
        .flatMap((s) =>
          s.items.slice(0, 6).map((i) => ({ section: s.title, ...i })),
        )
        .slice(0, 24),
      social: r.social,
      sourceUrl: site.sourceUrl,
    };
  }
  return {
    industry: d.industry,
    name: d.name,
    description: d.description,
    hero: d.hero,
    about: d.about,
    highlights: d.highlights,
    contact: d.contact,
    sourceUrl: site.sourceUrl,
  };
}

function buildPrompt(site: PublishedSite, findings: CheckResult[]): string {
  const compact = compactSitePayload(site);
  const auditSummary = findings.map((c) => ({
    key: c.analyzerKey,
    category: c.category,
    status: c.status,
    message: c.message,
    fix: c.fixSuggestion,
  }));
  const d = site.data;
  const isRestaurant = d.industry === "restaurant";
  const cityLine = isRestaurant
    ? [
        (d as RestaurantData).contact.city,
        (d as RestaurantData).contact.region,
        (d as RestaurantData).contact.country,
      ]
        .filter(Boolean)
        .join(", ")
    : "";

  const searchHints = isRestaurant
    ? [
        "",
        "USE web_search to find:",
        `- Recent guest reviews of "${d.name}"${cityLine ? ` in ${cityLine}` : ""}`,
        `- Aggregate ratings on Google Maps, TripAdvisor, Tabelog, Yelp, OpenTable, or local platforms`,
        `- Signature dishes, awards, press coverage, accolades`,
        `- Any practical info missing from the scrape (transit access, dress code, kid-friendliness, payment methods)`,
        "",
        "Search queries to try (pick whichever fits the locale):",
        `  - "${d.name}" ${cityLine || ""} reviews`,
        `  - "${d.name}" ${cityLine || ""} TripAdvisor OR Google`,
        `  - "${d.name}" ${cityLine || ""} signature dish`,
        `  - "${d.name}" award OR michelin OR best`,
        "",
        "Reviews MUST be quoted from real search results — never invent them. If you cannot find at least 2 real reviews, return an empty reviews array.",
      ].join("\n")
    : [
        "",
        "USE web_search to find recent press, customer reviews, awards, and missing practical info about the business.",
        "Reviews MUST be quoted from real search results — never invent.",
      ].join("\n");

  return [
    "Scraped site data:",
    "```json",
    JSON.stringify(compact, null, 2),
    "```",
    "",
    "Top audit findings to address:",
    "```json",
    JSON.stringify(auditSummary, null, 2),
    "```",
    searchHints,
  ].join("\n");
}

const SYSTEM = [
  "You are a GEO (Generative Engine Optimization) editor. Your job is to enrich a templated site so AI engines can read, summarize, and cite it accurately.",
  "",
  "Hard rules:",
  "- DO NOT invent facts. Use only what's in the scraped data, audit findings, and web_search results.",
  "- Keep all numbers, prices, addresses, phone numbers, emails, URLs byte-identical to the scrape.",
  "- Keep proper nouns (business name, dish names, place names) verbatim.",
  "- If you don't have enough info to answer a FAQ, OMIT it. No filler.",
  "- For reviews, ONLY include real quotes you found via web_search. Cite the platform (Google, TripAdvisor, Tabelog, Yelp, etc.). Never write fictional reviews. If web_search returned no usable reviews, return an empty reviews array.",
  "- For the rating summary, only include scores aggregated from real platforms found via web_search.",
  "- ALL OUTPUT MUST BE IN ENGLISH. The audience is international tourists. No foreign-script characters anywhere in summary, about, faqs, hero, meta, reviews, or rating summary. Translate or romanize any non-English term in the input or search results before quoting it.",
  "",
  "Output a single JSON object with this exact shape (no markdown fences, no commentary, no <thinking>):",
  "{",
  '  "summary": "one-paragraph AI-friendly summary (40–80 words)",',
  '  "about": "rewritten about copy (60–140 words). entity-rich, terse",',
  '  "faqs": [{"q": "question?", "a": "concise factual answer"}],  // 4–7 entries',
  '  "ratingSummary": {"score": 4.6, "count": 480, "platforms": ["Google", "TripAdvisor"]} or null,',
  '  "reviews": [',
  '    {"name": "Sarah K.", "country": "United Kingdom", "flag": "🇬🇧", "rating": 5, "text": "...", "platform": "Google", "date": "March 2025", "sourceUrl": "https://..."}',
  '  ],  // 0–4 entries, real quotes only',
  '  "hero": {"heading": "...", "sub": "..."},  // optional, only if current heading is vague',
  '  "meta": {"title": "30-65 char SEO title", "description": "70-160 char meta description"}',
  "}",
].join("\n");

interface RawReview {
  name?: unknown;
  flag?: unknown;
  country?: unknown;
  rating?: unknown;
  text?: unknown;
  platform?: unknown;
  date?: unknown;
  sourceUrl?: unknown;
}

interface RawEnrichment {
  summary?: string;
  about?: string;
  faqs?: { q?: unknown; a?: unknown }[];
  ratingSummary?: {
    score?: unknown;
    count?: unknown;
    platforms?: unknown;
  } | null;
  reviews?: RawReview[];
  hero?: { heading?: unknown; sub?: unknown };
  meta?: { title?: unknown; description?: unknown };
}

function safeString(v: unknown, max = 600): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  if (!t) return undefined;
  return t.slice(0, max);
}

function safeNumber(v: unknown, min: number, max: number): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  if (!Number.isFinite(n)) return undefined;
  if (n < min || n > max) return undefined;
  return n;
}

function parseReviews(raw: RawReview[] | undefined): GuestReview[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: GuestReview[] = [];
  for (const r of raw) {
    const name = safeString(r.name, 80);
    const text = safeString(r.text, 600);
    const rating = safeNumber(r.rating, 1, 5);
    if (!name || !text || rating === undefined) continue;
    out.push({
      name,
      flag: safeString(r.flag, 8),
      country: safeString(r.country, 80),
      rating: Math.round(rating),
      text,
      platform: safeString(r.platform, 40),
      date: safeString(r.date, 40),
      sourceUrl: safeString(r.sourceUrl, 400),
    });
  }
  return out.slice(0, 6);
}

function parseRatingSummary(
  raw: RawEnrichment["ratingSummary"],
): RatingSummary | undefined {
  if (!raw) return undefined;
  const score = safeNumber(raw.score, 0, 5);
  const count = safeNumber(raw.count, 0, 1_000_000);
  if (score === undefined || count === undefined) return undefined;
  let platforms: string[] | undefined;
  if (Array.isArray(raw.platforms)) {
    platforms = raw.platforms
      .map((p) => safeString(p, 40))
      .filter((p): p is string => !!p)
      .slice(0, 8);
    if (platforms.length === 0) platforms = undefined;
  }
  return { score, count: Math.round(count), platforms };
}

interface WebSearchTool {
  type: string;
  name: string;
  max_uses?: number;
}

const WEB_SEARCH_TOOL: WebSearchTool = {
  name: "web_search",
  type: "web_search_20260209",
  max_uses: 5,
};

export async function enrichWithAudit(
  site: PublishedSite,
  report?: AuditReport,
): Promise<GeoEnrichment> {
  const claude = getClient();
  const findings = relevantAuditFindings(report);

  const notes: string[] = [];
  if (!claude) {
    notes.push(
      "ANTHROPIC_API_KEY not set or SDK init failed — skipped Claude enrichment.",
    );
    return { notes };
  }

  const prompt = buildPrompt(site, findings);
  try {
    const res = await claude.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 3200,
      system: [
        {
          type: "text",
          text: "You are a meticulous GEO editor. Output ONLY a single JSON object. No prose, no markdown fences.",
        },
        {
          type: "text",
          text: SYSTEM,
        },
      ],
      tools: [WEB_SEARCH_TOOL] as unknown as Parameters<
        typeof claude.messages.create
      >[0]["tools"],
      messages: [{ role: "user", content: prompt }],
    });

    // Collect text across multiple content blocks (web_search interleaves
    // tool_use, tool_result, and text blocks). Only `text` blocks contain
    // the model's final JSON; tool_result blocks contain raw search hits.
    const txt = res.content
      .map((c) => ("text" in c && typeof c.text === "string" ? c.text : ""))
      .join("\n")
      .trim();
    const parsed = parseJsonLenient(txt) as RawEnrichment;

    const faqs = Array.isArray(parsed.faqs)
      ? parsed.faqs
          .map((qa) => ({
            q: safeString(qa.q, 200),
            a: safeString(qa.a, 600),
          }))
          .filter((qa): qa is { q: string; a: string } => !!qa.q && !!qa.a)
          .slice(0, 8)
      : undefined;

    const reviews = parseReviews(parsed.reviews);
    const ratingSummary = parseRatingSummary(parsed.ratingSummary ?? null);

    const enrichment: GeoEnrichment = {
      summary: safeString(parsed.summary, 600),
      about: safeString(parsed.about, 1200),
      faqs,
      reviews: reviews && reviews.length > 0 ? reviews : undefined,
      ratingSummary,
      hero:
        parsed.hero && (parsed.hero.heading || parsed.hero.sub)
          ? {
              heading: safeString(parsed.hero.heading, 200),
              sub: safeString(parsed.hero.sub, 400),
            }
          : undefined,
      meta:
        parsed.meta && (parsed.meta.title || parsed.meta.description)
          ? {
              title: safeString(parsed.meta.title, 80),
              description: safeString(parsed.meta.description, 200),
            }
          : undefined,
      notes,
    };
    if (reviews && reviews.length > 0) {
      notes.push(`web_search returned ${reviews.length} review(s).`);
    } else {
      notes.push("web_search returned no usable reviews.");
    }
    return enrichment;
  } catch (e) {
    notes.push(
      `Enrichment failed: ${e instanceof Error ? e.message : String(e)}`,
    );
    return { notes };
  }
}

/**
 * Apply the enrichment back onto the PublishedSite: merge into meta, hero,
 * and stash the whole thing in `site.geo` for the GEO file builders.
 */
export function applyEnrichment(
  site: PublishedSite,
  enrichment: GeoEnrichment,
): PublishedSite {
  const next: PublishedSite = { ...site, geo: enrichment };

  if (enrichment.meta?.title) {
    next.meta = { ...next.meta, title: enrichment.meta.title };
  }
  if (enrichment.meta?.description) {
    next.meta = { ...next.meta, description: enrichment.meta.description };
  }

  if (enrichment.hero) {
    if (
      next.data.industry === "restaurant" ||
      next.data.industry === "general"
    ) {
      const data = { ...next.data };
      data.hero = {
        ...data.hero,
        heading: enrichment.hero.heading ?? data.hero.heading,
        sub: enrichment.hero.sub ?? data.hero.sub,
      };
      next.data = data;
    }
  }
  return next;
}
