import { makeCheck } from "./base";
import type { SiteAnalyzer } from "./base";

export const sitemapAnalyzer: SiteAnalyzer = {
  key: "sitemap",
  scope: "site",
  run(site) {
    const has = site.sitemapUrls.length > 0;
    const referenced = !!site.robotsTxt && /sitemap:/i.test(site.robotsTxt);
    let score = 0;
    if (has) score += 3;
    if (referenced) score += 2;
    return [
      makeCheck({
        analyzerKey: "sitemap",
        category: "access",
        scope: "site",
        name: "Sitemap",
        shortDescription: "XML sitemap discoverable",
        status: has ? (referenced ? "pass" : "warn") : "fail",
        score,
        maxScore: 5,
        message: has
          ? `${site.sitemapUrls.length} URLs found. ${referenced ? "Referenced from robots.txt." : "Not referenced from robots.txt."}`
          : "No sitemap.xml found.",
        evidence: { count: site.sitemapUrls.length, referenced },
        fixSuggestion: has
          ? "Add `Sitemap: https://yourdomain.com/sitemap.xml` to robots.txt."
          : "Generate a sitemap.xml and serve it at /sitemap.xml. Reference it from robots.txt.",
      }),
    ];
  },
};
