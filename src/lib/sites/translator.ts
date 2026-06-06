/**
 * Translate scraped site content into English for foreign tourists.
 *
 * Strategy: chunked translation. Big menus blow past output token limits
 * if we ask Claude to translate the entire PublishedSite in one call.
 * We split into:
 *   1. core fields (name, tagline, description, hero, about, highlights,
 *      contact city/region/country, gallery alts) — one call
 *   2. menu items — batched, ~12 items per call
 * Each call has its own bounded output budget, and a failure in one
 * batch does not nuke the whole translation.
 *
 * Hard rules in the prompt — same in every call:
 *   - Translate every natural-language string to English. NO foreign
 *     script may remain in the output.
 *   - Numbers, prices, dates, addresses (street + postal), emails, URLs,
 *     phone numbers, social handles: byte-identical.
 *   - Proper nouns / dish names: "English Translation (Romanized Original)"
 *     plus a 1-sentence English description.
 *   - Never invent facts.
 */
import Anthropic from "@anthropic-ai/sdk";
import type {
  MenuItem,
  MenuSection,
  PublishedSite,
  RestaurantData,
} from "./types";
import { parseJsonLenient } from "./json-extract";

const MODEL = "claude-opus-4-7";
const MENU_BATCH_SIZE = 12;

function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY ?? "";
  if (!apiKey) return null;
  try {
    return new Anthropic({ apiKey });
  } catch (e) {
    console.warn("[translator] Anthropic init failed:", e);
    return null;
  }
}

function hasForeignScript(s: string): boolean {
  return /[ঀ-৿ऀ-ॿ؀-ۿݐ-ݿ֐-׿฀-๿぀-ゟ゠-ヿ가-힯一-鿿Ѐ-ӿͰ-Ͽ]/.test(s);
}

const COMMON_RULES = `You translate scraped restaurant content into clean, idiomatic English for FOREIGN TOURISTS who cannot read the source language.

ABSOLUTE rules:
- Output ONLY a single JSON object. No prose, no markdown fences, no commentary.
- Output MUST be strictly valid RFC 8259 JSON. No trailing commas. No comments. No unquoted keys. Escape every literal " inside a string value as \\" and every newline as \\n. Never break a string across raw newlines.
- EVERY natural-language string MUST be in English. NO foreign-script characters (CJK / Cyrillic / Arabic / Thai / Hangul / Devanagari / Bengali / Greek / etc.) may appear in any output value. If you see them in input, you MUST translate or romanize them. This is non-negotiable.
- Dish names: "English Name (Romanized Original)". Examples: "Beef Pho (Phở Bò)", "Grilled Pork Belly (Samgyeopsal)", "Cold Buckwheat Noodles (Zaru Soba)". Use the standard romanization for the language (Hepburn for Japanese, Pinyin for Mandarin, Revised Romanization for Korean, Hanyu Pinyin for Chinese, etc.). If the dish has a widely-known English name (e.g. "Sushi"), keep the English name and omit the parenthetical.
- Every menu item MUST have an English "description" field — a 1-sentence factual description of what the dish is (key ingredients / cooking method / category). If the source had no description, write a short factual one. NEVER invent specific ingredients not implied by the source; if unsure, describe by category (e.g. "a traditional Korean rice porridge").
- Preserve byte-identical: numbers, prices, currencies, dates, street addresses, postal codes, emails, URLs, phone numbers, social handles.
- Keep arrays the same length and in the same order. Empty/null fields stay empty/null.
- Use natural, idiomatic English — not literal word-for-word translation.
- Already-English strings: return unchanged.`;

interface CorePayload {
  name: string;
  tagline?: string;
  description?: string;
  cuisine?: string[];
  hero: { heading?: string; sub?: string; ctaLabel?: string };
  about?: string;
  highlights?: string[];
  contact: { street?: string; city?: string; region?: string; country?: string };
  galleryAlts: string[];
}

