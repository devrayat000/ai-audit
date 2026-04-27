import { makeCheck } from "./base";
import type { SiteAnalyzer } from "./base";

export const httpsSecurityAnalyzer: SiteAnalyzer = {
  key: "https-security",
  scope: "site",
  run(site) {
    const isHttps = site.rootUrl.startsWith("https://");
    const hsts = !!site.homepageHeaders["strict-transport-security"];
    let score = 0;
    if (isHttps) score += 5;
    if (site.redirectsHttps) score += 2;
    if (hsts) score += 2;
    if (site.certValid) score += 1;
    const status = score >= 9 ? "pass" : score >= 5 ? "warn" : "fail";
    return [
      makeCheck({
        analyzerKey: "https-security",
        category: "security",
        scope: "site",
        name: "HTTPS & Security Headers",
        shortDescription: "TLS, redirects, HSTS",
        status,
        score,
        maxScore: 10,
        message: `${isHttps ? "HTTPS on" : "Not on HTTPS"}; ${site.redirectsHttps ? "HTTP→HTTPS redirect" : "no HTTP redirect"}; ${hsts ? "HSTS present" : "no HSTS header"}.`,
        evidence: { isHttps, hsts, redirectsHttps: site.redirectsHttps, certValid: site.certValid },
        fixSuggestion: !isHttps
          ? "Move the site to HTTPS with a valid certificate (Let's Encrypt is free)."
          : !hsts
            ? "Add `Strict-Transport-Security: max-age=63072000; includeSubDomains` header."
            : "Looks healthy.",
      }),
    ];
  },
};
