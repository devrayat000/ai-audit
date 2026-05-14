/**
 * Translate the scraped site's user-facing strings into English.
 *
 * Strategy: instead of walking every node and batching, we send the
 * structured PublishedSite JSON to Claude and ask for the same shape back
 * with English string values. This is one API call per publish (~tokens
 * proportional to the site's text content).
 *
 * Hard rules in the prompt:
 *   - Translate text fields only. Keep all keys / shape identical.
 *   - Preserve numbers, prices, dates, addresses, emails, URLs, phone
 *     numbers byte-identical.
 *   - Keep proper nouns verbatim (business name, dish names, place names)
 *     unless they have an unambiguous English form already in common use.
 *   - Never invent facts not in the source.
 *
 * If Claude is unavailable, we no-op and return the site unchanged.
 */
import type { PublishedSite, RestaurantData } from "./types";

interface ClaudeClient {
  messages: {
    create(args: {
      model: string;
      max_tokens: number;
      system: string;
      messages: { role: "user"; content: string }[];
    }): Promise<{ content: Array<{ type: string; text?: string }> }>;
  };
}

async function loadAnthropic(apiKey: string): Promise<ClaudeClient | null> {
  if (!apiKey) return null;
  try {
    const moduleName = "@anthropic-ai/sdk";
    const mod = (await import(/* webpackIgnore: true */ moduleName)) as {
      default?: { new (cfg: { apiKey: string }): ClaudeClient };
    } & { new (cfg: { apiKey: string }): ClaudeClient };
    const Ctor =
      mod.default ??
      (mod as unknown as { new (cfg: { apiKey: string }): ClaudeClient });
    return new Ctor({ apiKey });
  } catch {
    return null;
  }
}

/**
 * Compact subset of PublishedSite that's safe to send to Claude — only the
 * fields that contain natural-language text. Pass through structure 1:1.
 */
interface TranslatablePayload {
  name: string;
  tagline?: string;
  description?: string;
  cuisine?: string[];
  hero: {
    heading?: string;
    sub?: string;
    ctaLabel?: string;
  };
  about?: string;
  highlights?: string[];
  menuSections?: Array<{
    title: string;
    items: Array<{ name: string; description?: string }>;
  }>;
  contact?: {
    street?: string;
    city?: string;
    region?: string;
    country?: string;
  };
  galleryAlts: string[];
}

