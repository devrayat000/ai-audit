import * as cheerio from "cheerio";
import { makeCheck } from "./base";
import type { PageAnalyzer } from "./base";

export const canonicalAnalyzer: PageAnalyzer = {
  key: "canonical",
  scope: "page",
  run(page) {
    const $ = cheerio.load(page.renderedHtml || page.rawHtml);
    const href = $('link[rel="canonical"]').attr("href")?.trim() ?? "";
    const present = href.length > 0;
    let resolved = "";
    let matchesUrl = false;
    if (present) {
      try {
        resolved = new URL(href, page.url).toString();
        matchesUrl = resolved.replace(/\/$/, "") === page.url.replace(/\/$/, "");
      } catch {}
    }
    let score = 0;
    if (present) score += 2;
    if (matchesUrl) score += 1;
    return [
      makeCheck({
        analyzerKey: "canonical",
        category: "meta",
        scope: "page",
        name: "Canonical URL",
        shortDescription: "Canonical link tag",
        status: matchesUrl ? "pass" : present ? "warn" : "fail",
        score,
        maxScore: 3,
        message: present
          ? matchesUrl
            ? "Canonical points to this page."
            : `Canonical points to a different URL: ${resolved}`
          : "Missing <link rel='canonical'>.",
        evidence: { canonical: resolved, present, matchesUrl },
        fixSuggestion: present
          ? matchesUrl
            ? "OK"
            : "Update the canonical link to match this page's URL (or confirm intentional canonicalization)."
          : 'Add `<link rel="canonical" href="<this-page-url>">` to the page <head>.',
        pageUrl: page.url,
      }),
    ];
  },
};
