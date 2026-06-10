import Anthropic from "@anthropic-ai/sdk";
import type { AuditReport, CheckResult } from "../types";
import type {
  GeoEnrichment,
  GuestReview,
  PublishedSite,
  RatingSummary,
  RestaurantData,
  SignatureDish,
  SocialLinks,
  WebFacts,
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

  const restaurantHints = [
    "",
    "USE web_search aggressively (up to 5 searches) to find EVERYTHING publicly known about this restaurant. The goal is to enrich the site so it can be discovered, cited, and trusted by AI search engines.",
    "",
    `Search across Google Maps, TripAdvisor, Tabelog, Yelp, OpenTable, MICHELIN Guide, The World's 50 Best, Asia's 50 Best, local press, and news outlets.`,
    "",
    "Suggested search queries (pick whichever fit; mix English + local language hints from the address):",
    `  - "${d.name}" ${cityLine || ""} reviews OR rating`,
    `  - "${d.name}" ${cityLine || ""} TripAdvisor`,
    `  - "${d.name}" ${cityLine || ""} signature dish OR best dish`,
    `  - "${d.name}" Michelin OR award OR "50 best"`,
    `  - "${d.name}" ${cityLine || ""} hours OR reservation OR menu`,
    `  - "${d.name}" history OR founder OR opened`,
    "",
    "Collect, where available:",
    "  - **Reviews** — real quotes from real platforms (Google, TripAdvisor, Tabelog, Yelp). NEVER invent.",
    "  - **Rating summary** — aggregate score + total review count + platforms.",
    "  - **Signature dishes** — what guests/press most often praise. Include short factual descriptions. Especially valuable when the scraped menu is empty or thin.",
    "  - **Practical web facts** — transit (nearest station + walk minutes), parking, payment methods, languages spoken by staff, dress code, accessibility (step-free? wheelchair? braille?), family/kid policy, pet policy, takeaway, delivery, reservation policy, dietary options (vegetarian/vegan/halal/gluten-free), best time to visit, Wi-Fi, average meal cost per person.",
    "  - **Atmosphere tags** — short adjectives describing the vibe (intimate, romantic, lively, formal, casual, family-friendly, date-night, business-lunch).",
    "  - **Discovered cuisine** — if the scrape didn't already capture it.",
    "  - **Discovered price range** — `$`, `$$`, `$$$`, `$$$$` if scrape missed it.",
    "  - **Discovered social handles** — Instagram, Facebook, X, YouTube, TikTok, LINE — only if missing from the scrape.",
    "",
    "Hard rules for these fields:",
    "  - Reviews MUST be real quotes you found. Never fabricate. If you cannot find usable reviews, return an empty reviews array.",
    "  - Signature dishes can include items not on the scraped menu IF they're consistently cited in reviews/press. Mark `why` with a citation cue (e.g. 'frequently cited on Google reviews', 'New York Times feature dish').",
    "  - Practical web facts must be sourced — only include what you actually found.",
    "  - For `discoveredSocial`, only fill keys that the scrape did NOT already capture.",
  ].join("\n");

  const generalHints = [
    "",
    "USE web_search to find:",
    "  - Recent press, customer reviews, awards.",
    "  - Practical info missing from the scrape (transit, payment methods, accessibility, languages).",
    "  - Discovered social handles, cuisine, price range.",
    "",
    "Reviews and press mentions MUST be real quotes. Never fabricate.",
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
    isRestaurant ? restaurantHints : generalHints,
  ].join("\n");
}

