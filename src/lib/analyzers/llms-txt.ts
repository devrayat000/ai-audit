import { makeCheck } from "./base";
import type { SiteAnalyzer } from "./base";

export const llmsTxtAnalyzer: SiteAnalyzer = {
  key: "llms-txt",
  scope: "site",
  run(site) {
    const has = !!site.llmsTxt && site.llmsTxt.length > 30;
    const hasFull = !!site.llmsFullTxt && site.llmsFullTxt.length > 100;
    let score = 0;
    let status: "pass" | "warn" | "fail" = "fail";
    if (has) {
      score += 14;
      const looksValid = /^#\s+/m.test(site.llmsTxt!) || /\n-\s*\[/.test(site.llmsTxt!);
      if (looksValid) score += 2;
      status = "warn";
    }
    if (hasFull) {
      score += 4;
    }
    if (has && hasFull) status = "pass";
    return [
      makeCheck({
        analyzerKey: "llms-txt",
        category: "access",
        scope: "site",
        name: "llms.txt Manifest",
        shortDescription: "Curated map for AI engines",
        status,
        score,
        maxScore: 20,
        message: has
          ? hasFull
            ? "/llms.txt and /llms-full.txt both present."
            : "/llms.txt present. /llms-full.txt missing."
          : "/llms.txt is missing. AI engines have no curated map of your site.",
        evidence: {
          llmsTxtLength: site.llmsTxt?.length ?? 0,
          llmsFullTxtLength: site.llmsFullTxt?.length ?? 0,
        },
        fixSuggestion: has
          ? "Add /llms-full.txt with full markdown of your most important pages for richer context."
          : "Create /llms.txt at the site root following the llmstxt.org spec — H1 with the site name, short description, and curated section links.",
        llmFixAvailable: !has,
      }),
    ];
  },
};
