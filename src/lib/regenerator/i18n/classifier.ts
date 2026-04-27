import * as cheerio from "cheerio";
import type { Element, Text } from "domhandler";
import type { GlossaryEntry, TextClassification } from "../types";

const RE_PHONE = /(\+?\d[\d\s\-().]{6,}\d)/;
const RE_EMAIL = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/;
const RE_URL = /\bhttps?:\/\/\S+|www\.\S+\.\S+/i;
const RE_PRICE = /(?:\$|€|£|¥|₹|৳)\s?\d|(?:\d[\d,]*\s?(?:USD|EUR|GBP|INR|BDT|JPY))/i;
const RE_DATE = /\b(?:\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}|\d{4}-\d{2}-\d{2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2})/i;
const RE_LEGAL = /\b(allerg(?:y|en)|gluten|nut\s|peanut|warranty|disclaimer|liability|medical|diagnosis|treatment|prescription|interest rate|apr\b|return guaranteed|terms? of service|privacy policy|gdpr|consult\s+your\s+(doctor|physician))\b/i;

const SKIP_TAGS = new Set(["script", "style", "code", "pre", "noscript", "template", "svg", "math"]);

export interface ClassifiedNode {
  id: string;
  text: string;
  classification: TextClassification;
  contextHint: string;
  selectorPath: string;
  ref: { parentSelector: string; nodeIndex: number };
}

export function classifyTextNodes(html: string, glossary: GlossaryEntry[]): { nodes: ClassifiedNode[] } {
  const $ = cheerio.load(html);
  const out: ClassifiedNode[] = [];
  const preserveTerms = new Set(
    glossary.filter((g) => g.handling === "preserve" || g.handling === "transliterate").map((g) => g.source.toLowerCase())
  );
  let counter = 0;

  function classify(node: Text, parent: Element): { c: TextClassification; hint: string } {
    const raw = node.data ?? "";
    const text = raw.replace(/\s+/g, " ").trim();
    if (!text) return { c: "preserve", hint: "" };

    if (RE_EMAIL.test(text) || RE_URL.test(text) || RE_PHONE.test(text) || RE_PRICE.test(text) || RE_DATE.test(text)) {
      return { c: "preserve", hint: "atomic" };
    }
    const tag = parent.tagName?.toLowerCase() ?? "";
    const cls = (parent.attribs?.class ?? "").toLowerCase();
    const itemtype = (parent.attribs?.itemtype ?? "").toLowerCase();
    if (tag === "address" || /postaladdress|street|address/i.test(itemtype)) {
      return { c: "preserve", hint: "address" };
    }
    if (preserveTerms.has(text.toLowerCase())) {
      return { c: "preserve-pn", hint: "glossary" };
    }
    if (RE_LEGAL.test(text)) {
      return { c: "flag-legal", hint: "legal-suspect" };
    }
    if (["button", "label", "option", "summary"].includes(tag)) {
      return { c: "literal", hint: tag };
    }
    if (tag === "a" && text.length < 60) {
      return { c: "literal", hint: "anchor" };
    }
    if (["h1", "h2", "h3"].includes(tag)) {
      return { c: "transcreate", hint: tag };
    }
    if ((tag === "p" || tag === "li" || tag === "blockquote") && text.length > 60) {
      return { c: "transcreate", hint: tag };
    }
    if (tag === "title" || (tag === "meta" && (parent.attribs?.name ?? "") === "description")) {
      return { c: "transcreate", hint: "head" };
    }
    if (cls.includes("hero") || cls.includes("tagline") || cls.includes("subtitle")) {
      return { c: "transcreate", hint: "hero" };
    }
    return { c: "literal", hint: "default" };
  }

  function selectorFor(el: Element): string {
    const parts: string[] = [];
    let cur: Element | null = el;
    while (cur && cur.tagName) {
      const tag = cur.tagName;
      const id = cur.attribs?.id;
      if (id) {
        parts.unshift(`${tag}#${id}`);
        break;
      }
      const cls = (cur.attribs?.class ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 2).join(".");
      parts.unshift(cls ? `${tag}.${cls}` : tag);
      cur = (cur.parent as Element | null) ?? null;
    }
    return parts.join(" > ").slice(0, 240);
  }

  function walk(el: Element) {
    const tag = el.tagName?.toLowerCase() ?? "";
    if (SKIP_TAGS.has(tag)) return;
    const children = el.children ?? [];
    for (let i = 0; i < children.length; i++) {
      const c = children[i];
      if ((c as Text).type === "text") {
        const node = c as Text;
        const text = (node.data ?? "").replace(/\s+/g, " ").trim();
        if (!text) continue;
        const { c: kind, hint } = classify(node, el);
        out.push({
          id: `t${counter++}`,
          text,
          classification: kind,
          contextHint: hint,
          selectorPath: selectorFor(el),
          ref: { parentSelector: selectorFor(el), nodeIndex: i },
        });
      } else if ((c as Element).type === "tag") {
        walk(c as Element);
      }
    }
  }

  // also process meta description + title separately as "tag" content
  const titleText = $("title").first().text().trim();
  if (titleText) {
    out.push({
      id: `meta-title`,
      text: titleText,
      classification: "transcreate",
      contextHint: "page title",
      selectorPath: "title",
      ref: { parentSelector: "title", nodeIndex: 0 },
    });
  }
  const desc = $('meta[name="description"]').attr("content")?.trim();
  if (desc) {
    out.push({
      id: `meta-desc`,
      text: desc,
      classification: "transcreate",
      contextHint: "meta description",
      selectorPath: 'meta[name="description"]',
      ref: { parentSelector: 'meta[name="description"]', nodeIndex: -1 },
    });
  }
  $("img[alt]").each((_, el) => {
    const alt = ($(el).attr("alt") ?? "").trim();
    if (!alt) return;
    out.push({
      id: `alt-${counter++}`,
      text: alt,
      classification: "literal",
      contextHint: "alt text",
      selectorPath: selectorFor(el as Element),
      ref: { parentSelector: selectorFor(el as Element), nodeIndex: -2 },
    });
  });

  const body = $("body").get(0) as Element | undefined;
  if (body) walk(body);
  return { nodes: out };
}