const SYSTEM = [
  "You are a GEO (Generative Engine Optimization) editor. Your job is to enrich a templated site so AI engines can read, summarize, and cite it accurately.",
  "",
  "Hard rules:",
  "- DO NOT invent facts. Use only what's in the scraped data, audit findings, and web_search results.",
  "- Keep all numbers, prices, addresses, phone numbers, emails, URLs byte-identical to the scrape.",
  "- Keep proper nouns (business name, dish names, place names) verbatim.",
  "- If you don't have enough info for a field, OMIT it (or use null / empty array). No filler. No '?' placeholders.",
  "- Reviews and press mentions MUST be real quotes from real platforms. NEVER fabricate.",
  "- Awards must include the official source (Michelin Guide, World's 50 Best, etc.) and year.",
  "- ALL OUTPUT MUST BE IN ENGLISH. No foreign-script characters anywhere. Translate or romanize any non-English term in the input or search results before quoting it. Romanize proper nouns when they appear in foreign script.",
  '- Output MUST be strictly valid RFC 8259 JSON. No trailing commas. No comments. No unquoted keys. Escape every literal " inside a string as \\". Never break a string across raw newlines — use \\n inside the string.',
  "",
  "Output a SINGLE JSON object with this exact shape (no markdown fences, no prose, no <thinking>):",
  "{",
  '  "summary": "one-paragraph AI-friendly summary (40-80 words)",',
  '  "about": "rewritten about copy (60-140 words), entity-rich, terse",',
  '  "faqs": [{"q": "question?", "a": "concise factual answer"}],',
  '  "ratingSummary": {"score": 4.6, "count": 480, "platforms": ["Google", "TripAdvisor"]} or null,',
  '  "reviews": [',
  '    {"name": "Sarah K.", "country": "United Kingdom", "flag": "🇬🇧", "rating": 5, "text": "...", "platform": "Google", "date": "March 2025", "sourceUrl": "https://..."}',
  "  ],",
  '  "webFacts": {',
  '    "transit": "3 min walk from Ginza Station Exit A2",',
  '    "parking": "No on-site parking. Paid parking 2 min walk.",',
  '    "paymentMethods": ["Visa", "Mastercard", "Amex", "Cash"],',
  '    "languagesSpoken": ["English", "Japanese"],',
  '    "dressCode": "Smart casual",',
  '    "accessibility": "Step-free entrance, wheelchair-accessible WC",',
  '    "familyFriendly": "Children 6+ welcome",',
  '    "petPolicy": "No pets",',
  '    "takeaway": "Available for selected items",',
  '    "delivery": "Not available",',
  '    "reservationPolicy": "Reservations required, book 2 weeks ahead",',
  '    "dietaryOptions": ["Vegetarian", "Gluten-free options"],',
  '    "bestTimeToVisit": "Weekday lunch is least busy",',
  '    "wifi": "Free Wi-Fi available",',
  '    "averageCost": "¥15,000-25,000 per person"',
  "  } or null  // include only keys you actually found",
  '  "signatureDishes": [',
  '    {"name": "Otoro Nigiri", "description": "Premium fatty tuna belly nigiri", "why": "Most-mentioned dish on Tabelog"}',
  "  ],",
  '  "atmosphereTags": ["intimate", "formal", "date-night"],',
  '  "discoveredCuisine": ["Japanese", "Omakase"] or null,',
  '  "discoveredPriceRange": "$$$$" or null,',
  '  "discoveredSocial": {"instagram": "https://...", "facebook": "https://..."} or null,',
  '  "hero": {"heading": "...", "sub": "..."},',
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

interface RawSignatureDish {
  name?: unknown;
  description?: unknown;
  why?: unknown;
}

interface RawWebFacts {
  transit?: unknown;
  parking?: unknown;
  paymentMethods?: unknown;
  languagesSpoken?: unknown;
  dressCode?: unknown;
  accessibility?: unknown;
  familyFriendly?: unknown;
  petPolicy?: unknown;
  takeaway?: unknown;
  delivery?: unknown;
  reservationPolicy?: unknown;
  dietaryOptions?: unknown;
  bestTimeToVisit?: unknown;
  wifi?: unknown;
  averageCost?: unknown;
}

interface RawSocial {
  instagram?: unknown;
  facebook?: unknown;
  twitter?: unknown;
  tiktok?: unknown;
  youtube?: unknown;
  line?: unknown;
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
  webFacts?: RawWebFacts | null;
  signatureDishes?: RawSignatureDish[];
  atmosphereTags?: unknown[];
  discoveredCuisine?: unknown[] | null;
  discoveredPriceRange?: unknown;
  discoveredSocial?: RawSocial | null;
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
  const n =
    typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  if (!Number.isFinite(n)) return undefined;
  if (n < min || n > max) return undefined;
  return n;
}

function safeStringArray(
  v: unknown,
  maxLen: number,
  maxItem: number,
): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v
    .map((x) => safeString(x, maxItem))
    .filter((x): x is string => !!x)
    .slice(0, maxLen);
  return out.length > 0 ? out : undefined;
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

function parseWebFacts(
  raw: RawWebFacts | null | undefined,
): WebFacts | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const wf: WebFacts = {
    transit: safeString(raw.transit, 200),
    parking: safeString(raw.parking, 200),
    paymentMethods: safeStringArray(raw.paymentMethods, 10, 40),
    languagesSpoken: safeStringArray(raw.languagesSpoken, 8, 30),
    dressCode: safeString(raw.dressCode, 80),
    accessibility: safeString(raw.accessibility, 200),
    familyFriendly: safeString(raw.familyFriendly, 120),
    petPolicy: safeString(raw.petPolicy, 80),
    takeaway: safeString(raw.takeaway, 120),
    delivery: safeString(raw.delivery, 120),
    reservationPolicy: safeString(raw.reservationPolicy, 200),
    dietaryOptions: safeStringArray(raw.dietaryOptions, 10, 40),
    bestTimeToVisit: safeString(raw.bestTimeToVisit, 200),
    wifi: safeString(raw.wifi, 80),
    averageCost: safeString(raw.averageCost, 80),
  };
  const hasAny = Object.values(wf).some((v) => v !== undefined);
  return hasAny ? wf : undefined;
}