function projectCore(site: PublishedSite): CorePayload {
  const d = site.data;
  const r = d as RestaurantData;
  return {
    name: d.name,
    tagline: d.tagline,
    description: d.description,
    cuisine: d.industry === "restaurant" ? r.cuisine : undefined,
    hero: {
      heading: d.hero.heading,
      sub: d.hero.sub,
      ctaLabel: d.hero.cta?.label,
    },
    about: d.about,
    highlights: d.highlights,
    contact: {
      street: d.contact.street,
      city: d.contact.city,
      region: d.contact.region,
      country: d.contact.country,
    },
    galleryAlts: d.gallery.map((g) => g.alt ?? ""),
  };
}

function applyCore(site: PublishedSite, t: CorePayload): PublishedSite {
  const next: PublishedSite = { ...site };
  const data = { ...next.data };

  data.name = t.name || data.name;
  data.tagline = t.tagline ?? data.tagline;
  data.description = t.description ?? data.description;
  data.hero = {
    ...data.hero,
    heading: t.hero.heading ?? data.hero.heading,
    sub: t.hero.sub ?? data.hero.sub,
    cta:
      data.hero.cta && t.hero.ctaLabel
        ? { ...data.hero.cta, label: t.hero.ctaLabel }
        : data.hero.cta,
  };
  data.about = t.about ?? data.about;
  data.highlights = t.highlights ?? data.highlights;
  data.contact = {
    ...data.contact,
    street: t.contact?.street ?? data.contact.street,
    city: t.contact?.city ?? data.contact.city,
    region: t.contact?.region ?? data.contact.region,
    country: t.contact?.country ?? data.contact.country,
  };
  if (
    data.gallery &&
    Array.isArray(t.galleryAlts) &&
    t.galleryAlts.length === data.gallery.length
  ) {
    data.gallery = data.gallery.map((g, i) => ({
      ...g,
      alt: t.galleryAlts[i] || g.alt,
    }));
  }
  if (data.industry === "restaurant" && t.cuisine) {
    data.cuisine = t.cuisine;
  }
  next.data = data;

  next.meta = {
    ...next.meta,
    title:
      (data.name || next.meta.title) +
      (next.industry === "restaurant" ? " — Menu, hours & reservations" : ""),
    description: t.description ?? next.meta.description,
  };
  return next;
}

async function callClaude(
  client: Anthropic,
  prompt: string,
  maxTokens: number,
): Promise<unknown> {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: COMMON_RULES,
    messages: [{ role: "user", content: prompt }],
  });
  const txt = res.content
    .map((c) => ("text" in c && typeof c.text === "string" ? c.text : ""))
    .join("")
    .trim();
  return parseJsonLenient(txt);
}

