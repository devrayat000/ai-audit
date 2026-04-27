import type { Industry } from "../types";

export interface ExtractedFacts {
  rootUrl: string;
  name: string;
  description: string;
  url: string;
  phone?: string;
  email?: string;
  streetAddress?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  heroImage?: string;
  cuisine?: string;
  priceRange?: string;
  menuUrl?: string;
}

export function organizationSchema(facts: ExtractedFacts): object {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: facts.name || "[Your business name]",
    url: facts.url,
    description: facts.description || "[Short description of what you do]",
    logo: facts.heroImage || "[URL to your logo]",
    contactPoint: facts.phone
      ? {
          "@type": "ContactPoint",
          telephone: facts.phone,
          contactType: "customer service",
        }
      : undefined,
  };
}

export function restaurantSchema(facts: ExtractedFacts): object {
  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: facts.name || "[Your restaurant name]",
    image: facts.heroImage || "[URL to hero image]",
    address: {
      "@type": "PostalAddress",
      streetAddress: facts.streetAddress || "[Street]",
      addressLocality: facts.city || "[City]",
      addressRegion: facts.region || "[Region]",
      postalCode: facts.postalCode || "[ZIP]",
      addressCountry: facts.country || "[Country code]",
    },
    servesCuisine: facts.cuisine || "[e.g., Italian]",
    priceRange: facts.priceRange || "$$",
    telephone: facts.phone || "[+1-555-...]",
    url: facts.url,
    menu: facts.menuUrl || `${facts.rootUrl}/menu`,
    acceptsReservations: true,
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        opens: "11:00",
        closes: "22:00",
      },
    ],
  };
}

export function travelSchema(facts: ExtractedFacts): object {
  return {
    "@context": "https://schema.org",
    "@type": "TravelAgency",
    name: facts.name || "[Your travel agency]",
    url: facts.url,
    image: facts.heroImage || "[URL to hero image]",
    description: facts.description || "[What you offer travellers]",
    telephone: facts.phone || "[+1-555-...]",
    address: {
      "@type": "PostalAddress",
      streetAddress: facts.streetAddress || "[Street]",
      addressLocality: facts.city || "[City]",
      addressCountry: facts.country || "[Country]",
    },
    areaServed: facts.region || "[Regions you serve]",
  };
}

export function localBusinessSchema(facts: ExtractedFacts): object {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: facts.name || "[Your business name]",
    image: facts.heroImage || "[URL to hero image]",
    url: facts.url,
    telephone: facts.phone || "[+1-555-...]",
    address: {
      "@type": "PostalAddress",
      streetAddress: facts.streetAddress || "[Street]",
      addressLocality: facts.city || "[City]",
      addressRegion: facts.region || "[Region]",
      postalCode: facts.postalCode || "[ZIP]",
      addressCountry: facts.country || "[Country]",
    },
    description: facts.description || "[Describe what you do]",
  };
}

export function productSchema(facts: ExtractedFacts): object {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: facts.name || "[Product name]",
    image: facts.heroImage || "[Product image URL]",
    description: facts.description || "[Product description]",
    offers: {
      "@type": "Offer",
      url: facts.url,
      priceCurrency: "USD",
      price: "0.00",
      availability: "https://schema.org/InStock",
    },
  };
}

export function articleSchema(facts: ExtractedFacts): object {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: facts.name || "[Article headline]",
    image: facts.heroImage || "[Header image URL]",
    author: { "@type": "Person", name: "[Author name]" },
    datePublished: "[YYYY-MM-DD]",
    dateModified: "[YYYY-MM-DD]",
    publisher: {
      "@type": "Organization",
      name: "[Publication name]",
      logo: { "@type": "ImageObject", url: "[Logo URL]" },
    },
    description: facts.description || "[Short summary]",
  };
}

export function templateForIndustry(industry: Industry, facts: ExtractedFacts): object {
  switch (industry) {
    case "restaurant":
      return restaurantSchema(facts);
    case "travel":
      return travelSchema(facts);
    case "service":
      return localBusinessSchema(facts);
    case "ecommerce":
      return productSchema(facts);
    case "blog":
      return articleSchema(facts);
    default:
      return organizationSchema(facts);
  }
}

export function faqPageSchema(qas: { q: string; a: string }[]): object {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: qas.map((qa) => ({
      "@type": "Question",
      name: qa.q,
      acceptedAnswer: { "@type": "Answer", text: qa.a },
    })),
  };
}

export function breadcrumbSchema(crumbs: { name: string; url: string }[]): object {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: c.url,
    })),
  };
}
