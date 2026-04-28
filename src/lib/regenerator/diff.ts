import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import type { Element } from "domhandler";
import type { PageDiff } from "./types";

interface DiffLine { type: "added" | "removed" | "context"; line: string }

function lcs(a: string[], b: string[]): number[][] {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      if (a[i] === b[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  return dp;
}

function lineDiff(a: string[], b: string[]): DiffLine[] {
  const dp = lcs(a, b);
  const out: DiffLine[] = [];
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ type: "context", line: a[i] });
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: "removed", line: a[i] });
      i++;
    } else {
      out.push({ type: "added", line: b[j] });
      j++;
    }
  }
  while (i < a.length) { out.push({ type: "removed", line: a[i++] }); }
  while (j < b.length) { out.push({ type: "added", line: b[j++] }); }
  return out;
}

const LANDMARK_TAGS = new Set(["main", "article", "section", "nav", "header", "footer", "aside"]);
const HEADING_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);
const RELEVANT_LINK_REL = /\b(canonical|alternate|manifest|icon|apple-touch-icon)\b/i;

/**
 * Extract only the elements that matter for AI / GEO compatibility:
 *   - <html lang> / <html dir>
 *   - <title>
 *   - all <meta>
 *   - <link rel="canonical|alternate|manifest|icon">
 *   - JSON-LD <script type="application/ld+json">
 *   - <h1>..<h6> with their text
 *   - semantic landmark openings (<main>, <article>, <section>, <nav>, <header>, <footer>)
 *   - <img alt="...">
 *   - <a href> with text on internal nav (kept short)
 *
 * Drops scripts, stylesheets, font links, preconnect/preload hints, plain divs/spans,
 * inline style attributes, and other markup that doesn't affect what an AI engine extracts.
 */
export function extractGeoLines(html: string): string[] {
  const out: string[] = [];
  if (!html) return out;
  const $ = cheerio.load(html);

  const htmlEl = $("html").get(0) as Element | undefined;
  if (htmlEl) {
    const lang = htmlEl.attribs?.lang;
    const dir = htmlEl.attribs?.dir;
    if (lang) out.push(`<html lang="${lang}">`);
    if (dir) out.push(`<html dir="${dir}">`);
  }

  const title = $("title").first().text().trim();
  if (title) out.push(`<title>${title}</title>`);

  $("meta").each((_, el) => {
    const a = (el as Element).attribs ?? {};
    const name = a.name ?? a.property ?? a["http-equiv"] ?? a.charset ?? "";
    const content = a.content ?? "";
    if (!name && !content) return;
    if (a.charset) {
      out.push(`<meta charset="${a.charset}">`);
      return;
    }
    const key = a.name ? `name="${a.name}"` : a.property ? `property="${a.property}"` : a["http-equiv"] ? `http-equiv="${a["http-equiv"]}"` : "";
    out.push(`<meta ${key} content="${truncate(content, 240)}">`);
  });

  $("link[rel]").each((_, el) => {
    const a = (el as Element).attribs ?? {};
    const rel = a.rel ?? "";
    if (!RELEVANT_LINK_REL.test(rel)) return;
    const href = a.href ?? "";
    const hreflang = a.hreflang ? ` hreflang="${a.hreflang}"` : "";
    const type = a.type ? ` type="${a.type}"` : "";
    out.push(`<link rel="${rel}"${hreflang}${type} href="${truncate(href, 240)}">`);
  });

  $('script[type="application/ld+json"]').each((_, el) => {
    const text = $(el).contents().text().trim();
    if (!text) return;
    let pretty = text;
    try {
      pretty = JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      // keep as-is
    }
    out.push("<script type=\"application/ld+json\">");
    pretty.split("\n").forEach((l) => out.push("  " + l));
    out.push("</script>");
  });

  // body landmark + heading walk in document order
  const body = $("body").get(0) as Element | undefined;
  if (body) walkBody(body, $, out);

  return out;
}

function walkBody(el: Element, $: CheerioAPI, out: string[]): void {
  const children = el.children ?? [];
  for (const c of children) {
    const node = c as Element;
    if (node.type !== "tag") continue;
    const tag = node.tagName?.toLowerCase() ?? "";

    if (HEADING_TAGS.has(tag)) {
      const text = $(node).text().replace(/\s+/g, " ").trim();
      if (text) out.push(`<${tag}>${truncate(text, 200)}</${tag}>`);
      continue;
    }

    if (LANDMARK_TAGS.has(tag)) {
      const role = node.attribs?.role ? ` role="${node.attribs.role}"` : "";
      const aria = node.attribs?.["aria-label"] ? ` aria-label="${truncate(node.attribs["aria-label"], 80)}"` : "";
      out.push(`<${tag}${role}${aria}>`);
      walkBody(node, $, out);
      out.push(`</${tag}>`);
      continue;
    }

    if (tag === "img") {
      const alt = node.attribs?.alt;
      if (alt && alt.trim()) {
        out.push(`<img alt="${truncate(alt, 200)}">`);
      }
      continue;
    }

    if (tag === "a") {
      const href = node.attribs?.href ?? "";
      const text = $(node).text().replace(/\s+/g, " ").trim();
      // only surface anchors with descriptive text — skip nav-button-only links
      if (text && text.length >= 4 && href && !/^(#|javascript:)/i.test(href)) {
        // skip noisy inline anchors (very long pages produce hundreds)
        const looksNav = /^[A-Z][\w\s&'-]{2,40}$/.test(text);
        if (looksNav) {
          out.push(`<a href="${truncate(href, 120)}">${truncate(text, 80)}</a>`);
        }
      }
      // still descend in case nested headings/landmarks
      walkBody(node, $, out);
      continue;
    }

    // generic descendant: don't print the tag, just recurse
    walkBody(node, $, out);
  }
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}

export function diffPage(url: string, before: string, after: string, maxLines = 1500): PageDiff {
  const a = extractGeoLines(before).slice(0, maxLines);
  const b = extractGeoLines(after).slice(0, maxLines);
  return { url, before: a.join("\n"), after: b.join("\n"), changes: lineDiff(a, b).slice(0, maxLines) };
}
