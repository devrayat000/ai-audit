/**
 * Typed shapes for scraped-site data that powers our hosted templates.
 *
 * Each industry has its own schema. A persisted site is one of these wrapped
 * with subdomain metadata.
 */

export type SiteIndustry = "restaurant" | "travel" | "service" | "general";

export interface ImageRef {
  url: string;
  alt?: string;
}

export interface OpeningHour {
  day:
    | "Monday"
    | "Tuesday"
    | "Wednesday"
    | "Thursday"
    | "Friday"
    | "Saturday"
    | "Sunday";
  opens?: string;
  closes?: string;
  closed?: boolean;
}

export interface MenuItem {
  name: string;
  description?: string;
  price?: string;
  category?: string;
  image?: ImageRef;
}

export interface MenuSection {
  title: string;
  items: MenuItem[];
}

export interface ContactInfo {
  phone?: string;
  email?: string;
  whatsapp?: string;
  street?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  mapEmbedUrl?: string;
  lat?: number;
  lng?: number;
}

export interface SocialLinks {
  instagram?: string;
  facebook?: string;
  twitter?: string;
  tiktok?: string;
  youtube?: string;
  line?: string;
}

export interface RestaurantData {
  industry: "restaurant";
  name: string;
  tagline?: string;
  description?: string;
  cuisine?: string[];
  priceRange?: string;
  hero: {
    heading?: string;
    sub?: string;
    image?: ImageRef;
    cta?: { label: string; href: string };
  };
  about?: string;
  highlights?: string[];
  menu?: { sections: MenuSection[] };
  gallery: ImageRef[];
  hours?: OpeningHour[];
  contact: ContactInfo;
  social: SocialLinks;
  reservationUrl?: string;
  orderUrl?: string;
}

export interface GeneralSiteData {
  industry: "general";
  name: string;
  tagline?: string;
  description?: string;
  hero: {
    heading?: string;
    sub?: string;
    image?: ImageRef;
    cta?: { label: string; href: string };
  };
  about?: string;
  highlights?: string[];
  gallery: ImageRef[];
  contact: ContactInfo;
  social: SocialLinks;
}

export type AnySiteData = RestaurantData | GeneralSiteData;

export interface FaqQa {
  q: string;
  a: string;
}

export interface GeoEnrichment {
  /** One-paragraph AI-friendly summary fronting the site. */
  summary?: string;
  /** Rewritten about copy. Keep facts intact. */
  about?: string;
  /** Curated FAQ that AI engines can quote. */
  faqs?: FaqQa[];
  /** Markdown body of /llms.txt (canonical short map). */
  llmsTxt?: string;
  /** Markdown body of /llms-full.txt (full fact dump). */
  llmsFullTxt?: string;
  /** Tagline/hero overrides from audit-informed rewrites. */
  hero?: { heading?: string; sub?: string };
  /** Optimized title/description per audit. */
  meta?: { title?: string; description?: string };
  /** Notes from the AI enrichment step (debug). */
  notes?: string[];
}

export interface PublishedSite {
  subdomain: string;
  industry: SiteIndustry;
  sourceUrl: string;
  /** ISO timestamps */
  scrapedAt: string;
  updatedAt: string;
  /** SEO-relevant overrides set in our template's <head> */
  meta: {
    title: string;
    description: string;
    ogImage?: string;
    canonical: string;
  };
  data: AnySiteData;
  /** GEO enrichment from the audit report + Claude (optional). */
  geo?: GeoEnrichment;
}
