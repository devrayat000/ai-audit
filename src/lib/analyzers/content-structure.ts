import * as cheerio from "cheerio";
import { makeCheck } from "./base";
import type { PageAnalyzer } from "./base";

export const contentStructureAnalyzer: PageAnalyzer = {
  key: "content-structure",
  scope: "page",
  run(page) {
    const $ = cheerio.load(page.renderedHtml || page.rawHtml);
    const h1 = $("h1");
    const headings = $("h1, h2, h3, h4, h5, h6")
      .toArray()
      .map((el) => ({ tag: (el as { tagName: string }).tagName.toLowerCase(), text: $(el).text().trim() }));

    let h1Count = h1.length;
    let skipCount = 0;
    let lastLevel = 0;
    for (const h of headings) {
      const level = Number(h.tag.slice(1));
      if (lastLevel && level - lastLevel > 1) skipCount++;
      lastLevel = level;
    }

    const lists = $("ul, ol").length;
    const tables = $("table").length;
    const paragraphs = $("p").toArray();
    const longPara = paragraphs.filter((p) => $(p).text().split(/\s+/).length > 120).length;
    const faqMatch = /\bfrequently asked\b|\bfaq\b/i.test($("body").text());

    let score = 0;
    if (h1Count === 1) score += 5;
    else if (h1Count === 0) score += 0;
    else score += 2;

    if (skipCount === 0 && headings.length > 1) score += 4;
    else score += Math.max(0, 4 - skipCount);

    if (lists > 0) score += 2;
    if (tables > 0) score += 1;
    if (longPara === 0) score += 2;
    else score += Math.max(0, 2 - longPara);
    if (faqMatch) score += 1;

    const status = score >= 12 ? "pass" : score >= 7 ? "warn" : "fail";

    const issues: string[] = [];
    if (h1Count !== 1) issues.push(`${h1Count} <h1> tags (expected 1).`);
    if (skipCount > 0) issues.push(`${skipCount} heading-level skips.`);
    if (longPara > 0) issues.push(`${longPara} very long paragraphs (>120 words).`);
    if (lists === 0) issues.push("No lists — AI engines love bullet/numbered lists for facts.");

    return [
      makeCheck({
        analyzerKey: "content-structure",
        category: "structure",
        scope: "page",
        name: "Content Structure",
        shortDescription: "Headings, lists, FAQ",
        status,
        score,
        maxScore: 15,
        message:
          issues.length === 0
            ? "Heading hierarchy and content structure look healthy."
            : issues.join(" "),
        evidence: {
          h1Count,
          headingCount: headings.length,
          headingSkips: skipCount,
          lists,
          tables,
          longParagraphs: longPara,
          hasFaq: faqMatch,
        },
        fixSuggestion:
          issues.length === 0
            ? "Consider adding an FAQ block — AI assistants quote them often."
            : "Use exactly one <h1>, no level skips, break long paragraphs, and add lists or an FAQ block.",
        llmFixAvailable: !faqMatch,
        pageUrl: page.url,
      }),
    ];
  },
};
