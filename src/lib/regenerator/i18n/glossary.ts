import * as cheerio from "cheerio";
import type { GlossaryEntry } from "../types";

function pickJsonText(node: unknown, key: string, out: string[]): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) return node.forEach((n) => pickJsonText(n, key, out));
  const obj = node as Record<string, unknown>;
  if (typeof obj[key] === "string") out.push(obj[key] as string);
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v && typeof v === "object") pickJsonText(v, key, out);
  }
}

export function buildAutoGlossary(htmlList: string[]): GlossaryEntry[] {
  const counts = new Map<string, number>();
  const seen = new Set<string>();
  for (const html of htmlList) {
    const $ = cheerio.load(html);
    const candidates: string[] = [];
    const ogSite = $('meta[property="og:site_name"]').attr("content")?.trim();
    if (ogSite) candidates.push(ogSite);
    const titleParts = $("title").first().text().trim().split(/[|\-—–·]/);
    if (titleParts[0]) candidates.push(titleParts[0].trim());
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).contents().text());
        const names: string[] = [];
        pickJsonText(json, "name", names);
        candidates.push(...names);
      } catch {}
    });
    const text = $("body").text();
    const matches = text.match(/\b[A-Z][\p{L}]+(?:\s+[A-Z][\p{L}]+){0,3}\b/gu) ?? [];
    for (const m of matches.slice(0, 200)) {
      if (m.length < 4 || m.length > 60) continue;
      candidates.push(m);
    }
    for (const c of candidates) {
      const k = c.trim();
      if (k.length < 2) continue;
      if (k.split(/\s+/).length > 5) continue;
      counts.set(k, (counts.get(k) ?? 0) + 1);
      seen.add(k);
    }
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
  return sorted.map(([source]) => ({
    source,
    handling: "preserve",
    target: source,
    origin: "auto" as const,
  }));
}
