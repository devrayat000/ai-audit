import type { PublishedSite, RestaurantData } from "@/lib/sites/types";
import { Utensils } from "lucide-react";
import { restaurantJsonLd } from "./schema";
import { proxied } from "./image";
import { RestaurantNav } from "./RestaurantNav";
import { RestaurantFooter } from "./RestaurantFooter";
import { MenuCategoryNav } from "./MenuCategoryNav";
import {
  buildNavLinks,
  buildReservationCta,
  rankInteriors,
  shortBrand,
} from "./shared";

interface Props {
  site: PublishedSite;
}

export function RestaurantMenu({ site }: Props) {
  const d = site.data as RestaurantData;
  const menuSections = d.menu?.sections ?? [];
  const navLinks = buildNavLinks(site);
  const reservationCta = buildReservationCta(site);
  const interiors = rankInteriors(
    d.gallery.filter((g) => /^https?:\/\//i.test(g.url)),
  );
  // Prefer a food-y image for the menu hero — last in interior ranking is
  // most likely a dish (lowest interior score). Fall back to hero/og image.
  const heroImg = proxied(
    menuFirstDishImage(menuSections) ??
      interiors[interiors.length - 1]?.url ??
      d.hero.image?.url,
  );
  const jsonLd = restaurantJsonLd(site);
  const categories = menuSections.map((s, i) => ({
    id: sectionId(s.title, i),
    label: s.title,
  }));
  const totalDishes = menuSections.reduce((a, s) => a + s.items.length, 0);

  return (
    <div className="bg-paper text-foreground font-sans min-h-screen">
      {jsonLd.map((block, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }}
        />
      ))}

      <RestaurantNav
        brand={shortBrand(d.name)}
        tagline={d.cuisine?.[0]}
        links={navLinks}
        cta={reservationCta}
        currentPath="/menu"
      />

      <main>
        {/* Hero */}
        <section className="relative pt-16 md:pt-20 h-64 md:h-80 overflow-hidden flex items-end">
          <div className="absolute inset-0">
            {heroImg ? (
              <img
                src={heroImg}
                alt={`Menu — ${d.name}`}
                className="absolute inset-0 h-full w-full object-cover"
                loading="eager"
                decoding="async"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-[#3a2418] via-[#241410] to-[#0e0a08]" />
            )}
            <div className="absolute inset-0 hero-overlay" />
          </div>
          <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 pb-10 w-full">
            <p className="font-sans text-[10px] uppercase tracking-[0.3em] text-gold mb-2">
              Tasting List
            </p>
            <h1 className="font-serif text-4xl md:text-6xl font-light text-white text-balance">
              Our Menu
            </h1>
            {totalDishes > 0 && (
              <p className="font-sans text-sm text-white/60 mt-2">
                {totalDishes} {totalDishes === 1 ? "dish" : "dishes"} across {menuSections.length} {menuSections.length === 1 ? "section" : "sections"}
              </p>
            )}
          </div>
        </section>

        {categories.length > 0 && <MenuCategoryNav categories={categories} />}

        {menuSections.length > 0 ? (
          <div className="max-w-7xl mx-auto px-6 lg:px-10 py-16 space-y-20">
            {menuSections.map((s, i) => (
              <section
                key={`${s.title}-${i}`}
                id={sectionId(s.title, i)}
                className="scroll-mt-32"
              >
                <div className="flex items-center gap-5 mb-8">
                  <h2 className="font-serif text-3xl md:text-4xl font-light text-foreground">
                    {s.title}
                  </h2>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {s.items.map((item, j) => (
                    <article
                      key={`${item.name}-${j}`}
                      className="group flex gap-4 bg-card border border-border p-4 hover:shadow-lg hover:border-gold/30 hover:-translate-y-0.5 transition-all duration-300"
                    >
                      <div className="relative shrink-0 w-20 h-20 sm:w-24 sm:h-24 overflow-hidden bg-muted">
                        {item.image?.url ? (
                          <img
                            src={proxied(item.image.url)}
                            alt={item.name}
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            loading="lazy"
                            decoding="async"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/40">
                            <Utensils size={20} />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-serif text-base font-medium text-foreground leading-snug">
                            {item.name}
                          </h3>
                          {item.price && (
                            <span className="font-serif text-base text-gold shrink-0 tabular-nums">
                              {item.price}
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <p className="font-sans text-xs text-muted-foreground leading-relaxed mt-1.5">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-6 lg:px-10 py-24 text-center">
            <p className="font-sans text-sm text-muted-foreground">
              The menu is currently being updated. Please contact us for the latest selection.
            </p>
          </div>
        )}

        {/* Reservation CTA */}
        <section className="py-20 bg-secondary/40 text-center border-t border-border">
          <p className="font-sans text-[10px] uppercase tracking-[0.3em] text-gold mb-3">
            Ready to Dine?
          </p>
          <h2 className="font-serif text-4xl md:text-5xl font-light text-foreground mb-6 text-balance">
            Secure Your Seat Tonight
          </h2>
          <p className="font-sans text-sm text-muted-foreground mb-8 max-w-sm mx-auto leading-relaxed">
            {d.reservationUrl
              ? "Book ahead to secure your table — popular times fill quickly."
              : "Contact us to plan your visit."}
          </p>
          <a
            href="/reservation"
            className="inline-block font-sans text-xs tracking-[0.2em] uppercase px-10 py-4 bg-foreground text-background hover:bg-gold hover:text-ink transition-colors duration-200"
          >
            Reserve a Table
          </a>
        </section>
      </main>

      <RestaurantFooter
        site={site}
        navLinks={navLinks}
        reservationCta={{ label: "Reserve a Table", href: "/reservation" }}
      />
    </div>
  );
}

function sectionId(title: string, idx: number): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || `section-${idx + 1}`;
}

function menuFirstDishImage(
  sections: { items: { image?: { url: string } }[] }[],
): string | undefined {
  for (const s of sections) {
    for (const item of s.items) {
      if (item.image?.url) return item.image.url;
    }
  }
  return undefined;
}
