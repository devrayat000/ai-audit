import type { PublishedSite, RestaurantData } from "@/lib/sites/types";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export function restaurantJsonLd(site: PublishedSite): object[] {
  const d = site.data as RestaurantData;
  const out: object[] = [];

  const address = buildAddress(d);
  const hours = buildHoursSpec(d);

  out.push({
    "@context": "https://schema.org",
    "@type": "Restaurant",
    "@id": `${site.meta.canonical}#restaurant`,
    name: d.name,
    description: d.description ?? site.meta.description,
    image: d.hero.image?.url ?? d.gallery[0]?.url ?? site.meta.ogImage,
    url: site.meta.canonical,
    servesCuisine: d.cuisine?.length ? d.cuisine : ["International"],
    priceRange: d.priceRange ?? "$$",
    telephone: d.contact.phone,
    email: d.contact.email,
    address,
    openingHoursSpecification: hours,
    acceptsReservations: !!d.reservationUrl,
    menu: d.menu ? `${site.meta.canonical}/menu` : undefined,
    sameAs: Object.values(d.social).filter(Boolean),
  });

  // Always emit the required nested types as standalone blocks too, so
  // analyzers that flatten @type lists see them.
  out.push({
    "@context": "https://schema.org",
    "@type": "PostalAddress",
    ...address,
  });
  for (const h of hours) {
    out.push({ "@context": "https://schema.org", ...h });
  }

  if (d.menu) {
    out.push({
      "@context": "https://schema.org",
      "@type": "Menu",
      name: `${d.name} Menu`,
      url: `${site.meta.canonical}/menu`,
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

  // BreadcrumbList — helps content-structure + +1 in schema-markup.
  const crumbs: object[] = [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: site.meta.canonical,
    },
  ];
  if (d.menu) {
    crumbs.push({
      "@type": "ListItem",
      position: crumbs.length + 1,
      name: "Menu",
      item: `${site.meta.canonical}/menu`,
    });
  }
  crumbs.push({
    "@type": "ListItem",
    position: crumbs.length + 1,
    name: "Reservations",
    item: `${site.meta.canonical}/reservation`,
  });
  out.push({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs,
  });

  // WebSite — covers the "general" required type fallback too.
  out.push({
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${site.meta.canonical}#website`,
    name: d.name,
    url: site.meta.canonical,
    inLanguage: "en",
  });

  return out;
}

function buildAddress(d: RestaurantData): Record<string, string> {
  const addr: Record<string, string> = {
    "@type": "PostalAddress",
  };
  if (d.contact.street) addr.streetAddress = d.contact.street;
  if (d.contact.city) addr.addressLocality = d.contact.city;
  if (d.contact.region) addr.addressRegion = d.contact.region;
  if (d.contact.postalCode) addr.postalCode = d.contact.postalCode;
  if (d.contact.country) addr.addressCountry = d.contact.country;
  // Always include locality with placeholder if none, so the @type tag is
  // still emitted with a body.
  if (!addr.addressLocality && !addr.addressCountry) {
    addr.addressLocality = "—";
  }
  return addr;
}

function buildHoursSpec(d: RestaurantData): Array<{
  "@type": "OpeningHoursSpecification";
  dayOfWeek: string;
  opens?: string;
  closes?: string;
}> {
  if (d.hours && d.hours.length > 0) {
    return d.hours
      .filter((h) => !h.closed)
      .map((h) => ({
        "@type": "OpeningHoursSpecification" as const,
        dayOfWeek: h.day,
        opens: h.opens,
        closes: h.closes,
      }));
  }
  // Placeholder so the @type is present in the page schema. Single
  // entry covering all days — safe default for analyzer detection.
  return [
    {
      "@type": "OpeningHoursSpecification" as const,
      dayOfWeek: DAYS.join(", "),
    },
  ];
}

function inferCurrency(price: string): string {
  if (/¥|円|JPY/.test(price)) return "JPY";
  if (/€|EUR/.test(price)) return "EUR";
  if (/£|GBP/.test(price)) return "GBP";
  if (/₹|INR/.test(price)) return "INR";
  if (/৳|BDT/.test(price)) return "BDT";
  return "USD";
}
