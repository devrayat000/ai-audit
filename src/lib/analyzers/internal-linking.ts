import * as cheerio from "cheerio";
import { makeCheck } from "./base";
import type { PageAnalyzer } from "./base";

const GENERIC = /^(click here|here|read more|learn more|more|link)\.?$/i;

export const internalLinkingAnalyzer: PageAnalyzer = {
  key: "internal-linking",
  scope: "page",
  run(page) {
    const $ = cheerio.load(page.renderedHtml || page.rawHtml);
    const anchors = $("a[href]").toArray();
    let internal = 0;
    let descriptive = 0;
    let generic = 0;
    let host = "";
    try {
      host = new URL(page.url).hostname;
    } catch {}
    anchors.forEach((el) => {
      const href = $(el).attr("href") ?? "";
      const text = $(el).text().trim();
      try {
        const u = new URL(href, page.url);
        if (u.hostname === host || href.startsWith("/") || !/^https?:/i.test(href)) {
          internal++;
          if (text && !GENERIC.test(text) && text.length >= 3) descriptive++;
          else if (GENERIC.test(text)) generic++;
        }
      } catch {}
    });

    let score = 0;
    if (internal >= 5) score += 3;
    else if (internal >= 2) score += 2;
    else if (internal >= 1) score += 1;
    if (internal > 0) {
      const ratio = descriptive / internal;
      score += Math.round(ratio * 2);
    }
    const status = score >= 4 ? "pass" : score >= 2 ? "warn" : "fail";
    return [
      makeCheck({
        analyzerKey: "internal-linking",
        category: "structure",
        scope: "page",
        name: "Internal Linking",
        shortDescription: "Descriptive anchors, link graph",
        status,
        score,
        maxScore: 5,
        message: `${internal} internal links; ${descriptive} descriptive, ${generic} generic ("click here"/"read more").`,
        evidence: { internal, descriptive, generic },
        fixSuggestion:
          generic > 0
            ? "Replace 'click here'/'read more' with descriptive anchor text that says where the link goes."
            : "Add more contextual internal links between related pages.",
        llmFixAvailable: generic > 0,
        pageUrl: page.url,
      }),
    ];
  },
};
