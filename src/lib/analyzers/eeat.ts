import * as cheerio from "cheerio";
import { makeCheck } from "./base";
import type { PageAnalyzer } from "./base";

export const eeatAnalyzer: PageAnalyzer = {
  key: "eeat-signals",
  scope: "page",
  run(page) {
    const $ = cheerio.load(page.renderedHtml || page.rawHtml);
    const text = $("body").text();

    const hasAuthor =
      $('[rel="author"], .author, [itemprop="author"]').length > 0 ||
      /\bby\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(text);
    const hasAbout =
      $('a[href*="about"], a[href*="/about"]').length > 0 ||
      /\babout us\b/i.test(text);
    const hasContact =
      $('a[href*="contact"], a[href^="mailto:"], a[href^="tel:"]').length > 0 ||
      /\bcontact (us|info)\b/i.test(text);
    const hasDates =
      $("time[datetime], [itemprop='datePublished'], [itemprop='dateModified']").length > 0 ||
      /(updated|published)\s+(on\s+)?\w+\s+\d{1,2},?\s+\d{4}/i.test(text);
    const hasCitations = $("a[href^='http']").length > 5 || $("cite").length > 0;

    let score = 0;
    if (hasAuthor) score += 2;
    if (hasAbout) score += 2;
    if (hasContact) score += 2;
    if (hasDates) score += 2;
    if (hasCitations) score += 2;

    const status = score >= 8 ? "pass" : score >= 5 ? "warn" : "fail";
    return [
      makeCheck({
        analyzerKey: "eeat-signals",
        category: "eeat",
        scope: "page",
        name: "E-E-A-T Signals",
        shortDescription: "Author, About, Contact, dates, citations",
        status,
        score,
        maxScore: 10,
        message: `Author ${hasAuthor ? "✓" : "✗"} About ${hasAbout ? "✓" : "✗"} Contact ${hasContact ? "✓" : "✗"} Dates ${hasDates ? "✓" : "✗"} Citations ${hasCitations ? "✓" : "✗"}`,
        evidence: { hasAuthor, hasAbout, hasContact, hasDates, hasCitations },
        fixSuggestion:
          score >= 8
            ? "E-E-A-T signals look strong."
            : "Add visible author bylines, link About/Contact pages, show published & updated dates, and cite sources for facts.",
        llmFixAvailable: false,
        pageUrl: page.url,
      }),
    ];
  },
};
