import * as cheerio from "cheerio";
import { makeCheck } from "./base";
import type { PageAnalyzer } from "./base";

export const languageAnalyzer: PageAnalyzer = {
  key: "language-attr",
  scope: "page",
  run(page) {
    const $ = cheerio.load(page.renderedHtml || page.rawHtml);
    const lang = $("html").attr("lang")?.trim() ?? "";
    const ok = lang.length >= 2;
    return [
      makeCheck({
        analyzerKey: "language-attr",
        category: "structure",
        scope: "page",
        name: "html[lang]",
        shortDescription: "Language attribute set",
        status: ok ? "pass" : "fail",
        score: ok ? 2 : 0,
        maxScore: 2,
        message: ok ? `lang="${lang}"` : "<html> is missing the lang attribute.",
        evidence: { lang },
        fixSuggestion: ok ? "OK" : 'Set the page language: `<html lang="en">`.',
        pageUrl: page.url,
      }),
    ];
  },
};
