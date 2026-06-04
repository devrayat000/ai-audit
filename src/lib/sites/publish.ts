import { crawlSite } from "../crawler";
import { scrapeRestaurant } from "./scraper";
import { detectSourceLanguage } from "./language-detect";
import type { PublishedSite, SiteIndustry } from "./types";

export interface PublishInput {
  sourceUrl: string;
  subdomain: string;
  industry: SiteIndustry;
  maxPages?: number;
}

function buildCanonical(subdomain: string): string {
  const apex = process.env.SITE_PUBLIC_APEX ?? "shorobik.com";
  return `https://${subdomain}.${apex}`;
}

/** Hit the 30–65 char sweet spot the meta-tags analyzer wants. */
function buildTitle(name: string, city: string | undefined, cuisineFirst: string | undefined): string {
  const suffixes = [
    cuisineFirst && city ? `— ${cuisineFirst} restaurant in ${city}` : null,
    city ? `— Restaurant in ${city} | Menu & Reservations` : null,
    cuisineFirst ? `— ${cuisineFirst} restaurant | Menu & Reservations` : null,
    "— Menu, hours & reservations",
  ].filter((x): x is string => !!x);
  for (const suffix of suffixes) {
    const candidate = `${name} ${suffix}`.trim();
    if (candidate.length >= 30 && candidate.length <= 65) return candidate;
  }
  // Fallback: truncate or pad.
  const base = `${name} — Menu, hours & reservations`;
  if (base.length > 65) return base.slice(0, 62).trimEnd() + "…";
  if (base.length < 30) return `${base} | Tourist favourite`;
  return base;
}

/** Hit the 70–160 char sweet spot. */
function buildDescription(
  baseDesc: string | undefined,
  name: string,
  city: string | undefined,
  cuisine: string[] | undefined,
  priceRange: string | undefined,
): string {
  const parts: string[] = [];
  if (baseDesc) parts.push(baseDesc.trim().replace(/\s+/g, " "));
  else {
    parts.push(
      `${name}${city ? ` in ${city}` : ""}${cuisine?.length ? ` serves ${cuisine.join(", ")} cuisine` : ""}.`,
    );
  }
  let out = parts.join(" ");
  // Pad if too short.
  const padHints: string[] = [];
  if (cuisine?.length && !out.toLowerCase().includes(cuisine[0].toLowerCase())) {
    padHints.push(`${cuisine.join(", ")} cuisine.`);
  }
  if (city && !out.toLowerCase().includes(city.toLowerCase())) {
    padHints.push(`Located in ${city}.`);
  }
  padHints.push("View menu, opening hours, address, and reservations.");
  if (priceRange) padHints.push(`Price range ${priceRange}.`);
  for (const pad of padHints) {
    if (out.length >= 70) break;
    out = `${out} ${pad}`.trim();
  }
  if (out.length > 160) out = out.slice(0, 157).trimEnd() + "…";
  return out;
}

function buildProxiedOgImage(canonical: string, srcUrl: string | undefined): string | undefined {
  if (!srcUrl || !/^https?:\/\//i.test(srcUrl)) return undefined;
  return `${canonical.replace(/\/$/, "")}/api/img?u=${encodeURIComponent(srcUrl)}`;
}

/**
 * Scrape `sourceUrl`, build a typed site (pre-translation, pre-enrichment).
 */
export async function buildPublishedSite(input: PublishInput): Promise<PublishedSite> {
  const { siteData, pages, errors } = await crawlSite(input.sourceUrl, {
    industry: input.industry === "restaurant" ? "restaurant" : "general",
    maxPages: Math.min(input.maxPages ?? 10, 25),
  });
  if (pages.length === 0) {
    throw new Error(
      `Could not crawl any pages from ${input.sourceUrl}: ${errors.join("; ")}`,
    );
  }
  const homepage = pages.find((p) => p.url === siteData.rootUrl) ?? pages[0];
  const source = detectSourceLanguage(homepage.renderedHtml || homepage.rawHtml);
  const ts = new Date().toISOString();

  if (input.industry === "restaurant") {
    const data = scrapeRestaurant(homepage, pages, siteData);
    const canonical = buildCanonical(input.subdomain);
    const rawOgImage = data.hero.image?.url ?? data.gallery[0]?.url;
    return {
      subdomain: input.subdomain,
      industry: "restaurant",
      sourceUrl: input.sourceUrl,
      source,
      translated: false,
      scrapedAt: ts,
      updatedAt: ts,
      meta: {
        title: buildTitle(data.name, data.contact.city, data.cuisine?.[0]),
        description: buildDescription(
          data.description,
          data.name,
          data.contact.city,
          data.cuisine,
          data.priceRange,
        ),
        ogImage: buildProxiedOgImage(canonical, rawOgImage),
        canonical,
      },
      data,
    };
  }

  const restaurantLike = scrapeRestaurant(homepage, pages, siteData);
  const canonical = buildCanonical(input.subdomain);
  return {
    subdomain: input.subdomain,
    industry: "general",
    sourceUrl: input.sourceUrl,
    source,
    translated: false,
    scrapedAt: ts,
    updatedAt: ts,
    meta: {
      title: buildTitle(
        restaurantLike.name,
        restaurantLike.contact.city,
        restaurantLike.cuisine?.[0],
      ),
      description: buildDescription(
        restaurantLike.description,
        restaurantLike.name,
        restaurantLike.contact.city,
        restaurantLike.cuisine,
        restaurantLike.priceRange,
      ),
      ogImage: buildProxiedOgImage(canonical, restaurantLike.hero.image?.url),
      canonical,
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
