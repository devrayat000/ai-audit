import * as cheerio from "cheerio";
import { resolveUrl } from "../../utils/url";

export interface AssetOptions {
  pageUrl: string;
  rootUrl: string;
  /** if true, rewrites all relative asset URLs to absolute; otherwise leaves as-is */
  absolutize: boolean;
}

const ATTR_MAP: Array<{ sel: string; attr: string }> = [
  { sel: "link[href]", attr: "href" },
  { sel: "script[src]", attr: "src" },
  { sel: "img[src]", attr: "src" },
  { sel: "img[srcset]", attr: "srcset" },
  { sel: "source[src]", attr: "src" },
  { sel: "source[srcset]", attr: "srcset" },
  { sel: "video[src]", attr: "src" },
  { sel: "audio[src]", attr: "src" },
  { sel: 'a[href^="/"]', attr: "href" },
];

function rewriteSrcset(value: string, base: string): string {
  return value
    .split(",")
    .map((part) => {
      const trimmed = part.trim();
      if (!trimmed) return "";
      const [url, ...rest] = trimmed.split(/\s+/);
      const abs = resolveUrl(base, url) ?? url;
      return [abs, ...rest].join(" ");
    })
    .filter(Boolean)
    .join(", ");
}

export function rewriteAssetUrls(html: string, opts: AssetOptions): string {
  if (!opts.absolutize) return html;
  const $ = cheerio.load(html);
  for (const { sel, attr } of ATTR_MAP) {
    $(sel).each((_, el) => {
      const $el = $(el);
      const v = $el.attr(attr);
      if (!v) return;
      if (/^(https?:|data:|mailto:|tel:|#)/i.test(v)) return;
      if (attr === "srcset") {
        $el.attr(attr, rewriteSrcset(v, opts.pageUrl));
      } else {
        const resolved = resolveUrl(opts.pageUrl, v);
        if (resolved) $el.attr(attr, resolved);
      }
    });
  }
  return $.html();
}
