import * as cheerio from "cheerio";

export interface HreflangPair {
  hreflang: string;
  href: string;
}

export function injectHreflang(html: string, alternates: HreflangPair[]): string {
  const $ = cheerio.load(html);
  // remove pre-existing alternates added by us
  $('link[rel="alternate"][hreflang][data-ai-audit="1"]').remove();
  for (const a of alternates) {
    $("head").append(`<link rel="alternate" hreflang="${a.hreflang}" href="${a.href}" data-ai-audit="1">`);
  }
  return $.html();
}

export function buildAlternatesForPair(
  sourceUrl: string,
  targetUrl: string,
  sourceLang: string,
  targetLang: string,
  defaultLang: "source" | "target" = "source"
): HreflangPair[] {
  const out: HreflangPair[] = [
    { hreflang: sourceLang, href: sourceUrl },
    { hreflang: targetLang, href: targetUrl },
  ];
  out.push({ hreflang: "x-default", href: defaultLang === "source" ? sourceUrl : targetUrl });
  return out;
}
