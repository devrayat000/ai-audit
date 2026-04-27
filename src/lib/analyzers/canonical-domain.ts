import { makeCheck } from "./base";
import type { SiteAnalyzer } from "./base";

export const canonicalDomainAnalyzer: SiteAnalyzer = {
  key: "canonical-domain",
  scope: "site",
  run(site) {
    let score = 0;
    if (site.canonicalHostMatch) score += 3;
    if (site.redirectsHttps) score += 2;
    return [
      makeCheck({
        analyzerKey: "canonical-domain",
        category: "security",
        scope: "site",
        name: "Canonical Domain",
        shortDescription: "Single canonical host + protocol",
        status: score >= 5 ? "pass" : score >= 3 ? "warn" : "fail",
        score,
        maxScore: 5,
        message: `${site.canonicalHostMatch ? "www/non-www aligned" : "host inconsistency"}; ${site.redirectsHttps ? "HTTP→HTTPS" : "no HTTP redirect"}.`,
        evidence: { canonicalHostMatch: site.canonicalHostMatch, redirectsHttps: site.redirectsHttps },
        fixSuggestion:
          "Pick one canonical host (with or without www) and 301 the other. Force HTTPS via redirect + HSTS.",
      }),
    ];
  },
};
