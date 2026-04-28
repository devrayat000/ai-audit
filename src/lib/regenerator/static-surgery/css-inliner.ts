import * as cheerio from "cheerio";
import { fetchText } from "../../utils/http";
import { resolveUrl } from "../../utils/url";

export interface InlineCssOptions {
  pageUrl: string;
  /** when true, also inline <script src> bodies as inline <script>. Default false (safer). */
  inlineScripts?: boolean;
  /** maximum bytes of CSS we'll inline per stylesheet. Larger files left as <link>. */
  maxBytesPerSheet?: number;
  /** maximum bytes of JS we'll inline per script. Larger ones stay as <script src>. */
  maxBytesPerScript?: number;
}

const DEFAULT_MAX_CSS = 800_000;
const DEFAULT_MAX_JS = 400_000;

function rewriteCssUrls(css: string, sheetUrl: string): string {
  // url(...) refs
  let out = css.replace(/url\(\s*(['"]?)([^'")]+?)\1\s*\)/g, (match, quote, url) => {
    const trimmed = String(url).trim();
    if (!trimmed) return match;
    if (/^(data:|blob:|#)/i.test(trimmed)) return match;
    if (/^https?:\/\//i.test(trimmed)) return match;
    const abs = resolveUrl(sheetUrl, trimmed);
    return abs ? `url(${quote}${abs}${quote})` : match;
  });
  // @import "..." (string form)
  out = out.replace(/@import\s+(['"])([^'"]+)\1/g, (match, quote, url) => {
    if (/^(data:|https?:\/\/)/i.test(url)) return match;
    const abs = resolveUrl(sheetUrl, url);
    return abs ? `@import ${quote}${abs}${quote}` : match;
  });
  return out;
}

function escapeStyleClose(css: string): string {
  return css.replace(/<\/style>/gi, "<\\/style>");
}

function escapeScriptClose(js: string): string {
  return js.replace(/<\/script>/gi, "<\\/script>");
}

export async function inlineStylesheets(html: string, opts: InlineCssOptions): Promise<{ html: string; inlinedCss: number; inlinedJs: number; notes: string[] }> {
  const $ = cheerio.load(html);
  const notes: string[] = [];
  let inlinedCss = 0;
  let inlinedJs = 0;
  const maxCss = opts.maxBytesPerSheet ?? DEFAULT_MAX_CSS;
  const maxJs = opts.maxBytesPerScript ?? DEFAULT_MAX_JS;

  const sheetEls = $('link[rel~="stylesheet"][href]').toArray();
  for (const el of sheetEls) {
    const $el = $(el);
    const href = ($el.attr("href") ?? "").trim();
    if (!href) continue;
    if (/^(data:|blob:)/i.test(href)) continue;
    const resolved = resolveUrl(opts.pageUrl, href);
    if (!resolved) continue;
    try {
      const r = await fetchText(resolved, { timeoutMs: 12000 });
      if (!r.ok || !r.body) {
        $el.attr("href", resolved);
        $el.attr("crossorigin", "anonymous");
        notes.push(`Could not inline ${resolved} (status ${r.status}); kept as absolute <link>.`);
        continue;
      }
      if (r.body.length > maxCss) {
        $el.attr("href", resolved);
        $el.attr("crossorigin", "anonymous");
        notes.push(`Skipped inlining ${resolved} (${(r.body.length / 1024).toFixed(0)} KB > ${(maxCss / 1024).toFixed(0)} KB cap).`);
        continue;
      }
      const rewritten = rewriteCssUrls(r.body, resolved);
      const safe = escapeStyleClose(rewritten);
      const media = $el.attr("media");
      const styleTag = `<style data-ai-audit-from="${resolved.replace(/"/g, "&quot;")}"${media ? ` media="${media}"` : ""}>${safe}</style>`;
      $el.replaceWith(styleTag);
      inlinedCss++;
    } catch (e) {
      notes.push(`Inline failed for ${resolved}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (opts.inlineScripts) {
    const scriptEls = $("script[src]").toArray();
    for (const el of scriptEls) {
      const $el = $(el);
      const src = ($el.attr("src") ?? "").trim();
      if (!src) continue;
      if (/^(data:|blob:)/i.test(src)) continue;
      const resolved = resolveUrl(opts.pageUrl, src);
      if (!resolved) continue;
      try {
        const r = await fetchText(resolved, { timeoutMs: 12000 });
        if (!r.ok || !r.body || r.body.length > maxJs) {
          $el.attr("src", resolved);
          $el.attr("crossorigin", "anonymous");
          continue;
        }
        const safe = escapeScriptClose(r.body);
        const type = $el.attr("type");
        const $newScript = $(`<script data-ai-audit-from="${resolved.replace(/"/g, "&quot;")}"></script>`);
        if (type) $newScript.attr("type", type);
        $newScript.text(safe);
        $el.replaceWith($newScript);
        inlinedJs++;
      } catch {
        $el.attr("src", resolved);
        $el.attr("crossorigin", "anonymous");
      }
    }
  } else {
    // Defensive: tag remaining cross-origin scripts as anonymous so CORS doesn't block when hosts allow it.
    $("script[src]").each((_, el) => {
      const $el = $(el);
      const src = ($el.attr("src") ?? "").trim();
      if (!src || /^(data:|blob:)/i.test(src)) return;
      const resolved = resolveUrl(opts.pageUrl, src);
      if (!resolved) return;
      $el.attr("src", resolved);
      if (!$el.attr("crossorigin")) $el.attr("crossorigin", "anonymous");
    });
  }

  return { html: $.html(), inlinedCss, inlinedJs, notes };
}
