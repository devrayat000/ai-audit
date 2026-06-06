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

export interface DetectedSourceLanguage {
  /** ISO 639-1 code (or "und" when not determined). */
  language: string;
  /** ISO 15924 script. */
  script: string;
  /** "ltr" | "rtl" — currently informational only on the template side. */
  direction: "ltr" | "rtl";
  /** True if we already saw English text in the source — translation can short-circuit. */
  isEnglish: boolean;
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

export interface GuestReview {
  /** Reviewer display name (or initials). */
  name: string;
  /** Country emoji flag (e.g. "🇯🇵"). Optional. */
  flag?: string;
  /** Country / region of reviewer. */
  country?: string;
  /** 1–5 stars. */
  rating: number;
  /** The review text — trimmed, no surrounding quotes. */
  text: string;
  /** Source platform name (e.g. "Google", "TripAdvisor", "Tabelog"). */
  platform?: string;
  /** Human-readable date (e.g. "March 2025") or year. */
  date?: string;
  /** Source URL if web_search returned one. */
  sourceUrl?: string;
}

export interface RatingSummary {
  /** Average score, typically 0–5 (will display as `score`/5). */
  score: number;
  /** Total number of reviews counted across platforms. */
  count: number;
  /** Optional list of platforms aggregated. */
  platforms?: string[];
}

/**
 * Practical facts pulled from the web (Google Maps, TripAdvisor, official
 * directories) that the scraped HTML usually doesn't surface cleanly.
 */
export interface WebFacts {
  /** e.g. "3 minute walk from Ginza Station (Exit A2)". */
  transit?: string;
  /** Parking guidance. */
  parking?: string;
  /** Payment methods accepted, e.g. ["Visa", "Mastercard", "Cash"]. */
  paymentMethods?: string[];
  /** Languages spoken by staff, e.g. ["English", "Japanese"]. */
  languagesSpoken?: string[];
  /** Dress code, e.g. "Smart casual". */
  dressCode?: string;
  /** Accessibility notes, e.g. "Step-free entrance, wheelchair-accessible WC". */
  accessibility?: string;
  /** Child/family policy summary. */
  familyFriendly?: string;
  /** Pet policy summary. */
  petPolicy?: string;
  /** Takeaway availability. */
  takeaway?: string;
  /** Delivery availability. */
  delivery?: string;
  /** Reservation policy summary (walk-in OK? days in advance?). */
  reservationPolicy?: string;
  /** Dietary options served, e.g. ["Vegetarian", "Vegan", "Halal", "Gluten-free"]. */
  dietaryOptions?: string[];
  /** Best time to visit / typical wait time / busy hours. */
  bestTimeToVisit?: string;
  /** Wi-Fi availability. */
  wifi?: string;
  /** Average meal cost per person, e.g. "¥15,000–25,000". */
  averageCost?: string;
}

export interface SignatureDish {
  name: string;
  description?: string;
  /** Why it's notable (most-ordered / chef's pick / press-mentioned). */
  why?: string;
}

export interface GeoEnrichment {
  /** One-paragraph AI-friendly summary fronting the site. */
  summary?: string;
  /** Rewritten about copy. Keep facts intact. */
  about?: string;
  /** Curated FAQ that AI engines can quote. */
  faqs?: FaqQa[];
  /** Aggregate rating + platform list — pulled via web_search. */
  ratingSummary?: RatingSummary;
  /** Quoted guest reviews — pulled via web_search. */
  reviews?: GuestReview[];
  /** Practical facts pulled from the web. */
  webFacts?: WebFacts;
  /** Most-ordered / press-mentioned signature dishes (may include some not on the scraped menu). */
  signatureDishes?: SignatureDish[];
  /** Atmosphere tags, e.g. ["intimate", "romantic", "lively"]. */
  atmosphereTags?: string[];
  /** Cuisine list discovered via web (only used if scrape didn't catch it). */
  discoveredCuisine?: string[];
  /** Price range discovered via web (only used if scrape didn't catch it). */
  discoveredPriceRange?: string;
  /** Social links discovered via web (only used to fill missing scraped fields). */
  discoveredSocial?: Partial<SocialLinks>;
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
  /** Detected source-language metadata (pre-translation). */
  source?: DetectedSourceLanguage;
  /** True once the data fields have been translated to English. */
  translated?: boolean;
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
