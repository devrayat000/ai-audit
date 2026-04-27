import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import crypto from "node:crypto";

export interface ExtractedComponent {
  name: string;
  html: string;
  count: number;
  pages: string[];
}

interface SeenInfo {
  count: number;
  pages: Set<string>;
  html: string;
}

function blockSignature(el: Element): string {
  const tag = el.tagName?.toLowerCase() ?? "";
  const cls = (el.attribs?.class ?? "").trim();
  return `${tag}.${cls}`;
}

function looksHeader(sig: string): string | null {
  if (/header|masthead|topbar/i.test(sig)) return "Header";
  if (/footer/i.test(sig)) return "Footer";
  if (/(^|[.\s])nav([.\s]|$)|navbar/i.test(sig)) return "NavBar";
  if (/hero|jumbotron|banner/i.test(sig)) return "Hero";
  return null;
}

export function extractRepeatingComponents(pages: { url: string; html: string }[]): ExtractedComponent[] {
  const buckets = new Map<string, SeenInfo>();
  for (const p of pages) {
    const $ = cheerio.load(p.html);
    $("body > *, header, footer, nav").each((_, el) => {
      const e = el as Element;
      const tag = e.tagName?.toLowerCase() ?? "";
      if (!["header", "footer", "nav", "section", "div"].includes(tag)) return;
      const sig = blockSignature(e);
      const html = ($.html(e) ?? "").trim();
      if (html.length < 80 || html.length > 30_000) return;
      const key = crypto.createHash("md5").update(`${sig}|${html.slice(0, 600)}`).digest("hex");
      const ex = buckets.get(key);
      if (ex) {
        ex.count += 1;
        ex.pages.add(p.url);
      } else {
        buckets.set(key, { count: 1, pages: new Set([p.url]), html });
      }
    });
  }

  const components: ExtractedComponent[] = [];
  let genericIdx = 0;
  for (const [, info] of buckets) {
    if (info.pages.size < 2) continue; // only repeating
    const firstFew = info.html.slice(0, 300);
    const $ = cheerio.load(firstFew);
    const root = $("body").children().first().get(0) as Element | undefined;
    const sig = root ? blockSignature(root) : "";
    const named = looksHeader(sig);
    const name = named ?? `Block${genericIdx++}`;
    components.push({ name, html: info.html, count: info.count, pages: [...info.pages] });
  }
  return components;
}
