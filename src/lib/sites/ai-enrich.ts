import Anthropic from "@anthropic-ai/sdk";
import type { AuditReport, CheckResult } from "../types";
import type { GeoEnrichment, PublishedSite, RestaurantData } from "./types";

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
  const all = [
    ...report.siteChecks,
    ...report.pages.flatMap((p) => p.checks),
  ];
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
        .flatMap((s) => s.items.slice(0, 6).map((i) => ({ section: s.title, ...i })))
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
  return [
    "You are a GEO (Generative Engine Optimization) editor. Your job is to enrich a templated site so AI engines can read, summarize, and cite it accurately.",
    "",
    "Hard rules:",
    "- DO NOT invent facts. Use only what's in the scraped data and audit findings.",
    "- Keep all numbers, prices, addresses, phone numbers, emails, URLs byte-identical.",
    "- Keep proper nouns (business name, dish names, place names) verbatim.",
    "- If you don't have enough info to answer a FAQ, OMIT it. No filler.",
    "- ALL OUTPUT MUST BE IN ENGLISH. The audience is international tourists. No foreign-script characters anywhere in summary, about, faqs, hero, or meta. Translate or romanize any non-English term in the input before quoting it.",
    "",
    "Output a single JSON object with this shape (no markdown fences, no commentary):",
    "{",
    '  "summary": "one-paragraph AI-friendly summary (40–80 words)",',
    '  "about": "rewritten about copy (60–140 words). entity-rich, terse",',
    '  "faqs": [{"q": "question?", "a": "concise factual answer"}],  // 4–7 entries',
    '  "hero": {"heading": "...", "sub": "..."},  // optional, only if current heading is vague',
    '  "meta": {"title": "30-65 char SEO title", "description": "70-160 char meta description"}',
    "}",
    "",
    "Scraped site data:",
    "```json",
    JSON.stringify(compact, null, 2),
    "```",
    "",
    "Top audit findings to address:",
    "```json",
    JSON.stringify(auditSummary, null, 2),
    "```",
  ].join("\n");
}

interface RawEnrichment {
  summary?: string;
  about?: string;
  faqs?: { q?: unknown; a?: unknown }[];
  hero?: { heading?: unknown; sub?: unknown };
  meta?: { title?: unknown; description?: unknown };
}

function safeString(v: unknown, max = 600): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  if (!t) return undefined;
  return t.slice(0, max);
}

function extractJsonObject(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0 || end <= start) return "{}";
  return text.slice(start, end + 1);
}

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
      max_tokens: 1600,
      system:
        "You are a meticulous GEO editor. Output ONLY a single JSON object. No prose, no markdown fences.",
      messages: [{ role: "user", content: prompt }],
    });
    const txt = res.content
      .map((c) => ("text" in c && typeof c.text === "string" ? c.text : ""))
      .join("")
      .trim();
    const json = extractJsonObject(txt);
    const parsed = JSON.parse(json) as RawEnrichment;

    const faqs = Array.isArray(parsed.faqs)
      ? parsed.faqs
          .map((qa) => ({
            q: safeString(qa.q, 200),
            a: safeString(qa.a, 600),
          }))
          .filter((qa): qa is { q: string; a: string } => !!qa.q && !!qa.a)
          .slice(0, 8)
      : undefined;

    const enrichment: GeoEnrichment = {
      summary: safeString(parsed.summary, 600),
      about: safeString(parsed.about, 1200),
      faqs,
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
    return enrichment;
  } catch (e) {
    notes.push(`Enrichment failed: ${e instanceof Error ? e.message : String(e)}`);
    return { notes };
  }
}

/**
 * Apply the enrichment back onto the PublishedSite: merge into meta, hero,
 * and stash the whole thing in `site.geo` for the GEO file builders.
 */
export function applyEnrichment(site: PublishedSite, enrichment: GeoEnrichment): PublishedSite {
  const next: PublishedSite = { ...site, geo: enrichment };

  if (enrichment.meta?.title) {
    next.meta = { ...next.meta, title: enrichment.meta.title };
  }
  if (enrichment.meta?.description) {
    next.meta = { ...next.meta, description: enrichment.meta.description };
  }

  if (enrichment.hero) {
    if (next.data.industry === "restaurant" || next.data.industry === "general") {
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
