import type { PublishedSite, RestaurantData } from "@/lib/sites/types";
import {
  Accessibility,
  Baby,
  BookOpen,
  Clock,
  CreditCard,
  DoorOpen,
  Flame,
  Languages,
  Leaf,
  Mail,
  MapPin,
  Navigation,
  Phone,
  Shirt,
  Sparkles,
  Star,
  Train,
  Utensils,
  Wifi,
} from "lucide-react";
import type { GeoEnrichment, WebFacts } from "@/lib/sites/types";
import { restaurantJsonLd } from "./schema";
import { proxied } from "./image";
import { RestaurantNav } from "./RestaurantNav";
import { RestaurantFooter } from "./RestaurantFooter";
import { ReviewsSection } from "./ReviewsSection";
import {
  buildNavLinks,
  buildReservationCta,
  formatAddress,
  mapEmbedSrc,
  nextOpenSummary,
  rankInteriors,
  shortBrand,
  splitParagraphs,
} from "./shared";

interface Props {
  site: PublishedSite;
}

const DAY_ORDER = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export function RestaurantHome({ site }: Props) {
  const d = site.data as RestaurantData;
  const heroImg = proxied(d.hero.image?.url);
  const interiors = rankInteriors(
    d.gallery.filter((g) => /^https?:\/\//i.test(g.url)),
  );
  const aboutImage = interiors[0] ?? d.gallery[0];
  const menuSections = d.menu?.sections ?? [];
  const featured = pickFeatured(menuSections, interiors, 6, site.geo?.signatureDishes);
  const jsonLd = restaurantJsonLd(site);
  const navLinks = buildNavLinks(site);
  const reservationCta = buildReservationCta(site);
  const atmosphereTags = site.geo?.atmosphereTags ?? [];

  const cityLine = [d.contact.city, d.contact.region]
    .filter(Boolean)
    .join(", ");

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
        currentPath="/"
        transparentTop
      />

      <main>
        {/* Hero */}
        <section
          id="top"
          className="relative min-h-screen flex items-center justify-center overflow-hidden"
        >
          {heroImg ? (
            <img
              src={heroImg}
              alt={`${d.name}${d.cuisine?.length ? ` — ${d.cuisine.join(", ")} restaurant` : " restaurant"}${cityLine ? ` in ${cityLine}` : ""}`}
              className="absolute inset-0 h-full w-full object-cover"
              loading="eager"
              decoding="async"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[#3a2418] via-[#241410] to-[#0e0a08]" />
          )}
          <div className="absolute inset-0 hero-overlay" />

          <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
            <p className="font-sans text-[11px] uppercase tracking-[0.35em] text-white/65 mb-6 fade-up">
              {[cityLine, d.cuisine?.[0]].filter(Boolean).join(" · ") ||
                "Welcome"}
            </p>

            <h1 className="font-serif text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-light text-white leading-none tracking-tight mb-6 fade-up text-balance">
              {d.hero.heading ?? d.name}
            </h1>

            {(d.hero.sub || d.description) && (
              <p className="font-sans text-base md:text-lg text-white/70 max-w-xl mx-auto leading-relaxed mb-10 fade-up text-balance">
                {d.hero.sub ?? d.description}
              </p>
            )}

            <div className="flex items-center justify-center gap-4 mb-10 fade-up">
              <div className="h-px w-12 bg-gold/70" />
              <div className="w-1.5 h-1.5 rounded-full bg-gold/70" />
              <div className="h-px w-12 bg-gold/70" />
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14 fade-up">
              {menuSections.length > 0 && (
                <a
                  href="/menu"
                  className="w-full sm:w-auto font-sans text-xs tracking-[0.2em] uppercase px-8 py-4 border border-white/60 text-white hover:bg-white/10 transition-all duration-200 min-w-[160px] text-center"
                >
                  View Menu
                </a>
              )}
              <a
                href="/reservation"
                className="w-full sm:w-auto font-sans text-xs tracking-[0.2em] uppercase px-8 py-4 bg-gold text-ink hover:bg-gold/90 transition-all duration-200 min-w-[160px] text-center"
              >
                Reserve Table
              </a>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 fade-up">
              {cityLine && <HeroBadge icon={MapPin} text={cityLine} />}
              {d.priceRange && <HeroBadge icon={Star} text={d.priceRange} />}
              {d.cuisine?.[0] && (
                <HeroBadge icon={Sparkles} text={d.cuisine.join(" · ")} />
              )}
              {d.reservationUrl && (
                <HeroBadge icon={Clock} text="Reservations" />
              )}
              {atmosphereTags.slice(0, 3).map((tag) => (
                <HeroBadge key={tag} icon={Flame} text={tag} />
              ))}
            </div>
          </div>

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-60">
            <span className="font-sans text-[10px] uppercase tracking-[0.3em] text-white">
              Scroll
            </span>
            <div className="w-px h-10 bg-gradient-to-b from-white/60 to-transparent animate-pulse" />
          </div>
        </section>

        {/* About */}
        {(site.geo?.summary ||
          site.geo?.about ||
          d.about ||
          (d.highlights && d.highlights.length > 0)) && (
          <article id="about" className="py-14 md:py-24 bg-background">
            <div className="max-w-7xl mx-auto px-6 lg:px-10">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
                {aboutImage ? (
                  <div className="relative aspect-[4/5] overflow-hidden">
                    <img
                      src={proxied(aboutImage.url)}
                      alt={aboutImage.alt ?? `Inside ${d.name}`}
                      className="absolute inset-0 h-full w-full object-cover"
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute -bottom-4 -right-4 w-full h-full border border-gold/30 pointer-events-none" />
                  </div>
                ) : (
                  <div className="aspect-[4/5] bg-secondary border border-border" />
                )}

                <div className="lg:pl-4">
                  <p className="font-sans text-[10px] uppercase tracking-[0.3em] text-gold mb-4">
                    Our Story
                  </p>
                  <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl font-light text-foreground leading-tight mb-6 text-balance">
                    The Art of {d.cuisine?.[0] ?? "Hospitality"}
                  </h2>
                  <div className="section-divider mb-8" />
                  <div className="space-y-5 text-muted-foreground font-sans text-sm md:text-base leading-relaxed">
                    {splitParagraphs(
                      site.geo?.summary ??
                        site.geo?.about ??
                        d.about ??
                        d.description ??
                        "",
                    ).map((para, i) => (
                      <p key={i}>{para}</p>
                    ))}
                  </div>

                  {(d.highlights?.length ?? 0) > 0 && (
                    <div className="mt-10 grid grid-cols-3 gap-6 border-t border-border pt-8">
                      {(d.highlights ?? []).slice(0, 3).map((h, i) => (
                        <div key={i} className="text-center">
                          <p className="font-serif text-2xl md:text-3xl font-light text-gold mb-2 leading-snug">
                            {abbreviateHighlight(h)}
                          </p>
                          <p className="font-sans text-[11px] uppercase tracking-[0.15em] text-muted-foreground leading-snug">
                            {h.length > 40 ? `${h.slice(0, 40)}…` : h}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </article>
        )}

        {/* Signature Dishes */}
        {featured.length > 0 && (
          <section
            id="dishes"
            className="py-14 md:py-24 bg-secondary/40 border-t border-border"
          >
            <div className="max-w-7xl mx-auto px-6 lg:px-10">
              <div className="text-center mb-10">
                <p className="font-sans text-[10px] uppercase tracking-[0.3em] text-gold mb-3">
                  Featured Dishes
                </p>
                <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl font-light text-foreground text-balance">
                  Signature Creations
                </h2>
                <p className="font-sans text-sm md:text-base text-muted-foreground mt-4 max-w-lg mx-auto leading-relaxed">
                  Highlights from our kitchen — what guests come back for.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                {featured.map((dish, i) => (
                  <article
                    key={`${dish.name}-${i}`}
                    className="group bg-card border border-border overflow-hidden hover:shadow-xl hover:border-gold/40 hover:-translate-y-1 transition-all duration-300"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                      {dish.imageUrl ? (
                        <img
                          src={proxied(dish.imageUrl)}
                          alt={dish.name}
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/40">
                          <Utensils size={40} />
                        </div>
                      )}
                      {i === 0 && (
                        <span className="absolute top-3 left-3 flex items-center gap-1 px-2.5 py-1 bg-white/95 backdrop-blur-sm text-[10px] font-sans uppercase tracking-wider shadow-sm">
                          <Flame size={10} className="text-gold" />
                          <span className="text-foreground/70">Signature</span>
                        </span>
                      )}
                    </div>

                    <div className="p-5">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-serif text-lg font-medium text-foreground leading-snug">
                          {dish.name}
                        </h3>
                        {dish.price && (
                          <span className="font-serif text-base text-gold shrink-0 pt-0.5 tabular-nums">
                            {dish.price}
                          </span>
                        )}
                      </div>
                      {dish.sectionTitle && (
                        <p className="font-sans text-[11px] tracking-[0.1em] uppercase text-muted-foreground mb-3">
                          {dish.sectionTitle}
                        </p>
                      )}
                      {dish.description && (
                        <p className="font-sans text-xs md:text-sm text-muted-foreground leading-relaxed line-clamp-4">
                          {dish.description}
                        </p>
                      )}
                    </div>
                  </article>
                ))}
              </div>

              {menuSections.length > 0 && (
                <div className="text-center mt-12">
                  <a
                    href="/menu"
                    className="inline-block font-sans text-xs tracking-[0.2em] uppercase px-8 py-4 border border-foreground text-foreground hover:bg-foreground hover:text-background transition-all duration-200"
                  >
                    View Full Menu
                  </a>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Gallery preview — interiors */}
        {interiors.length > 0 && (
          <section
            id="gallery"
            className="py-14 md:py-20 bg-background border-t border-border"
          >
            <div className="max-w-7xl mx-auto px-6 lg:px-10">
              <div className="mb-8">
                <p className="font-sans text-[10px] uppercase tracking-[0.3em] text-gold mb-2">
                  Gallery
                </p>
                <h2 className="font-serif text-4xl md:text-5xl font-light text-foreground text-balance">
                  The Full Experience
                </h2>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {interiors.slice(0, 6).map((img, i) => (
                  <div
                    key={`${img.url}-${i}`}
                    className="group relative aspect-square overflow-hidden"
                  >
                    <img
                      src={proxied(img.url)}
                      alt={img.alt ?? `${d.name} interior photo ${i + 1}`}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.06]"
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300" />
                    {img.alt && (
                      <p className="absolute bottom-4 left-4 right-4 font-sans text-[10px] tracking-[0.25em] uppercase text-white opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-300 truncate">
                        {img.alt}
                      </p>
                    )}
                    <span className="absolute bottom-0 left-0 h-[2px] w-0 group-hover:w-full bg-gold transition-all duration-500" />
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Reviews + AI Summary */}
        <ReviewsSection
          summary={site.geo?.summary}
          ratingSummary={site.geo?.ratingSummary}
          reviews={site.geo?.reviews}
        />

        {/* Location */}
        <section
          id="visit"
          className="py-14 md:py-24 bg-background border-t border-border"
        >
          <div className="max-w-7xl mx-auto px-6 lg:px-10">
            <div className="text-center mb-10">
              <p className="font-sans text-[10px] uppercase tracking-[0.3em] text-gold mb-3">
                Getting Here
              </p>
              <h2 className="font-serif text-4xl md:text-5xl font-light text-foreground text-balance">
                Find Us{cityLine ? ` in ${d.contact.city ?? ""}` : ""}
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-10">
              <div className="lg:col-span-3 relative aspect-[4/3] lg:aspect-auto lg:min-h-[420px] bg-muted border border-border overflow-hidden">
                {mapEmbedSrc(d) ? (
                  <iframe
                    title={`${d.name} location map`}
                    src={mapEmbedSrc(d)!}
                    className="w-full h-full absolute inset-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                    <MapPin size={32} className="text-gold" />
                    <p className="font-sans text-sm">Map unavailable</p>
                  </div>
                )}
              </div>

              <div className="lg:col-span-2 flex flex-col gap-7">
                {(d.contact.street || d.contact.city) && (
                  <InfoRow icon={MapPin} label="Address">
                    <p className="font-sans text-sm text-foreground leading-relaxed">
                      {d.contact.street && (
                        <>
                          {d.contact.street}
                          <br />
                        </>
                      )}
                      {[d.contact.city, d.contact.region, d.contact.postalCode]
                        .filter(Boolean)
                        .join(", ")}
                      {d.contact.country && (
                        <>
                          <br />
                          {d.contact.country}
                        </>
                      )}
                    </p>
                  </InfoRow>
                )}

                {d.contact.phone && (
                  <InfoRow icon={Phone} label="Phone">
                    <a
                      href={`tel:${d.contact.phone}`}
                      className="font-sans text-sm text-foreground hover:text-gold transition-colors"
                    >
                      {d.contact.phone}
                    </a>
                  </InfoRow>
                )}

                {d.contact.email && (
                  <InfoRow icon={Mail} label="Email">
                    <a
                      href={`mailto:${d.contact.email}`}
                      className="font-sans text-sm text-foreground break-all hover:text-gold transition-colors"
                    >
                      {d.contact.email}
                    </a>
                  </InfoRow>
                )}

                {nextOpenSummary(d) && (
                  <InfoRow icon={Clock} label="Hours">
                    <p className="font-sans text-sm text-foreground">
                      {nextOpenSummary(d)}
                    </p>
                    {d.reservationUrl && (
                      <p className="font-sans text-xs text-muted-foreground mt-1">
                        Reservations recommended.
                      </p>
                    )}
                  </InfoRow>
                )}

                {(d.contact.street || d.contact.city) && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formatAddress(d))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-auto inline-flex items-center justify-center gap-2 font-sans text-xs tracking-[0.2em] uppercase px-5 py-3 border border-gold text-gold hover:bg-gold hover:text-background transition-all"
                  >
                    <Navigation size={14} />
                    Open in Maps
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Quick info */}
        <QuickInfoSection data={d} webFacts={site.geo?.webFacts} />

        {/* Hours table */}
        {d.hours && d.hours.length > 0 && (
          <section className="py-14 md:py-20 bg-background border-t border-border">
            <div className="max-w-3xl mx-auto px-6 lg:px-10">
              <div className="text-center mb-8">
                <p className="font-sans text-[10px] uppercase tracking-[0.3em] text-gold mb-3">
                  Opening Hours
                </p>
                <h2 className="font-serif text-3xl md:text-4xl font-light text-foreground">
                  When We&apos;re Open
                </h2>
              </div>
              <table className="w-full">
                <tbody>
                  {DAY_ORDER.map((day) => {
                    const entry = d.hours?.find((h) => h.day === day);
                    return (
                      <tr
                        key={day}
                        className="border-b border-border last:border-b-0"
                      >
                        <th
                          scope="row"
                          className="py-3 text-left font-serif text-base font-medium text-foreground"
                        >
                          {day}
                        </th>
                        <td className="py-3 text-right font-sans text-sm tabular-nums text-muted-foreground">
                          {!entry
                            ? "—"
                            : entry.closed
                              ? "Closed"
                              : entry.opens && entry.closes
                                ? `${entry.opens} – ${entry.closes}`
                                : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      <RestaurantFooter
        site={site}
        navLinks={navLinks}
        reservationCta={{ label: "Reserve a Table", href: "/reservation" }}
      />
    </div>
  );
}

interface FeaturedDish {
  name: string;
  description?: string;
  price?: string;
  sectionTitle?: string;
  imageUrl?: string;
}

function pickFeatured(
  sections: { title: string; items: { name: string; description?: string; price?: string; image?: { url: string } }[] }[],
  gallery: { url: string }[],
  limit: number,
  signatureDishes?: GeoEnrichment["signatureDishes"],
): FeaturedDish[] {
  const withDetails: FeaturedDish[] = [];
  const fallback: FeaturedDish[] = [];

  for (const s of sections) {
    for (const item of s.items) {
      const dish: FeaturedDish = {
        name: item.name,
        description: item.description,
        price: item.price,
        sectionTitle: s.title,
        imageUrl: item.image?.url,
      };
      if (item.description || item.price) withDetails.push(dish);
      else fallback.push(dish);
    }
  }

  // Fold web-discovered signature dishes — prepend ones not already present in
  // the scraped menu, so they appear even when the scraped menu is empty.
  const scrapedNames = new Set(
    [...withDetails, ...fallback].map((d) => d.name.toLowerCase()),
  );
  const webSignatures: FeaturedDish[] = (signatureDishes ?? [])
    .filter((sd) => !scrapedNames.has(sd.name.toLowerCase()))
    .map((sd) => ({
      name: sd.name,
      description: sd.description,
      sectionTitle: sd.why,
    }));

  const picks = [...webSignatures, ...withDetails, ...fallback].slice(0, limit);
  return picks.map((p, i) => ({
    ...p,
    imageUrl: p.imageUrl ?? gallery[i % Math.max(gallery.length, 1)]?.url,
  }));
}

function HeroBadge({
  icon: Icon,
  text,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  text: string;
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/15 rounded-full">
      <Icon size={12} className="text-gold shrink-0" />
      <span className="font-sans text-xs text-white/85">{text}</span>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4">
      <Icon size={18} className="text-gold shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="font-sans text-xs uppercase tracking-[0.15em] text-muted-foreground mb-1">
          {label}
        </p>
        {children}
      </div>
    </div>
  );
}

function QuickInfoSection({
  data,
  webFacts,
}: {
  data: RestaurantData;
  webFacts?: WebFacts;
}) {
  type Item = {
    Icon: React.ComponentType<{ size?: number; className?: string }>;
    label: string;
    value: string;
    sub: string;
    iconBg: string;
    iconColor: string;
  };
  const items: Item[] = [];
  const wf = webFacts ?? {};

  const hoursSummary = nextOpenSummary(data);
  if (hoursSummary) {
    items.push({
      Icon: Clock,
      label: "Hours",
      value: hoursSummary,
      sub: wf.bestTimeToVisit ?? (data.reservationUrl ? "Reservations recommended" : "Walk-ins welcome"),
      iconBg: "bg-amber-50",
      iconColor: "text-amber-500",
    });
  }

  const priceValue = wf.averageCost ?? data.priceRange;
  if (priceValue) {
    items.push({
      Icon: CreditCard,
      label: "Price",
      value: priceValue,
      sub: wf.paymentMethods?.slice(0, 3).join(" · ") ?? "Cards accepted",
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-500",
    });
  }

  if (data.cuisine?.length) {
    items.push({
      Icon: Utensils,
      label: "Cuisine",
      value: data.cuisine[0],
      sub: data.cuisine.slice(1, 3).join(" · ") || "House specialty",
      iconBg: "bg-rose-50",
      iconColor: "text-rose-500",
    });
  }

  if (wf.transit) {
    items.push({
      Icon: Train,
      label: "Transit",
      value: firstSentence(wf.transit, 40),
      sub: wf.transit,
      iconBg: "bg-sky-50",
      iconColor: "text-sky-500",
    });
  }

  if (wf.languagesSpoken?.length) {
    items.push({
      Icon: Languages,
      label: "Languages",
      value: wf.languagesSpoken.slice(0, 2).join(", "),
      sub:
        wf.languagesSpoken.length > 2
          ? `+${wf.languagesSpoken.length - 2} more`
          : "Spoken by staff",
      iconBg: "bg-indigo-50",
      iconColor: "text-indigo-500",
    });
  } else {
    items.push({
      Icon: Wifi,
      label: "English Menu",
      value: "Available",
      sub: "Tourist-friendly",
      iconBg: "bg-indigo-50",
      iconColor: "text-indigo-500",
    });
  }

  if (wf.dressCode) {
    items.push({
      Icon: Shirt,
      label: "Dress Code",
      value: wf.dressCode,
      sub: "Plan ahead",
      iconBg: "bg-stone-50",
      iconColor: "text-stone-500",
    });
  }

  if (wf.accessibility) {
    items.push({
      Icon: Accessibility,
      label: "Accessibility",
      value: firstSentence(wf.accessibility, 40),
      sub: wf.accessibility,
      iconBg: "bg-teal-50",
      iconColor: "text-teal-500",
    });
  }

  if (wf.dietaryOptions?.length) {
    items.push({
      Icon: Leaf,
      label: "Dietary",
      value: wf.dietaryOptions[0],
      sub: wf.dietaryOptions.slice(1).join(" · ") || "Options available",
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-600",
    });
  }

  if (wf.familyFriendly) {
    items.push({
      Icon: Baby,
      label: "Family",
      value: firstSentence(wf.familyFriendly, 40),
      sub: wf.familyFriendly,
      iconBg: "bg-orange-50",
      iconColor: "text-orange-400",
    });
  } else if (data.contact.country) {
    items.push({
      Icon: Baby,
      label: "Family",
      value: "All Welcome",
      sub: "Children's portions",
      iconBg: "bg-orange-50",
      iconColor: "text-orange-400",
    });
  }

  if (data.reservationUrl || wf.reservationPolicy) {
    items.push({
      Icon: BookOpen,
      label: "Reservations",
      value: data.reservationUrl ? "Online Booking" : "Required",
      sub: wf.reservationPolicy ?? "Book ahead of visit",
      iconBg: "bg-violet-50",
      iconColor: "text-violet-500",
    });
  }

  if (data.orderUrl || wf.takeaway || wf.delivery) {
    items.push({
      Icon: DoorOpen,
      label: "Takeaway",
      value: wf.takeaway ?? (data.orderUrl ? "Order Online" : "Available"),
      sub: wf.delivery ?? "Pickup available",
      iconBg: "bg-sky-50",
      iconColor: "text-sky-600",
    });
  }

  if (items.length === 0) return null;

  return (
    <section className="py-14 md:py-24 bg-secondary/30 border-t border-border">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="text-center mb-10">
          <p className="font-sans text-[10px] uppercase tracking-[0.3em] text-gold mb-3">
            Good to Know
          </p>
          <h2 className="font-serif text-4xl md:text-5xl font-light text-foreground text-balance">
            Practical Information
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {items.slice(0, 8).map(({ Icon, label, value, sub, iconBg, iconColor }) => (
            <div
              key={label}
              className="group bg-card rounded-xl border border-border p-5 flex items-start gap-4 hover:shadow-lg hover:border-gold/30 hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300"
            >
              <div
                className={`shrink-0 w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}
              >
                <Icon size={18} className={iconColor} />
              </div>
              <div className="min-w-0">
                <p className="font-sans text-sm font-semibold text-foreground leading-snug truncate">
                  {value}
                </p>
                <p className="font-sans text-[10px] uppercase tracking-[0.12em] text-muted-foreground mt-0.5 mb-1">
                  {label}
                </p>
                <p className="font-sans text-xs text-muted-foreground leading-relaxed line-clamp-2">
                  {sub}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function abbreviateHighlight(text: string): string {
  const m = text.match(/(\d[\d.,+]*)/);
  if (m) return m[1];
  const word = text.split(/\s+/)[0] ?? "";
  return word.slice(0, 5).toUpperCase();
}

function firstSentence(text: string, max: number): string {
  const piece = text.split(/[.;,—]/)[0]?.trim() ?? text;
  if (piece.length <= max) return piece;
  return piece.slice(0, max - 1).trimEnd() + "…";
}