async function translateCore(
  client: Anthropic,
  site: PublishedSite,
  sourceLangHint: string,
): Promise<CorePayload | null> {
  const payload = projectCore(site);
  const userMsg = [
    sourceLangHint,
    "",
    "Translate this restaurant's CORE TEXT to English. Return the same JSON shape with English values.",
    "",
    "Input:",
    "```json",
    JSON.stringify(payload, null, 2),
    "```",
  ].join("\n");
  try {
    const parsed = (await callClaude(client, userMsg, 4096)) as CorePayload;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch (e) {
    console.warn("[translator] core call failed:", e);
    return null;
  }
}

interface MenuItemIn {
  name: string;
  description?: string;
  price?: string;
}
interface MenuItemOut {
  name: string;
  description?: string;
}

async function translateMenuBatch(
  client: Anthropic,
  sectionTitle: string,
  items: MenuItemIn[],
  sourceLangHint: string,
): Promise<MenuItemOut[] | null> {
  const userMsg = [
    sourceLangHint,
    "",
    `Translate this restaurant menu section to English. Section title: "${sectionTitle}".`,
    "",
    "For EACH item, return:",
    '- "name": "English Name (Romanized Original)" — or English name alone if widely known in English.',
    '- "description": one-sentence English description of what the dish IS. ALWAYS provide this, even if the source had none. NEVER leave it blank.',
    "",
    "Do NOT include prices — they stay byte-identical and we keep them on our side. Do NOT add new items.",
    "",
    "Input items (translate in the same order):",
    "```json",
    JSON.stringify(
      items.map((i) => ({ name: i.name, description: i.description })),
      null,
      2,
    ),
    "```",
    "",
    "Return JSON with this exact shape:",
    '{ "title": "translated section title", "items": [{"name": "...", "description": "..."}, ...] }',
  ].join("\n");
  try {
    const parsed = (await callClaude(client, userMsg, 4096)) as {
      title?: string;
      items?: MenuItemOut[];
    };
    if (!parsed || !Array.isArray(parsed.items)) return null;
    return parsed.items;
  } catch (e) {
    console.warn("[translator] menu batch failed:", e);
    return null;
  }
}

async function translateMenuSectionTitle(
  client: Anthropic,
  title: string,
  sourceLangHint: string,
): Promise<string | null> {
  if (!hasForeignScript(title)) return title;
  const userMsg = [
    sourceLangHint,
    "",
    `Translate this restaurant menu section title to English. Return: {"title": "..."}.`,
    "",
    `Input: ${JSON.stringify(title)}`,
  ].join("\n");
  try {
    const parsed = (await callClaude(client, userMsg, 256)) as {
      title?: string;
    };
    return parsed?.title ?? null;
  } catch (e) {
    console.warn("[translator] title call failed:", e);
    return null;
  }
}

async function translateMenu(
  client: Anthropic,
  sections: MenuSection[],
  sourceLangHint: string,
): Promise<MenuSection[]> {
  const out: MenuSection[] = [];
  for (const section of sections) {
    const translatedTitle =
      (await translateMenuSectionTitle(
        client,
        section.title,
        sourceLangHint,
      )) ?? section.title;

    const newItems: MenuItem[] = [];
    for (let i = 0; i < section.items.length; i += MENU_BATCH_SIZE) {
      const batch = section.items.slice(i, i + MENU_BATCH_SIZE);
      const tr = await translateMenuBatch(
        client,
        section.title,
        batch.map((it) => ({
          name: it.name,
          description: it.description,
          price: it.price,
        })),
        sourceLangHint,
      );
      if (!tr || tr.length !== batch.length) {
        // Partial failure — keep original for this batch so we don't lose
        // items, then continue to next batch.
        newItems.push(...batch);
        continue;
      }
      for (let j = 0; j < batch.length; j++) {
        const orig = batch[j];
        const t = tr[j];
        newItems.push({
          ...orig,
          name: t.name || orig.name,
          description: t.description ?? orig.description,
        });
      }
    }
    out.push({ title: translatedTitle, items: newItems });
  }
  return out;
}

export async function translateSiteToEnglish(
  site: PublishedSite,
): Promise<{ site: PublishedSite; notes: string[] }> {
  const notes: string[] = [];
  if (site.source?.isEnglish) {
    notes.push("Source detected as English — skipping translation.");
    return { site: { ...site, translated: true }, notes };
  }

  const client = getClient();
  if (!client) {
    notes.push(
      "ANTHROPIC_API_KEY missing or SDK init failed — translation skipped, source language preserved.",
    );
    return { site, notes };
  }

  const sourceLangHint = site.source?.language
    ? `Source language code: ${site.source.language} (script ${site.source.script}).`
    : "Source language: unknown — auto-detect.";

  // 1) Core fields.
  const core = await translateCore(client, site, sourceLangHint);
  let working = site;
  if (core) {
    working = applyCore(site, core);
    notes.push("Core fields translated.");
  } else {
    notes.push("Core translation failed — keeping original core text.");
  }

  // 2) Menu items, batched.
  if (
    working.data.industry === "restaurant" &&
    working.data.menu &&
    working.data.menu.sections.length > 0
  ) {
    const r = working.data as RestaurantData;
    const totalItems = r.menu!.sections.reduce(
      (a, s) => a + s.items.length,
      0,
    );
    try {
      const sections = await translateMenu(
        client,
        r.menu!.sections,
        sourceLangHint,
      );
      const data = { ...working.data, menu: { sections } };
      working = { ...working, data };
      notes.push(
        `Menu translated: ${sections.length} section(s), ${totalItems} item(s).`,
      );
    } catch (e) {
      notes.push(
        `Menu translation error: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  // 3) Sanity check — flag any remaining foreign script in output.
  const blob = JSON.stringify(working.data);
  if (hasForeignScript(blob)) {
    notes.push(
      "Warning: some foreign-script characters remain in the output (likely proper nouns we left verbatim).",
    );
  }

  working = {
    ...working,
    translated: true,
    updatedAt: new Date().toISOString(),
  };
  return { site: working, notes };
}
