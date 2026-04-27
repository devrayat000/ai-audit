import * as cheerio from "cheerio";
import type { Industry } from "../types";

interface IndustryRule {
  industry: Industry;
  keywords: RegExp[];
  schemaTypes: string[];
}

const RULES: IndustryRule[] = [
  {
    industry: "restaurant",
    keywords: [
      /\b(menu|reservation|reservations|cuisine|chef|dish|appetizer|entree|wine list|tasting|brunch)\b/i,
      /\b(restaurant|bistro|trattoria|cafe|café|eatery|diner|bar & grill)\b/i,
    ],
    schemaTypes: ["Restaurant", "FoodEstablishment", "BarOrPub", "CafeOrCoffeeShop", "Menu"],
  },
  {
    industry: "travel",
    keywords: [
      /\b(book now|destinations|tour|tours|itinerary|hotel|resort|cruise|flight|vacation|holiday package)\b/i,
      /\b(travel agency|travel agent|tourism|getaway|excursion)\b/i,
    ],
    schemaTypes: [
      "TravelAgency",
      "TouristAttraction",
      "LodgingBusiness",
      "Hotel",
      "Resort",
      "Trip",
    ],
  },
  {
    industry: "ecommerce",
    keywords: [
      /\b(add to cart|checkout|shop now|free shipping|returns policy|product details|sku|in stock|out of stock)\b/i,
    ],
    schemaTypes: ["Product", "Offer", "AggregateOffer", "OnlineStore"],
  },
  {
    industry: "service",
    keywords: [
      /\b(book a consultation|free quote|our services|hire us|book appointment|estimate)\b/i,
      /\b(plumber|electrician|hvac|roofing|attorney|law firm|dentist|clinic|salon|spa)\b/i,
    ],
    schemaTypes: ["LocalBusiness", "Service", "ProfessionalService", "MedicalBusiness"],
  },
  {
    industry: "blog",
    keywords: [
      /\b(read more|posted on|by [A-Z][a-z]+|categories|tags|archive|subscribe to our newsletter)\b/i,
    ],
    schemaTypes: ["Blog", "BlogPosting", "Article", "NewsArticle"],
  },
];

export function detectIndustry(
  homepageHtml: string,
  schemaTypes: string[]
): { industry: Industry; confidence: number } {
  const $ = cheerio.load(homepageHtml);
  const text = $("body").text().slice(0, 20000).toLowerCase();
  let best: { industry: Industry; score: number } = { industry: "general", score: 0 };

  for (const rule of RULES) {
    let score = 0;
    for (const kw of rule.keywords) {
      const m = text.match(kw);
      if (m) score += 2;
    }
    for (const t of schemaTypes) {
      if (rule.schemaTypes.includes(t)) score += 5;
    }
    if (score > best.score) {
      best = { industry: rule.industry, score };
    }
  }

  const confidence = Math.min(1, best.score / 10);
  if (confidence < 0.4) return { industry: "general", confidence };
  return { industry: best.industry, confidence };
}
