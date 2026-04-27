import type { Industry } from "../types";

export interface IndustryGuidance {
  mustHaves: string[];
  schemaTypes: string[];
  promptHints: string[];
}

export const INDUSTRY_GUIDANCE: Record<Industry, IndustryGuidance> = {
  restaurant: {
    mustHaves: [
      "Menu page with item names, descriptions, prices",
      "Opening hours visible + in OpeningHoursSpecification schema",
      "Address + phone, ideally tap-to-call",
      "Photos of dishes with descriptive alt text",
      "Reservation link or phone CTA",
    ],
    schemaTypes: ["Restaurant", "Menu", "OpeningHoursSpecification", "PostalAddress"],
    promptHints: [
      "Lead with cuisine, location, signature dish.",
      "Use entity names: chef, neighbourhood, dish names.",
      "Mention dietary options (vegan, gluten-free) explicitly.",
    ],
  },
  travel: {
    mustHaves: [
      "Destination pages with TouristAttraction schema",
      "Pricing & duration upfront",
      "Reviews / ratings if available",
      "Clear booking CTA above the fold",
    ],
    schemaTypes: ["TravelAgency", "TouristAttraction", "LodgingBusiness", "Trip"],
    promptHints: [
      "Lead with destination + experience type.",
      "Use specific durations, prices, group sizes.",
    ],
  },
  service: {
    mustHaves: [
      "LocalBusiness schema with NAP (name/address/phone)",
      "Service pages per offering",
      "Service area cities listed",
      "Trust signals: licenses, years in business, testimonials",
    ],
    schemaTypes: ["LocalBusiness", "Service", "Organization"],
    promptHints: [
      "Lead with service + city served + years experience.",
      "Use specific certifications, license numbers.",
    ],
  },
  ecommerce: {
    mustHaves: [
      "Product schema with price, availability, currency",
      "Product images with alt text describing the product",
      "Reviews / aggregate ratings",
      "Clear shipping & return info",
    ],
    schemaTypes: ["Product", "Offer", "AggregateOffer", "Organization"],
    promptHints: [
      "Lead with product + key spec + use case.",
      "Avoid marketing fluff; use technical specifications.",
    ],
  },
  blog: {
    mustHaves: [
      "Article schema with author + datePublished + dateModified",
      "Author bio with credentials",
      "Citations / references for facts",
    ],
    schemaTypes: ["Article", "BlogPosting", "Person", "Organization"],
    promptHints: [
      "Lead with the answer to the article's title question.",
      "Use H2/H3 questions readers actually ask.",
    ],
  },
  general: {
    mustHaves: [
      "Organization schema",
      "Clear About + Contact links",
      "Site description with what you do, for whom, where",
    ],
    schemaTypes: ["Organization", "WebSite"],
    promptHints: ["Lead with what the site is, in one sentence."],
  },
};