function parseSignatureDishes(
  raw: RawSignatureDish[] | undefined,
): SignatureDish[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: SignatureDish[] = [];
  for (const r of raw) {
    const name = safeString(r.name, 100);
    if (!name) continue;
    out.push({
      name,
      description: safeString(r.description, 400),
      why: safeString(r.why, 200),
    });
  }
  return out.length > 0 ? out.slice(0, 8) : undefined;
}

function parseDiscoveredSocial(
  raw: RawSocial | null | undefined,
): Partial<SocialLinks> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: Partial<SocialLinks> = {
    instagram: safeString(raw.instagram, 400),
    facebook: safeString(raw.facebook, 400),
    twitter: safeString(raw.twitter, 400),
    tiktok: safeString(raw.tiktok, 400),
    youtube: safeString(raw.youtube, 400),
    line: safeString(raw.line, 400),
  };
  const hasAny = Object.values(out).some((v) => v !== undefined);
  return hasAny ? out : undefined;
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
      max_tokens: 6000,
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
      tools: [{ name: "web_search", type: "web_search_20260209", max_uses: 5 }],
      messages: [{ role: "user", content: prompt }],
    });

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
    const webFacts = parseWebFacts(parsed.webFacts ?? null);
    const signatureDishes = parseSignatureDishes(parsed.signatureDishes);
    const atmosphereTags = safeStringArray(parsed.atmosphereTags, 8, 24);
    const discoveredCuisine = safeStringArray(parsed.discoveredCuisine, 6, 40);
    const discoveredPriceRange = safeString(parsed.discoveredPriceRange, 8);
    const discoveredSocial = parseDiscoveredSocial(
      parsed.discoveredSocial ?? null,
    );

    const enrichment: GeoEnrichment = {
      summary: safeString(parsed.summary, 600),
      about: safeString(parsed.about, 1200),
      faqs,
      reviews,
      ratingSummary,
      webFacts,
      signatureDishes,
      atmosphereTags,
      discoveredCuisine,
      discoveredPriceRange,
      discoveredSocial,
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

    // Trace the result so the operator can see what web_search actually surfaced.
    const counts = {
      reviews: reviews?.length ?? 0,
      signatureDishes: signatureDishes?.length ?? 0,
      webFactKeys: webFacts
        ? Object.values(webFacts).filter((v) => v !== undefined).length
        : 0,
      atmosphereTags: atmosphereTags?.length ?? 0,
    };
    notes.push(`web_search enrichment counts: ${JSON.stringify(counts)}`);
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
 * data, and stash the whole thing in `site.geo` for the GEO file builders.
 *
 * Discovered fields (cuisine, priceRange, social) only override scraped data
 * where the scrape came up empty — we never overwrite ground truth.
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

  if (next.data.industry === "restaurant" || next.data.industry === "general") {
    const data = { ...next.data };

    if (enrichment.hero) {
      data.hero = {
        ...data.hero,
        heading: enrichment.hero.heading ?? data.hero.heading,
        sub: enrichment.hero.sub ?? data.hero.sub,
      };
    }

    if (data.industry === "restaurant") {
      const r = data as RestaurantData;
      // Discovered cuisine — only fill if scrape missed it.
      if (
        enrichment.discoveredCuisine?.length &&
        (!r.cuisine || r.cuisine.length === 0)
      ) {
        r.cuisine = enrichment.discoveredCuisine;
      }
      // Discovered price range — only fill if scrape missed it.
      if (enrichment.discoveredPriceRange && !r.priceRange) {
        r.priceRange = enrichment.discoveredPriceRange;
      }
      // Discovered social — fill each missing key.
      if (enrichment.discoveredSocial) {
        const social = { ...r.social };
        for (const [key, val] of Object.entries(enrichment.discoveredSocial)) {
          if (val && !social[key as keyof SocialLinks]) {
            social[key as keyof SocialLinks] = val;
          }
        }
        r.social = social;
      }
    }

    next.data = data;
  }
  return next;
}

