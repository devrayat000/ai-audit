import * as cheerio from "cheerio";
import type { Cheerio } from "cheerio";
import type { Element } from "domhandler";

function classMatches(el: Element, ...needles: string[]): boolean {
  const cls = (el.attribs?.class ?? "").toLowerCase();
  const id = (el.attribs?.id ?? "").toLowerCase();
  return needles.some((n) => cls.includes(n) || id.includes(n));
}

function rename($el: Cheerio<Element>, tag: string) {
  const el = $el.get(0) as Element | undefined;
  if (!el) return;
  el.tagName = tag;
}

export function rewriteSemantics(html: string): { html: string; changed: boolean; notes: string[] } {
  const $ = cheerio.load(html);
  const notes: string[] = [];
  let changed = false;

  if ($("nav").length === 0) {
    const candidate = $("body div, body header div, body div header div").toArray().find((el) => {
      const e = el as Element;
      if (!classMatches(e, "nav", "menu", "navbar")) return false;
      const $e = $(e);
      const links = $e.find("a").length;
      const text = $e.text().replace(/\s+/g, " ").trim();
      return links >= 3 && text.length < 800;
    }) as Element | undefined;
    if (candidate) {
      rename($(candidate), "nav");
      changed = true;
      notes.push("Wrapped a div nav-like region in <nav>.");
    }
  }

  if ($("header").length === 0) {
    const first = $("body").children().first().get(0) as Element | undefined;
    if (first && first.tagName === "div" && classMatches(first, "header", "site-header", "topbar", "masthead")) {
      rename($(first), "header");
      changed = true;
      notes.push("Promoted top-level header div to <header>.");
    }
  }

  if ($("footer").length === 0) {
    const last = $("body").children().last().get(0) as Element | undefined;
    if (last && last.tagName === "div" && classMatches(last, "footer", "site-footer")) {
      rename($(last), "footer");
      changed = true;
      notes.push("Promoted bottom div to <footer>.");
    }
  }

  if ($("main").length === 0) {
    const candidates = $("body > div, body > section").toArray() as Element[];
    let best: Element | null = null;
    let bestLen = 0;
    for (const c of candidates) {
      const len = $(c).text().replace(/\s+/g, " ").trim().length;
      if (len > bestLen && !classMatches(c, "header", "footer", "nav", "sidebar")) {
        bestLen = len;
        best = c;
      }
    }
    if (best && bestLen > 200) {
      rename($(best), "main");
      changed = true;
      notes.push("Promoted largest content div to <main>.");
    }
  }

  return { html: $.html(), changed, notes };
}
