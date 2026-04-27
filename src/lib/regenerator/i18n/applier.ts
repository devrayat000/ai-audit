import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import type { Element, Text } from "domhandler";
import type { ClassifiedNode } from "./classifier";

export interface ApplyInput {
  html: string;
  nodes: ClassifiedNode[];
  translations: Map<string, { translation: string }>;
  newLang: string;
}

const SKIP = new Set(["script", "style", "code", "pre", "noscript", "template", "svg", "math"]);

function walkAndReplace($: CheerioAPI, perSelectorText: Map<string, Map<string, string>>) {
  function visit(el: Element) {
    if (SKIP.has(el.tagName?.toLowerCase() ?? "")) return;
    const children = el.children ?? [];
    for (const c of children) {
      if ((c as Text).type === "text") {
        const node = c as Text;
        const original = (node.data ?? "").replace(/\s+/g, " ").trim();
        if (!original) continue;
        // selector path approximation isn't deterministic for matching, so just look up by text
        for (const [, table] of perSelectorText) {
          if (table.has(original)) {
            const replacement = table.get(original);
            if (replacement && replacement !== original) {
              const leading = (node.data ?? "").match(/^\s*/)?.[0] ?? "";
              const trailing = (node.data ?? "").match(/\s*$/)?.[0] ?? "";
              node.data = `${leading}${replacement}${trailing}`;
            }
            break;
          }
        }
      } else if ((c as Element).type === "tag") {
        visit(c as Element);
      }
    }
  }
  const body = $("body").get(0) as Element | undefined;
  if (body) visit(body);
}

export function applyTranslations(input: ApplyInput): string {
  const $ = cheerio.load(input.html);
  $("html").attr("lang", input.newLang);

  // Build a "by exact source text" lookup table — duplicates collapse, which is fine
  // since same source text translates the same way for our pipeline.
  const bySource = new Map<string, string>();
  for (const n of input.nodes) {
    const t = input.translations.get(n.id);
    if (!t) continue;
    if (n.id === "meta-title") {
      $("title").first().text(t.translation);
      continue;
    }
    if (n.id === "meta-desc") {
      const el = $('meta[name="description"]');
      if (el.length === 0) {
        $("head").append(`<meta name="description" content="${escapeAttr(t.translation)}">`);
      } else {
        el.attr("content", t.translation);
      }
      continue;
    }
    if (n.id.startsWith("alt-")) {
      // alt-text matching — find image with same alt text
      $(`img[alt="${escapeAttr(n.text)}"]`).attr("alt", t.translation);
      continue;
    }
    if (!bySource.has(n.text)) bySource.set(n.text, t.translation);
  }

  const perSelector = new Map<string, Map<string, string>>();
  perSelector.set("__global__", bySource);
  walkAndReplace($, perSelector);

  // OG / twitter metas mirror title/description
  const newTitle = $("title").first().text();
  if (newTitle) {
    $('meta[property="og:title"]').attr("content", newTitle);
    $('meta[name="twitter:title"]').attr("content", newTitle);
  }
  const newDesc = $('meta[name="description"]').attr("content");
  if (newDesc) {
    $('meta[property="og:description"]').attr("content", newDesc);
    $('meta[name="twitter:description"]').attr("content", newDesc);
  }

  return $.html();
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
