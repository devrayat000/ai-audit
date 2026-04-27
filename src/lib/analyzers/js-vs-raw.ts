import * as cheerio from "cheerio";
import { makeCheck } from "./base";
import type { PageAnalyzer } from "./base";

function visibleTextLength(html: string): number {
  if (!html) return 0;
  try {
    const $ = cheerio.load(html);
    $("script, style, noscript").remove();
    return $("body").text().replace(/\s+/g, " ").trim().length;
  } catch {
    return 0;
  }
}

export const jsVsRawAnalyzer: PageAnalyzer = {
  key: "js-vs-raw",
  scope: "page",
  run(page) {
    const rawLen = visibleTextLength(page.rawHtml);
    const renderedLen = visibleTextLength(page.renderedHtml);
    const ratio = renderedLen > 0 ? rawLen / renderedLen : 1;
    const dependency = 1 - ratio;
    let score = 0;
    let status: "pass" | "warn" | "fail" = "fail";
    if (ratio >= 0.8) {
      score = 15;
      status = "pass";
    } else if (ratio >= 0.5) {
      score = 10;
      status = "warn";
    } else if (ratio >= 0.3) {
      score = 5;
      status = "warn";
    } else {
      score = 1;
      status = "fail";
    }
    return [
      makeCheck({
        analyzerKey: "js-vs-raw",
        category: "performance",
        scope: "page",
        name: "JS vs Raw HTML",
        shortDescription: "What AI bots see without JS",
        status,
        score,
        maxScore: 15,
        message:
          renderedLen === 0
            ? "Could not render the page."
            : `Raw HTML contains ${(ratio * 100).toFixed(0)}% of the rendered text (${rawLen.toLocaleString()} / ${renderedLen.toLocaleString()} chars).`,
        evidence: {
          rawTextLength: rawLen,
          renderedTextLength: renderedLen,
          contentRatio: ratio,
          jsDependencyRatio: dependency,
        },
        fixSuggestion:
          ratio >= 0.8
            ? "Critical content is in the raw HTML — AI bots can read it."
            : "Use server-side rendering or static generation so the main content is in the initial HTML response, not injected by JavaScript.",
        llmFixAvailable: false,
        pageUrl: page.url,
      }),
    ];
  },
};
