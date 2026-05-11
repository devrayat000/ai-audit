import type { PublishedSite, RestaurantData } from "@/lib/sites/types";

export function restaurantJsonLd(site: PublishedSite): object[] {
  const d = site.data as RestaurantData;
  const out: object[] = [];

  out.push({
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: d.name,
    description: d.description,
    image: d.hero.image?.url ?? d.gallery[0]?.url,
    url: site.meta.canonical,
    servesCuisine: d.cuisine,
    priceRange: d.priceRange ?? "$$",
    telephone: d.contact.phone,
    email: d.contact.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: d.contact.street,
      addressLocality: d.contact.city,
      addressRegion: d.contact.region,
      postalCode: d.contact.postalCode,
      addressCountry: d.contact.country,
    },
    openingHoursSpecification: (d.hours ?? []).map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: h.day,
      opens: h.opens,
      closes: h.closes,
    })),
    acceptsReservations: !!d.reservationUrl,
    menu: d.menu ? site.meta.canonical + "#menu" : undefined,
    sameAs: Object.values(d.social).filter(Boolean),
  });

  if (d.menu) {
    out.push({
      "@context": "https://schema.org",
      "@type": "Menu",
      name: `${d.name} Menu`,
      hasMenuSection: d.menu.sections.map((s) => ({
        "@type": "MenuSection",
        name: s.title,
        hasMenuItem: s.items.map((item) => ({
          "@type": "MenuItem",
          name: item.name,
          description: item.description,
          offers: item.price
            ? {
                "@type": "Offer",
                price: item.price,
                priceCurrency: inferCurrency(item.price),
              }
            : undefined,
        })),
      })),
    });
  }

  if (site.geo?.faqs && site.geo.faqs.length > 0) {
    out.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: site.geo.faqs.map((qa) => ({
        "@type": "Question",
        name: qa.q,
        acceptedAnswer: { "@type": "Answer", text: qa.a },
      })),
    });
  }

  return out;
}

function inferCurrency(price: string): string {
  if (/¥|円|JPY/.test(price)) return "JPY";
  if (/€|EUR/.test(price)) return "EUR";
  if (/£|GBP/.test(price)) return "GBP";
  if (/₹|INR/.test(price)) return "INR";
  if (/৳|BDT/.test(price)) return "BDT";
  return "USD";
}