export interface CustomQuestion {
  key: string;
  label: string;
  question: string;
  placeholder?: string;
  type: "text" | "tel" | "textarea" | "checkbox-group";
  options?: string[];
}

export async function generateQuestionsForMissingFields(
  site: PublishedSite
): Promise<CustomQuestion[]> {
  const claude = getClient();
  if (!claude) return [];

  const d = site.data;
  const isRestaurant = d.industry === "restaurant";

  const scrapedInfo = {
    name: d.name,
    description: d.description || null,
    about: d.about || null,
    phone: d.contact?.phone || null,
    street: d.contact?.street || null,
    city: d.contact?.city || null,
    hours: isRestaurant ? (d as RestaurantData).hours || null : null,
    cuisine: isRestaurant ? (d as RestaurantData).cuisine || null : null,
    highlights: d.highlights || null,
  };

  const prompt = `
Analyze the following scraped business details and identify which of the following essential fields are missing or empty:
- "street" (street address)
- "city" (city or region)
- "phone" (contact phone number)
- "description" (brief description of the business)
- "highlights" (what makes the business special/unique features)
${isRestaurant ? '- "hours" (opening hours or schedule)\n- "cuisine" (type of cuisine served)' : ""}

Here is the scraped data:
\`\`\`json
${JSON.stringify(scrapedInfo, null, 2)}
\`\`\`

Generate a JSON array of questions for ONLY the missing fields. Do not ask for fields that already have valid values.
Your output must be a valid JSON array of objects matching this TypeScript shape:
\`\`\`ts
interface CustomQuestion {
  key: "street" | "city" | "phone" | "description" | "hours" | "cuisine" | "highlights";
  label: string; // short input label, e.g. "Phone number", "Special cuisine"
  question: string; // friendly user-facing question, e.g. "What is your business phone number?"
  placeholder?: string; // friendly placeholder value example
  type: "text" | "tel" | "textarea" | "checkbox-group";
  options?: string[]; // only if type is "checkbox-group"
}
\`\`\`

Return ONLY the JSON array. Do not wrap in markdown code blocks or write any thinking/prose.
`;

  try {
    const res = await claude.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: "You are a helpful business onboarding assistant. Output ONLY a valid JSON array.",
      messages: [{ role: "user", content: prompt }],
    });

    const txt = res.content
      .map((c) => ("text" in c && typeof c.text === "string" ? c.text : ""))
      .join("\n")
      .trim();

    return parseJsonLenient(txt) as CustomQuestion[];
  } catch (e) {
    console.error("[ai-enrich] failed to generate questions:", e);
    return [];
  }
}

