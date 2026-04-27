import robotsParser from "robots-parser";
import { fetchText } from "../utils/http";
import { AI_BOTS } from "../utils/ai-bots";
import { makeCheck } from "./base";
import type { SiteAnalyzer } from "./base";
import type { CheckResult } from "../types";

export const aiBotAccessAnalyzer: SiteAnalyzer = {
  key: "ai-bot-access",
  scope: "site",
  async run(site) {
    const robotsUrl = `${new URL(site.rootUrl).origin}/robots.txt`;
    const parser = site.robotsTxt ? robotsParser(robotsUrl, site.robotsTxt) : null;

    const results: Record<string, { robotsAllowed: boolean; fetchStatus: number; blocked: boolean }> = {};
    let allowedCount = 0;
    let fetchOkCount = 0;
    const cfRayPresent = !!site.homepageHeaders["cf-ray"];

    await Promise.all(
      AI_BOTS.map(async (bot) => {
        const robotsAllowed = parser ? parser.isAllowed(site.rootUrl, bot.userAgent) ?? true : true;
        const r = await fetchText(site.rootUrl, { userAgent: bot.userAgent, timeoutMs: 10000 });
        const blocked = r.status === 403 || r.status === 401 || r.status === 429 || r.status === 451;
        results[bot.name] = {
          robotsAllowed,
          fetchStatus: r.status,
          blocked,
        };
        if (robotsAllowed) allowedCount++;
        if (r.status >= 200 && r.status < 400) fetchOkCount++;
      })
    );

    const total = AI_BOTS.length;
    const robotsRatio = allowedCount / total;
    const fetchRatio = fetchOkCount / total;
    const overallRatio = (robotsRatio + fetchRatio) / 2;

    const out: CheckResult[] = [];
    out.push(
      makeCheck({
        analyzerKey: "ai-bot-access",
        category: "access",
        scope: "site",
        name: "AI Bot Access",
        shortDescription: "AI crawlers can read your site",
        status: overallRatio >= 0.85 ? "pass" : overallRatio >= 0.5 ? "warn" : "fail",
        score: Math.round(overallRatio * 20),
        maxScore: 20,
        message: `${allowedCount}/${total} bots allowed in robots.txt; ${fetchOkCount}/${total} bots succeed at the WAF.`,
        evidence: { perBot: results, cfRayPresent },
        fixSuggestion:
          allowedCount < total
            ? "Update robots.txt to allow GPTBot, ClaudeBot, PerplexityBot, Google-Extended, and other AI crawlers."
            : fetchOkCount < total
              ? "robots.txt allows them but a WAF/CDN (likely Cloudflare) is blocking AI bots — adjust your bot-management rules."
              : "All AI bots can read your homepage. Keep monitoring.",
        llmFixAvailable: false,
      })
    );

    if (cfRayPresent) {
      const cfBlocked = Object.entries(results).filter(([, v]) => v.blocked);
      if (cfBlocked.length > 0) {
        out.push(
          makeCheck({
            analyzerKey: "ai-bot-access",
            category: "access",
            scope: "site",
            name: "Cloudflare AI Block Detected",
            shortDescription: "Cloudflare is blocking AI bots at the edge",
            status: "fail",
            score: 0,
            maxScore: 0,
            message: `Cloudflare (cf-ray header) is blocking ${cfBlocked.length} AI bots with 4xx responses, regardless of robots.txt.`,
            evidence: { blockedBots: cfBlocked.map(([n]) => n) },
            fixSuggestion:
              "In Cloudflare → Bots → AI Scrapers and Crawlers, allow the AI bots you want indexing your site.",
          })
        );
      }
    }

    return out;
  },
};