function projectToTranslatable(site: PublishedSite): TranslatablePayload {
  const d = site.data;
  if (d.industry === "restaurant") {
    const r = d as RestaurantData;
    return {
      name: r.name,
      tagline: r.tagline,
      description: r.description,
      cuisine: r.cuisine,
      hero: {
        heading: r.hero.heading,
        sub: r.hero.sub,
        ctaLabel: r.hero.cta?.label,
      },
      about: r.about,
      highlights: r.highlights,
      menuSections: r.menu?.sections.map((s) => ({
        title: s.title,
        items: s.items.map((it) => ({ name: it.name, description: it.description })),
      })),
      contact: {
        street: r.contact.street,
        city: r.contact.city,
        region: r.contact.region,
        country: r.contact.country,
      },
      galleryAlts: r.gallery.map((g) => g.alt ?? ""),
    };
  }
  // general fallback
  return {
    name: d.name,
    tagline: d.tagline,
    description: d.description,
    hero: { heading: d.hero.heading, sub: d.hero.sub, ctaLabel: d.hero.cta?.label },
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

function applyTranslatable(site: PublishedSite, t: TranslatablePayload): PublishedSite {
  const next: PublishedSite = { ...site, translated: true, updatedAt: new Date().toISOString() };
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
  if (data.gallery && t.galleryAlts.length === data.gallery.length) {
    data.gallery = data.gallery.map((g, i) => ({
      ...g,
      alt: t.galleryAlts[i] || g.alt,
    }));
  }

  if (data.industry === "restaurant") {
    data.cuisine = t.cuisine ?? data.cuisine;
    if (data.menu && t.menuSections && t.menuSections.length === data.menu.sections.length) {
      data.menu = {
        sections: data.menu.sections.map((s, i) => {
          const ts = t.menuSections![i];
          if (!ts || ts.items.length !== s.items.length) return s;
          return {
            title: ts.title || s.title,
            items: s.items.map((item, j) => ({
              ...item,
              name: ts.items[j]?.name || item.name,
              description: ts.items[j]?.description ?? item.description,
            })),
          };
        }),
      };
    }
  }

  next.data = data;

  // Update meta with translated title/description if originals were swapped.
  if (t.name) {
    next.meta = {
      ...next.meta,
      title: data.name + (next.industry === "restaurant" ? " — Menu, hours & reservations" : ""),
      description:
        t.description ??
        next.meta.description,
    };
  }
  return next;
}

function extractJsonObject(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0 || end <= start) return "{}";
  return text.slice(start, end + 1);
}

const SYSTEM_PROMPT = `You translate scraped restaurant/business content into clean, idiomatic English for FOREIGN TOURISTS who cannot read the source language.

AUDIENCE: international travelers planning a visit. They need to understand every dish, every section title, every description in English. Nothing should be left in a foreign language.

Hard rules:
- Output ONLY a single JSON object matching the input shape exactly. No prose, no markdown fences.
- Translate EVERY natural-language string into English. No foreign-script characters may remain in the output — not in menu items, not in headings, not in descriptions, not in section titles. If you see CJK / Cyrillic / Arabic / Thai / Hangul / Devanagari etc. in a value, you MUST translate or transliterate it.

Dish names (CRITICAL):
- Format: "English Translation (Romanized Original)" when there is a recognizable English equivalent.
  - "Beef Pho (Phở Bò)"
  - "Spicy Tuna Roll (Karai Maguro Maki)"
  - "Grilled Beef Skewers (Yakitori)"
- If the dish has no English equivalent, give a short descriptive English name + romanization in parens.
  - "Cold Buckwheat Noodles (Zaru Soba)"
  - "Sweet Bean Pancake (Hotteok)"
- Always include a 1-sentence English description explaining what the dish IS (key ingredients, cooking method, taste) — even if the source had no description. This is essential for tourists. Keep it factual, do not invent specific ingredients not in the source; if unsure, describe by category ("a traditional Korean rice porridge").
- Romanize using the standard system for the language (Hepburn for Japanese, Pinyin for Mandarin, Revised Romanization for Korean, etc.). NEVER leave the original script.

Business / place names:
- Keep the proper name. If it's in foreign script, add a romanization in parens on first mention.

Preserve byte-identical:
- numbers, prices, currencies, dates, addresses (street + postal code), emails, URLs, phone numbers, social handles.

Other:
- Use clean, idiomatic English — not literal word-for-word translation. Read naturally for a native English speaker.
- NEVER invent facts. If source says "established in 1985", output "established in 1985" — never "with decades of history".
- Keep arrays the same length and in the same order. Empty/null fields stay empty/null.
- If a string is already English, return it unchanged.`;

export async function translateSiteToEnglish(
  site: PublishedSite,
): Promise<{ site: PublishedSite; notes: string[] }> {
  const notes: string[] = [];
  if (site.source?.isEnglish) {
    notes.push("Source detected as English — skipping translation.");
    return { site: { ...site, translated: true }, notes };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY ?? "";
  const claude = await loadAnthropic(apiKey);
  if (!claude) {
    notes.push("ANTHROPIC_API_KEY missing — translation skipped, original language preserved.");
    return { site, notes };
  }

  const payload = projectToTranslatable(site);
  const sourceLangHint = site.source?.language
    ? `Source language code: ${site.source.language} (${site.source.script}).`
    : "Source language: unknown — auto-detect.";

  const userMsg = [
    sourceLangHint,
    "",
    "Input JSON:",
    "```json",
    JSON.stringify(payload, null, 2),
    "```",
    "",
    "Return the same JSON object, with string values translated to English. Preserve the exact structure and array order.",
  ].join("\n");

  try {
    const res = await claude.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 16384,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMsg }],
    });
    const txt = res.content.map((c) => c.text ?? "").join("").trim();
    const parsed = JSON.parse(extractJsonObject(txt)) as TranslatablePayload;
    if (!parsed || typeof parsed !== "object") {
      notes.push("Translation response was not a JSON object — keeping original.");
      return { site, notes };
    }
    const translated = applyTranslatable(site, parsed);
    notes.push(
      `Translated from ${site.source?.language ?? "unknown"} → en (${
        payload.menuSections
          ? `${payload.menuSections.reduce((a, s) => a + s.items.length, 0)} menu items`
          : "no menu"
      }).`,
    );
    return { site: translated, notes };
  } catch (e) {
    notes.push(`Translation failed: ${e instanceof Error ? e.message : String(e)}`);
    return { site, notes };
  }
}
