import * as cheerio from "cheerio";
import { makeCheck } from "./base";
import type { PageAnalyzer } from "./base";

export const performanceAnalyzer: PageAnalyzer = {
  key: "performance",
  scope: "page",
  run(page) {
    const $ = cheerio.load(page.renderedHtml || page.rawHtml);
    const totalSize = (page.renderedHtml || "").length;
    const renderBlockingCss = $('head link[rel="stylesheet"]:not([media="print"])').length;
    const renderBlockingScripts = $("head script:not([async]):not([defer])[src]").length;
    const loadTime = page.loadTimeMs;

    let score = 10;
    if (totalSize > 1_500_000) score -= 3;
    else if (totalSize > 500_000) score -= 1;
    if (renderBlockingScripts > 2) score -= 2;
    if (renderBlockingCss > 4) score -= 1;
    if (loadTime > 5000) score -= 3;
    else if (loadTime > 3000) score -= 1;
    score = Math.max(0, score);

    const status = score >= 8 ? "pass" : score >= 5 ? "warn" : "fail";
    return [
      makeCheck({
        analyzerKey: "performance",
        category: "performance",
        scope: "page",
        name: "Performance Signals",
        shortDescription: "Page weight, blocking resources, load time",
        status,
        score,
        maxScore: 10,
        message: `${(totalSize / 1024).toFixed(0)} KB rendered HTML; ${renderBlockingScripts} blocking scripts; ${renderBlockingCss} blocking stylesheets; ${loadTime} ms load.`,
        evidence: { totalSize, renderBlockingScripts, renderBlockingCss, loadTimeMs: loadTime },
        fixSuggestion:
          status === "pass"
            ? "Performance looks fine."
            : "Defer non-critical scripts, inline critical CSS, and reduce HTML payload. Lazy-load below-the-fold images.",
        pageUrl: page.url,
      }),
    ];
  },
};
