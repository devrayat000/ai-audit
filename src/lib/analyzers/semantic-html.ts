import * as cheerio from "cheerio";
import { makeCheck } from "./base";
import type { PageAnalyzer } from "./base";

export const semanticHtmlAnalyzer: PageAnalyzer = {
  key: "semantic-html",
  scope: "page",
  run(page) {
    const $ = cheerio.load(page.renderedHtml || page.rawHtml);
    const tags = ["main", "article", "section", "nav", "header", "footer"];
    const counts: Record<string, number> = {};
    tags.forEach((t) => (counts[t] = $(t).length));
    const present = tags.filter((t) => counts[t] > 0).length;
    const score = Math.round((present / tags.length) * 5);
    const status = score >= 4 ? "pass" : score >= 2 ? "warn" : "fail";
    return [
      makeCheck({
        analyzerKey: "semantic-html",
        category: "structure",
        scope: "page",
        name: "Semantic HTML",
        shortDescription: "main, article, section, nav, header, footer",
        status,
        score,
        maxScore: 5,
        message: `${present}/${tags.length} semantic landmarks used.`,
        evidence: counts,
        fixSuggestion:
          present === tags.length
            ? "Good landmark usage."
            : `Wrap primary content in <main><article>, use <section> for groups, <nav> for navigation, and <header>/<footer> for site chrome.`,
        pageUrl: page.url,
      }),
    ];
  },
};
