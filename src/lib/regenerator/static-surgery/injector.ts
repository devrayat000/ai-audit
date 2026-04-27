import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import { templateForIndustry, faqPageSchema, breadcrumbSchema } from "../../recommendations/schema-templates";
import type { ExtractedFacts } from "../../recommendations/schema-templates";
import type { Industry } from "../../types";

export interface InjectorOptions {
  industry: Industry;
  facts: ExtractedFacts;
  pageUrl: string;
  rootUrl: string;
  applyFixes: Set<string>;
  enableFaq: boolean;
  faqQas?: { q: string; a: string }[];
}

function ensureHead($: CheerioAPI) {
  if ($("head").length === 0) {
    $("html").prepend("<head></head>");
  }
}

function injectMissingMeta($: CheerioAPI, name: string, content: string) {
  if ($(`meta[name="${name}"]`).length === 0) {
    $("head").append(`<meta name="${name}" content="${content.replace(/"/g, "&quot;")}">`);
  }
}

function injectMissingProp($: CheerioAPI, prop: string, content: string) {
  if ($(`meta[property="${prop}"]`).length === 0) {
    $("head").append(`<meta property="${prop}" content="${content.replace(/"/g, "&quot;")}">`);
  }
}

export function injectHead(html: string, opts: InjectorOptions): { html: string; applied: string[] } {
  const $ = cheerio.load(html, { xmlMode: false });
  ensureHead($);
  const applied: string[] = [];
  const facts = opts.facts;

  if (opts.applyFixes.has("language-attr")) {
    if (!$("html").attr("lang")) {
      $("html").attr("lang", "en");
      applied.push("language-attr");
    }
  }

  if (opts.applyFixes.has("mobile-viewport")) {
    if ($('meta[name="viewport"]').length === 0) {
      $("head").prepend('<meta name="viewport" content="width=device-width, initial-scale=1">');
      applied.push("mobile-viewport");
    }
  }

  if (opts.applyFixes.has("meta-tags")) {
    const title = $("title").first().text().trim() || facts.name;
    if (!title || title.length < 5) {
      $("title").remove();
      $("head").prepend(`<title>${facts.name}</title>`);
    }
    if (facts.description) {
      injectMissingMeta($, "description", facts.description);
    }
    injectMissingProp($, "og:title", title || facts.name);
    if (facts.description) injectMissingProp($, "og:description", facts.description);
    if (facts.heroImage) injectMissingProp($, "og:image", facts.heroImage);
    injectMissingProp($, "og:type", "website");
    injectMissingProp($, "og:url", opts.pageUrl);
    if ($('meta[name="twitter:card"]').length === 0) {
      $("head").append('<meta name="twitter:card" content="summary_large_image">');
    }
    applied.push("meta-tags");
  }

  if (opts.applyFixes.has("canonical")) {
    if ($('link[rel="canonical"]').length === 0) {
      $("head").append(`<link rel="canonical" href="${opts.pageUrl}">`);
      applied.push("canonical");
    }
  }

  if (opts.applyFixes.has("schema-markup")) {
    const tpl = templateForIndustry(opts.industry, facts);
    $("head").append(
      `<script type="application/ld+json">${JSON.stringify(tpl)}</script>`
    );
    const isHomepage = opts.pageUrl.replace(/\/$/, "") === opts.rootUrl.replace(/\/$/, "");
    if (!isHomepage) {
      const crumbs = [
        { name: "Home", url: opts.rootUrl },
        { name: facts.name || "Page", url: opts.pageUrl },
      ];
      $("head").append(
        `<script type="application/ld+json">${JSON.stringify(breadcrumbSchema(crumbs))}</script>`
      );
    }
    if (opts.enableFaq && opts.faqQas && opts.faqQas.length > 0) {
      $("head").append(
        `<script type="application/ld+json">${JSON.stringify(faqPageSchema(opts.faqQas))}</script>`
      );
    }
    applied.push("schema-markup");
  }

  return { html: $.html(), applied };
}
