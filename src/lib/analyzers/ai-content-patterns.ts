import * as cheerio from "cheerio";
import { makeCheck } from "./base";
import type { PageAnalyzer } from "./base";

export const aiContentPatternsAnalyzer: PageAnalyzer = {
  key: "ai-content-patterns",
  scope: "page",
  run(page) {
    const $ = cheerio.load(page.renderedHtml || page.rawHtml);
    const text = $("body").text();
    const firstPara = $("p").first().text().trim();

    // direct-answer lead: first paragraph is a definition / answer pattern
    const isDirectAnswer = /^[A-Z][^.!?]{20,200}\bis\b|^[A-Z].*\b(provides|offers|serves|specializes)\b/.test(
      firstPara
    );
    // fact density: ratio of sentences containing numbers, dates, proper nouns
    const sentences = text.split(/[.!?]\s/).slice(0, 80);
    const factSentences = sentences.filter((s) =>
      /\d|\b(19|20)\d{2}\b|\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(s)
    ).length;
    const factDensity = sentences.length ? factSentences / sentences.length : 0;
    // named entities (rough heuristic: capitalised multi-word phrases)
    const entities = (text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}\b/g) ?? []).slice(0, 200);
    const uniqueEntities = new Set(entities).size;

    let score = 0;
    if (isDirectAnswer) score += 2;
    if (factDensity >= 0.3) score += 2;
    else if (factDensity >= 0.15) score += 1;
    if (uniqueEntities >= 10) score += 1;
    score = Math.min(score, 5);
    const status = score >= 4 ? "pass" : score >= 2 ? "warn" : "fail";
    return [
      makeCheck({
        analyzerKey: "ai-content-patterns",
        category: "content",
        scope: "page",
        name: "AI-Friendly Content Patterns",
        shortDescription: "Direct-answer leads, fact density, entities",
        status,
        score,
        maxScore: 5,
        message: `${isDirectAnswer ? "Direct-answer lead" : "Soft lead"}; fact density ${(factDensity * 100).toFixed(0)}%; ${uniqueEntities} named entities.`,
        evidence: { isDirectAnswer, firstPara: firstPara.slice(0, 200), factDensity, uniqueEntities },
        fixSuggestion:
          status === "pass"
            ? "Content reads like material AI engines can quote."
            : "Open with a direct definition/answer. Use specific facts (numbers, dates, places) and entity names instead of vague language.",
        llmFixAvailable: status !== "pass",
        pageUrl: page.url,
      }),
    ];
  },
};
