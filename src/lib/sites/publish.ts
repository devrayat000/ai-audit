import { crawlSite } from "../crawler";
import { scrapeRestaurant } from "./scraper";
import type { PublishedSite, SiteIndustry } from "./types";

export interface PublishInput {
  sourceUrl: string;
  subdomain: string;
  industry: SiteIndustry;
  maxPages?: number;
}

function buildCanonical(subdomain: string): string {
  const apex = process.env.SITE_PUBLIC_APEX ?? "aivible.tokyo";
  return `https://${subdomain}.${apex}`;
}

function buildTemplateMeta(industry: SiteIndustry): {
  titleSuffix: string;
} {
  if (industry === "restaurant") return { titleSuffix: "— Menu, hours & reservations" };
  return { titleSuffix: "" };
}

/**
 * Scrape `sourceUrl`, build a typed site, persist it. Returns the assembled
 * PublishedSite. Caller writes it to blob.
 */
export async function buildPublishedSite(input: PublishInput): Promise<PublishedSite> {
  const { siteData, pages, errors } = await crawlSite(input.sourceUrl, {
    industry: input.industry === "restaurant" ? "restaurant" : "general",
    maxPages: Math.min(input.maxPages ?? 10, 25),
  });
  if (pages.length === 0) {
    throw new Error(`Could not crawl any pages from ${input.sourceUrl}: ${errors.join("; ")}`);
  }
  const homepage = pages.find((p) => p.url === siteData.rootUrl) ?? pages[0];

  if (input.industry === "restaurant") {
    const data = scrapeRestaurant(homepage, pages, siteData);
    const meta = buildTemplateMeta(input.industry);
    const ts = new Date().toISOString();
    return {
      subdomain: input.subdomain,
      industry: "restaurant",
      sourceUrl: input.sourceUrl,
      scrapedAt: ts,
      updatedAt: ts,
      meta: {
        title: `${data.name} ${meta.titleSuffix}`.trim(),
        description:
          data.description ??
          `${data.name}${data.contact.city ? ` in ${data.contact.city}` : ""}. View menu, hours, and contact info.`,
        ogImage: data.hero.image?.url ?? data.gallery[0]?.url,
        canonical: buildCanonical(input.subdomain),
      },
      data,
    };
  }

  // general fallback — reuse restaurant scraper to populate a generic site shape
  const restaurantLike = scrapeRestaurant(homepage, pages, siteData);
  const ts = new Date().toISOString();
  return {
    subdomain: input.subdomain,
    industry: "general",
    sourceUrl: input.sourceUrl,
    scrapedAt: ts,
    updatedAt: ts,
    meta: {
      title: restaurantLike.name,
      description: restaurantLike.description ?? restaurantLike.name,
      ogImage: restaurantLike.hero.image?.url,
      canonical: buildCanonical(input.subdomain),
    },
    data: {
      industry: "general",
      name: restaurantLike.name,
      tagline: restaurantLike.tagline,
      description: restaurantLike.description,
      hero: restaurantLike.hero,
      about: restaurantLike.about,
      highlights: restaurantLike.highlights,
      gallery: restaurantLike.gallery,
      contact: restaurantLike.contact,
      social: restaurantLike.social,
    },
  };
}
