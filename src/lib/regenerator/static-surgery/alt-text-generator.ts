import * as cheerio from "cheerio";
import { resolveUrl } from "../../utils/url";

const BAD_ALT = /^(image|photo|picture|img_?\d+|dsc_?\d+|untitled|.*\.(jpg|jpeg|png|gif|webp))$/i;

export interface AltTextLlm {
  describe(input: { src: string; surroundingText: string; pageTitle: string }): Promise<string | null>;
}

export interface AltOptions {
  pageUrl: string;
  pageTitle: string;
  industry: string;
  llm?: AltTextLlm | null;
  fallbackPrefix?: string;
}

export async function fixAltText(html: string, opts: AltOptions): Promise<{ html: string; updated: number; notes: string[] }> {
  const $ = cheerio.load(html);
  const notes: string[] = [];
  let updated = 0;
  const targets = $("img").toArray().filter((el) => {
    const alt = ($(el).attr("alt") ?? "").trim();
    if (!alt) return true;
    if (alt.length < 4) return true;
    if (BAD_ALT.test(alt)) return true;
    return false;
  });

  for (const el of targets) {
    const $el = $(el);
    const rawSrc = $el.attr("src") ?? "";
    const src = resolveUrl(opts.pageUrl, rawSrc) ?? rawSrc;
    const surrounding = $el.parent().text().replace(/\s+/g, " ").trim().slice(0, 280);
    let alt: string | null = null;
    if (opts.llm) {
      try {
        alt = await opts.llm.describe({ src, surroundingText: surrounding, pageTitle: opts.pageTitle });
      } catch {
        alt = null;
      }
    }
    if (!alt) {
      const fileName = (src.split("/").pop() ?? "image").replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ");
      const ctx = surrounding.slice(0, 80);
      alt = ctx ? `${ctx}` : `${opts.fallbackPrefix ?? opts.pageTitle} — ${fileName || "image"}`;
    }
    $el.attr("alt", alt.slice(0, 180));
    updated++;
  }

  if (updated > 0) notes.push(`Wrote alt text on ${updated} image(s).`);
  return { html: $.html(), updated, notes };
}
