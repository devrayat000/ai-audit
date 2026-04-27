import * as cheerio from "cheerio";
import { makeCheck } from "./base";
import type { PageAnalyzer } from "./base";

export const mobileAnalyzer: PageAnalyzer = {
  key: "mobile-viewport",
  scope: "page",
  run(page) {
    const $ = cheerio.load(page.renderedHtml || page.rawHtml);
    const vp = $('meta[name="viewport"]').attr("content") ?? "";
    const ok = /width\s*=\s*device-width/i.test(vp);
    return [
      makeCheck({
        analyzerKey: "mobile-viewport",
        category: "performance",
        scope: "page",
        name: "Mobile Viewport",
        shortDescription: "Responsive meta viewport",
        status: ok ? "pass" : "fail",
        score: ok ? 3 : 0,
        maxScore: 3,
        message: ok ? "Viewport set for responsive layout." : "Missing or invalid <meta name='viewport'>.",
        evidence: { viewport: vp },
        fixSuggestion: ok
          ? "OK"
          : 'Add `<meta name="viewport" content="width=device-width, initial-scale=1">` to <head>.',
        pageUrl: page.url,
      }),
    ];
  },
};
