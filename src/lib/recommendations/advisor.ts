import * as cheerio from "cheerio";
import type { CheckResult, PageData, SiteData } from "../types";
import { templateForIndustry, faqPageSchema, breadcrumbSchema } from "./schema-templates";
import type { ExtractedFacts } from "./schema-templates";
import { INDUSTRY_GUIDANCE } from "./industry-rules";

export function extractFacts(homepage: PageData | undefined, site: SiteData): ExtractedFacts {
  const facts: ExtractedFacts = {
    rootUrl: site.rootUrl,
    name: "",
    description: "",
    url: site.rootUrl,
  };
  if (!homepage) return facts;
  const $ = cheerio.load(homepage.renderedHtml || homepage.rawHtml);
  facts.name =
    $('meta[property="og:site_name"]').attr("content")?.trim() ||
    $("title").first().text().split(/[|\-—–]/)[0]?.trim() ||
    site.domain;
  facts.description =
    $('meta[name="description"]').attr("content")?.trim() ||
    $('meta[property="og:description"]').attr("content")?.trim() ||
    "";
  facts.heroImage =
    $('meta[property="og:image"]').attr("content") ||
    $("img").first().attr("src") ||
    "";
  const phone = $('a[href^="tel:"]').first().attr("href")?.replace(/^tel:/, "");
  if (phone) facts.phone = phone.trim();
  const email = $('a[href^="mailto:"]').first().attr("href")?.replace(/^mailto:/, "");
  if (email) facts.email = email;
  return facts;
}

export interface RuleBasedRecommendation {
  type: "schema-template" | "industry-checklist" | "code-snippet";
  title: string;
  body: string;
  language?: "json" | "html" | "txt";
}

export function ruleBasedFor(check: CheckResult, site: SiteData, homepage?: PageData): RuleBasedRecommendation[] {
  const out: RuleBasedRecommendation[] = [];
  const facts = extractFacts(homepage, site);

  if (check.analyzerKey === "schema-markup") {
    const tpl = templateForIndustry(site.industry, facts);
    out.push({
      type: "schema-template",
      title: `Industry-appropriate JSON-LD for ${site.industry}`,
      body: `<script type="application/ld+json">\n${JSON.stringify(tpl, null, 2)}\n</script>`,
      language: "html",
    });
    out.push({
      type: "schema-template",
      title: "BreadcrumbList template",
      body: `<script type="application/ld+json">\n${JSON.stringify(
        breadcrumbSchema([
          { name: "Home", url: site.rootUrl },
          { name: "[Section]", url: `${site.rootUrl}/[section]` },
        ]),
        null,
        2
      )}\n</script>`,
      language: "html",
    });
    out.push({
      type: "schema-template",
      title: "FAQPage template",
      body: `<script type="application/ld+json">\n${JSON.stringify(
        faqPageSchema([
          { q: "[Common question?]", a: "[Direct answer.]" },
          { q: "[Another question?]", a: "[Direct answer.]" },
        ]),
        null,
        2
      )}\n</script>`,
      language: "html",
    });
    out.push({
      type: "industry-checklist",
      title: `${site.industry} schema must-haves`,
      body: INDUSTRY_GUIDANCE[site.industry].schemaTypes.map((t) => `- ${t}`).join("\n"),
      language: "txt",
    });
  }

  if (check.analyzerKey === "llms-txt") {
    out.push({
      type: "code-snippet",
      title: "Starter /llms.txt",
      body: `# ${facts.name || site.domain}\n\n> ${facts.description || "[One-line site description]"}\n\n## Key pages\n\n- [${facts.name || "Home"}](${site.rootUrl}): Overview\n- [About](${site.rootUrl}/about): Who we are\n- [Contact](${site.rootUrl}/contact): How to reach us\n\n## Optional\n\n- [Pricing](${site.rootUrl}/pricing): Plans and pricing\n`,
      language: "txt",
    });
  }

  if (check.analyzerKey === "ai-bot-access") {
    out.push({
      type: "code-snippet",
      title: "robots.txt that allows AI crawlers",
      body:
        "User-agent: *\nAllow: /\n\n" +
        ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-Web", "PerplexityBot", "Google-Extended", "CCBot", "Applebot-Extended", "Amazonbot", "Meta-ExternalAgent"]
          .map((b) => `User-agent: ${b}\nAllow: /\n`)
          .join("\n") +
        `\nSitemap: ${site.rootUrl.replace(/\/$/, "")}/sitemap.xml\n`,
      language: "txt",
    });
  }

  if (check.analyzerKey === "mobile-viewport") {
    out.push({
      type: "code-snippet",
      title: "Viewport meta tag",
      body: `<meta name="viewport" content="width=device-width, initial-scale=1">`,
      language: "html",
    });
  }

  if (check.analyzerKey === "https-security") {
    out.push({
      type: "code-snippet",
      title: "HSTS header",
      body: `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`,
      language: "txt",
    });
  }

  return out;
}
