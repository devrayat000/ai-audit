import { makeCheck } from "./base";
import type { PageAnalyzer } from "./base";
import tr from "text-readability";

export const readabilityAnalyzer: PageAnalyzer = {
  key: "readability",
  scope: "page",
  async run(page) {
    const text = (page.renderedText || "").trim();
    if (!text || text.length < 100) {
      return [
        {
          analyzerKey: "readability",
          category: "content",
          scope: "page",
          name: "Readability",
          shortDescription: "Flesch reading ease + sentence length",
          status: "warn",
          score: 1,
          maxScore: 5,
          message: "Not enough text to score readability.",
          evidence: { textLength: text.length },
          fixSuggestion:
            "Add more text content (~300 words minimum) so AI engines can extract meaningful answers.",
          llmFixAvailable: false,
          pageUrl: page.url,
        },
      ];
    }
    let flesch = 0;
    try {
      flesch = tr.fleschReadingEase(text);
    } catch {
      flesch = 0;
    }
    const sentences = text.split(/[.!?]+\s/).filter((s) => s.trim().length > 0);
    const avgWords =
      sentences.length > 0
        ? sentences.reduce((a, s) => a + s.split(/\s+/).length, 0) /
          sentences.length
        : 0;

    let score = 0;
    let status: "pass" | "warn" | "fail" = "fail";
    if (flesch >= 60) {
      score += 3;
      status = "pass";
    } else if (flesch >= 50) {
      score += 2;
      status = "warn";
    } else if (flesch >= 40) {
      score += 1;
      status = "warn";
    }
    if (avgWords <= 22 && avgWords > 0) score += 2;
    else if (avgWords <= 28) score += 1;

    return [
      makeCheck({
        analyzerKey: "readability",
        category: "content",
        scope: "page",
        name: "Readability",
        shortDescription: "Flesch reading ease + sentence length",
        status,
        score,
        maxScore: 5,
        message: `Flesch ${flesch.toFixed(1)}; avg sentence ${avgWords.toFixed(1)} words.`,
        evidence: { flesch, avgWords, sentenceCount: sentences.length },
        fixSuggestion:
          flesch >= 60 && avgWords <= 22
            ? "Reading level is good for general audiences."
            : "Shorten sentences (aim ≤22 words avg) and prefer plain language. Click 'Generate fix' for a rewrite.",
        llmFixAvailable: flesch < 60 || avgWords > 22,
        pageUrl: page.url,
      }),
    ];
  },
};
