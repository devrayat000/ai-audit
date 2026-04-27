import * as cheerio from "cheerio";
import { makeCheck } from "./base";
import type { PageAnalyzer } from "./base";

export const metaTagsAnalyzer: PageAnalyzer = {
  key: "meta-tags",
  scope: "page",
  run(page) {
    const $ = cheerio.load(page.renderedHtml || page.rawHtml);
    const title = $("title").first().text().trim();
    const desc = $('meta[name="description"]').attr("content")?.trim() ?? "";
    const og: Record<string, string> = {};
    $('meta[property^="og:"]').each((_, el) => {
      const p = $(el).attr("property");
      const c = $(el).attr("content");
      if (p && c) og[p] = c;
    });
    const twitter: Record<string, string> = {};
    $('meta[name^="twitter:"]').each((_, el) => {
      const n = $(el).attr("name");
      const c = $(el).attr("content");
      if (n && c) twitter[n] = c;
    });
    const canonical = $('link[rel="canonical"]').attr("href") ?? "";

    const issues: string[] = [];
    let score = 0;

    if (title) {
      score += 4;
      if (title.length >= 30 && title.length <= 65) score += 2;
      else issues.push(`Title is ${title.length} chars (recommend 30–65).`);
    } else {
      issues.push("Missing <title>.");
    }

    if (desc) {
      score += 3;
      if (desc.length >= 70 && desc.length <= 160) score += 2;
      else issues.push(`Meta description is ${desc.length} chars (recommend 70–160).`);
    } else {
      issues.push("Missing meta description.");
    }

    if (og["og:title"] && og["og:description"]) score += 2;
    else issues.push("Missing Open Graph title/description.");
    if (og["og:image"]) score += 1;
    else issues.push("Missing og:image.");

    if (twitter["twitter:card"]) score += 1;

    if (canonical) score += 0; // canonical contributes elsewhere

    const status = score >= 13 ? "pass" : score >= 7 ? "warn" : "fail";

    return [
      makeCheck({
        analyzerKey: "meta-tags",
        category: "meta",
        scope: "page",
        name: "Meta Tags",
        shortDescription: "Title, description, OG, Twitter",
        status,
        score,
        maxScore: 15,
        message: issues.length === 0 ? "All key meta tags present and well-sized." : issues.join(" "),
        evidence: {
          title,
          titleLength: title.length,
          description: desc,
          descriptionLength: desc.length,
          og,
          twitter,
          canonical,
        },
        fixSuggestion:
          issues.length === 0
            ? "Looks good — keep the current template."
            : "Rewrite the title and description to be entity-rich, action-oriented, and within recommended length. Click 'Generate fix' for an AI rewrite.",
        llmFixAvailable: issues.length > 0,
        pageUrl: page.url,
      }),
    ];
  },
};
