import type { PublishedSite, RestaurantData } from "@/lib/sites/types";
import {
  Baby,
  BookOpen,
  ChevronRight,
  Clock,
  CreditCard,
  DoorOpen,
  ExternalLink,
  Flame,
  Leaf,
  Mail,
  MapPin,
  Navigation,
  Phone,
  Sparkles,
  Star,
  Utensils,
  Wifi,
} from "lucide-react";
import { restaurantJsonLd } from "./schema";
import { proxied } from "./image";
import { RestaurantNav } from "./RestaurantNav";

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

export function RestaurantTemplate({ site }: Props) {
  const d = site.data as RestaurantData;
  const heroImg = proxied(d.hero.image?.url);
  const gallery = d.gallery.filter((g) => /^https?:\/\//i.test(g.url));
  const aboutImage = gallery[1] ?? gallery[0];
  const menuSections = d.menu?.sections ?? [];
  const totalDishes = menuSections.reduce((a, s) => a + s.items.length, 0);
  const featured = pickFeatured(menuSections, gallery, 6);
  const faqs =
    site.geo?.faqs && site.geo.faqs.length > 0
      ? site.geo.faqs
      : fallbackFaqs(d);
  const jsonLd = restaurantJsonLd(site, { faqs });

  const cityLine = [d.contact.city, d.contact.region]
    .filter(Boolean)
    .join(", ");

  const navLinks: { href: string; label: string }[] = [];
  if (d.about || site.geo?.about || site.geo?.summary)
    navLinks.push({ href: "#about", label: "Story" });
  if (featured.length > 0) navLinks.push({ href: "#dishes", label: "Dishes" });
  if (menuSections.length > 0) navLinks.push({ href: "#menu", label: "Menu" });
  if (gallery.length > 1) navLinks.push({ href: "#gallery", label: "Gallery" });
  if (faqs.length > 0) navLinks.push({ href: "#faq", label: "FAQ" });
  navLinks.push({ href: "#visit", label: "Visit" });

  const reservationCta =
    d.hero.cta ??
    (d.reservationUrl
      ? { label: "Reserve", href: d.reservationUrl }
      : undefined);

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
                  href="#menu"
                  className="w-full sm:w-auto font-sans text-xs tracking-[0.2em] uppercase px-8 py-4 border border-white/60 text-white hover:bg-white/10 transition-all duration-200 min-w-[160px] text-center"
                >
                  View Menu
                </a>
              )}
              {reservationCta && (
                <a
                  href={reservationCta.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto font-sans text-xs tracking-[0.2em] uppercase px-8 py-4 bg-gold text-ink hover:bg-gold/90 transition-all duration-200 min-w-[160px] text-center"
                >
                  {reservationCta.label}
                </a>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 fade-up">
              {cityLine && (
                <HeroBadge icon={MapPin} text={cityLine} />
              )}
              {d.priceRange && <HeroBadge icon={Star} text={d.priceRange} />}
              {d.cuisine?.[0] && (
                <HeroBadge icon={Sparkles} text={d.cuisine.join(" · ")} />
              )}
              {d.reservationUrl && (
                <HeroBadge icon={Clock} text="Reservations" />
              )}
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
                    href="#menu"
                    className="inline-block font-sans text-xs tracking-[0.2em] uppercase px-8 py-4 border border-foreground text-foreground hover:bg-foreground hover:text-background transition-all duration-200"
                  >
                    View Full Menu
                  </a>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Full Menu */}
        {menuSections.length > 0 && (
          <section
            id="menu"
            className="py-14 md:py-24 bg-background border-t border-border"
          >
            <div className="max-w-7xl mx-auto px-6 lg:px-10">
              <div className="flex items-end justify-between gap-4 flex-wrap mb-10">
                <div>
                  <p className="font-sans text-[10px] uppercase tracking-[0.3em] text-gold mb-3">
                    Tasting List
                  </p>
                  <h2 className="font-serif text-4xl md:text-5xl font-light text-foreground text-balance">
                    The Menu
                  </h2>
                </div>
                <div className="font-sans text-xs uppercase tracking-[0.2em] text-muted-foreground border border-border px-3 py-2 flex items-center gap-2">
                  <Utensils size={12} className="text-gold" />
                  {totalDishes} {totalDishes === 1 ? "dish" : "dishes"}
                </div>
              </div>

              <div className="grid gap-8 md:gap-10 md:grid-cols-2">
                {menuSections.map((s, i) => (
                  <div
                    key={`${s.title}-${i}`}
                    className="bg-card border border-border p-6 md:p-7"
                  >
                    <div className="mb-5">
                      <h3 className="font-serif text-2xl md:text-3xl font-light text-foreground tracking-tight">
                        {s.title}
                      </h3>
                      <div className="section-divider mt-3" />
                    </div>
                    <div className="space-y-5">
                      {s.items.map((item, j) => (
                        <div
                          key={`${item.name}-${j}`}
                          className="border-b border-dashed border-border pb-4 last:border-b-0 last:pb-0"
                        >
                          <div className="flex items-start justify-between gap-3 mb-1">
                            <span className="font-serif text-base md:text-lg font-medium leading-snug text-foreground">
                              {item.name}
                            </span>
                            {item.price && (
                              <span className="shrink-0 font-serif text-base text-gold tabular-nums">
                                {item.price}
                              </span>
                            )}
                          </div>
                          {item.description && (
                            <p className="font-sans text-xs md:text-sm leading-relaxed text-muted-foreground">
                              {item.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* AI Review Summary */}
        {site.geo?.summary && (
          <section className="py-14 md:py-20 bg-secondary/40 border-t border-border">
            <div className="max-w-3xl mx-auto px-6 lg:px-10 text-center">
              <p className="font-sans text-[10px] uppercase tracking-[0.3em] text-gold mb-3">
                Guest Voices
              </p>
              <h2 className="font-serif text-4xl md:text-5xl font-light text-foreground mb-6 text-balance">
                What Brings Guests Back
              </h2>
              <div className="flex items-center justify-center gap-1.5 mb-8">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} size={16} className="fill-gold text-gold" />
                ))}
              </div>
              <div className="bg-card border border-border p-6 md:p-8 text-left hover:shadow-lg hover:border-gold/30 transition-all duration-300">
                <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-gold mb-3">
                  AI Review Summary
                </p>
                <p className="font-sans text-sm md:text-base text-muted-foreground leading-relaxed">
                  {site.geo.summary}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Gallery */}
        {gallery.length > 1 && (
          <section
            id="gallery"
            className="py-14 md:py-24 bg-background border-t border-border"
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
                {gallery.slice(0, 12).map((img, i) => (
                  <div
                    key={`${img.url}-${i}`}
                    className="group relative aspect-square overflow-hidden"
                  >
                    <img
                      src={proxied(img.url)}
                      alt={img.alt ?? `${d.name} photo ${i + 1}`}
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

        {/* FAQ */}
        {faqs.length > 0 && (
          <section
            id="faq"
            className="py-14 md:py-24 bg-secondary/40 border-t border-border"
          >
            <div className="max-w-4xl mx-auto px-6 lg:px-10">
              <div className="text-center mb-10">
                <p className="font-sans text-[10px] uppercase tracking-[0.3em] text-gold mb-3">
                  Good to Know
                </p>
                <h2 className="font-serif text-4xl md:text-5xl font-light text-foreground text-balance">
                  Frequently Asked Questions
                </h2>
              </div>
              <div className="space-y-3">
                {faqs.map((qa, i) => (
                  <details
                    key={i}
                    className="group bg-card border border-border px-5 py-4 hover:border-gold/30 transition-colors [&_summary::-webkit-details-marker]:hidden"
                  >
                    <summary className="flex cursor-pointer items-start justify-between gap-3 font-serif text-base md:text-lg font-medium leading-snug text-foreground">
                      <span>{qa.q}</span>
                      <ChevronRight className="mt-1 size-4 shrink-0 text-gold transition-transform group-open:rotate-90" />
                    </summary>
                    <p className="mt-3 font-sans text-sm leading-relaxed text-muted-foreground">
                      {qa.a}
                    </p>
                  </details>
                ))}
              </div>
            </div>
          </section>
        )}

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
        <QuickInfoSection data={d} />

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

      {/* Footer */}
      <footer className="bg-ink text-white/80">
        {reservationCta && (
          <div className="bg-[oklch(0.42_0.09_48)] border-b border-white/10">
            <div className="max-w-7xl mx-auto px-6 lg:px-10 py-14 flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <p className="font-sans text-xs uppercase tracking-[0.2em] text-gold mb-2">
                  Join Us
                </p>
                <h3 className="font-serif text-3xl md:text-4xl text-white text-balance">
                  Reserve Your Experience
                </h3>
              </div>
              <a
                href={reservationCta.href}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 font-sans text-xs tracking-widest uppercase px-8 py-4 bg-white text-ink hover:bg-white/90 transition-colors"
              >
                {reservationCta.label}
              </a>
            </div>
          </div>
        )}

        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 lg:gap-20">
            <div>
              <div className="flex flex-col leading-none mb-5">
                <span className="font-serif text-2xl font-semibold text-white tracking-wide">
                  {shortBrand(d.name)}
                </span>
                {d.cuisine?.[0] && (
                  <span className="font-sans text-[10px] uppercase tracking-[0.25em] text-white/40 mt-0.5">
                    {d.cuisine[0]}
                  </span>
                )}
              </div>
              {(d.description || d.about) && (
                <p className="font-sans text-sm leading-relaxed text-white/50 mb-8 line-clamp-4">
                  {d.description ?? d.about}
                </p>
              )}
              <div className="flex gap-4 flex-wrap">
                {d.social.instagram && (
                  <SocialLink href={d.social.instagram} label="Instagram" />
                )}
                {d.social.facebook && (
                  <SocialLink href={d.social.facebook} label="Facebook" />
                )}
                {d.social.twitter && (
                  <SocialLink href={d.social.twitter} label="X" />
                )}
                {d.social.youtube && (
                  <SocialLink href={d.social.youtube} label="YouTube" />
                )}
                {d.social.tiktok && (
                  <SocialLink href={d.social.tiktok} label="TikTok" />
                )}
                {d.social.line && (
                  <SocialLink href={d.social.line} label="LINE" />
                )}
              </div>
            </div>

            <div>
              <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-gold mb-6">
                Navigate
              </p>
              <ul className="flex flex-col gap-4">
                {navLinks.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className="font-sans text-sm text-white/55 hover:text-white transition-colors duration-200"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-gold mb-6">
                Contact
              </p>
              <ul className="flex flex-col gap-5">
                {(d.contact.street || d.contact.city) && (
                  <li className="flex gap-3 items-start">
                    <MapPin size={15} className="text-gold shrink-0 mt-0.5" />
                    <span className="font-sans text-sm text-white/55 leading-relaxed">
                      {d.contact.street && (
                        <>
                          {d.contact.street}
                          <br />
                        </>
                      )}
                      {[d.contact.city, d.contact.region]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  </li>
                )}
                {d.contact.phone && (
                  <li className="flex gap-3 items-center">
                    <Phone size={15} className="text-gold shrink-0" />
                    <a
                      href={`tel:${d.contact.phone}`}
                      className="font-sans text-sm text-white/55 hover:text-white transition-colors duration-200"
                    >
                      {d.contact.phone}
                    </a>
                  </li>
                )}
                {d.contact.email && (
                  <li className="flex gap-3 items-center">
                    <Mail size={15} className="text-gold shrink-0" />
                    <a
                      href={`mailto:${d.contact.email}`}
                      className="font-sans text-sm text-white/55 hover:text-white transition-colors duration-200 break-all"
                    >
                      {d.contact.email}
                    </a>
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10">
          <div className="max-w-7xl mx-auto px-6 lg:px-10 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="font-sans text-xs text-white/30">
              © {new Date().getFullYear()} {d.name}. All rights reserved.
            </p>
            <p className="font-sans text-xs text-white/30 uppercase tracking-[0.18em]">
              Restored from{" "}
              <a
                href={site.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white/60"
              >
                {safeHost(site.sourceUrl)}
              </a>
            </p>
          </div>
        </div>
      </footer>
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

  const picks = [...withDetails, ...fallback].slice(0, limit);
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

function QuickInfoSection({ data }: { data: RestaurantData }) {
  const items: {
    Icon: React.ComponentType<{ size?: number; className?: string }>;
    label: string;
    value: string;
    sub: string;
    iconBg: string;
    iconColor: string;
  }[] = [];

  const hoursSummary = nextOpenSummary(data);
  if (hoursSummary) {
    items.push({
      Icon: Clock,
      label: "Hours",
      value: hoursSummary,
      sub: data.reservationUrl ? "Reservations recommended" : "Walk-ins welcome",
      iconBg: "bg-amber-50",
      iconColor: "text-amber-500",
    });
  }

  if (data.priceRange) {
    items.push({
      Icon: CreditCard,
      label: "Price",
      value: data.priceRange,
      sub: "Cards accepted",
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

  if (data.reservationUrl) {
    items.push({
      Icon: BookOpen,
      label: "Reservations",
      value: "Online Booking",
      sub: "Book ahead of visit",
      iconBg: "bg-violet-50",
      iconColor: "text-violet-500",
    });
  }

  if (data.orderUrl) {
    items.push({
      Icon: DoorOpen,
      label: "Takeaway",
      value: "Order Online",
      sub: "Delivery available",
      iconBg: "bg-sky-50",
      iconColor: "text-sky-500",
    });
  }

  if ((data.highlights?.length ?? 0) > 0) {
    items.push({
      Icon: Leaf,
      label: "Highlights",
      value: data.highlights![0],
      sub: data.highlights![1] ?? "Crafted with care",
      iconBg: "bg-teal-50",
      iconColor: "text-teal-500",
    });
  }

  items.push({
    Icon: Wifi,
    label: "English Menu",
    value: "Available",
    sub: "Tourist-friendly",
    iconBg: "bg-indigo-50",
    iconColor: "text-indigo-500",
  });

  if (data.contact.country) {
    items.push({
      Icon: Baby,
      label: "Family",
      value: "All Welcome",
      sub: "Children's portions",
      iconBg: "bg-orange-50",
      iconColor: "text-orange-400",
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

function SocialLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-sans text-[11px] uppercase tracking-[0.2em] text-white/50 hover:text-gold transition-colors duration-200"
    >
      {label}
      <ExternalLink size={11} />
    </a>
  );
}

function nextOpenSummary(d: RestaurantData): string | null {
  if (!d.hours || d.hours.length === 0) return null;
  const open = d.hours.find((h) => !h.closed && h.opens && h.closes);
  if (!open) return null;
  return `${open.opens} – ${open.closes}`;
}

function formatAddress(d: RestaurantData): string {
  return [
    d.contact.street,
    d.contact.city,
    d.contact.region,
    d.contact.postalCode,
    d.contact.country,
  ]
    .filter(Boolean)
    .join(", ");
}

function mapEmbedSrc(d: RestaurantData): string | null {
  if (d.contact.mapEmbedUrl) return d.contact.mapEmbedUrl;
  const addr = formatAddress(d);
  if (!addr) return null;
  return `https://www.google.com/maps?q=${encodeURIComponent(addr)}&output=embed`;
}

function shortBrand(name: string): string {
  if (!name) return name;
  const first = name.split(/\s+/)[0];
  return first.length >= 3 ? first : name;
}

function abbreviateHighlight(text: string): string {
  const m = text.match(/(\d[\d.,+]*)/);
  if (m) return m[1];
  const word = text.split(/\s+/)[0] ?? "";
  return word.slice(0, 5).toUpperCase();
}

function splitParagraphs(text: string): string[] {
  if (!text) return [];
  // First split on existing paragraph breaks.
  const blocks = text
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const block of blocks) {
    const words = block.split(/\s+/);
    if (words.length <= 100) {
      out.push(block);
      continue;
    }
    // Split into ≤80-word chunks at sentence boundaries.
    const sentences = block.match(/[^.!?]+[.!?]+\s*/g) ?? [block];
    let buf: string[] = [];
    let bufWords = 0;
    for (const s of sentences) {
      const w = s.trim().split(/\s+/).length;
      if (bufWords + w > 80 && buf.length > 0) {
        out.push(buf.join(" ").trim());
        buf = [];
        bufWords = 0;
      }
      buf.push(s.trim());
      bufWords += w;
    }
    if (buf.length > 0) out.push(buf.join(" ").trim());
  }
  return out;
}

function fallbackFaqs(d: RestaurantData): { q: string; a: string }[] {
  const out: { q: string; a: string }[] = [];
  const cityLine = [d.contact.city, d.contact.region].filter(Boolean).join(", ");

  out.push({
    q: `Where is ${d.name} located?`,
    a:
      d.contact.street || cityLine
        ? `${d.name} is located at ${[d.contact.street, cityLine, d.contact.country].filter(Boolean).join(", ")}.`
        : `Visit ${d.name} — see the address and map directions in the Visit section.`,
  });

  if (d.hours && d.hours.length > 0) {
    const days = d.hours
      .filter((h) => !h.closed && h.opens && h.closes)
      .map((h) => `${h.day} ${h.opens}–${h.closes}`)
      .join(", ");
    out.push({
      q: `What are the opening hours at ${d.name}?`,
      a: days
        ? `Opening hours: ${days}.`
        : `Opening hours vary — see the schedule on the Visit section of this page.`,
    });
  } else {
    out.push({
      q: `When is ${d.name} open?`,
      a: `Opening hours are listed in the Visit section. Reservations recommended where available.`,
    });
  }

  if (d.cuisine?.length) {
    out.push({
      q: `What kind of food does ${d.name} serve?`,
      a: `${d.name} serves ${d.cuisine.join(", ")} cuisine${d.priceRange ? `. Price range: ${d.priceRange}` : ""}.`,
    });
  } else {
    out.push({
      q: `What is on the menu at ${d.name}?`,
      a: `Browse the full menu in the Menu section above. Highlights include signature dishes prepared daily.`,
    });
  }

  if (d.reservationUrl) {
    out.push({
      q: `How do I make a reservation at ${d.name}?`,
      a: `Reservations can be made online. Use the Reserve button at the top of the page to book directly.`,
    });
  } else if (d.contact.phone) {
    out.push({
      q: `How do I contact ${d.name}?`,
      a: `Call ${d.contact.phone}${d.contact.email ? ` or email ${d.contact.email}` : ""} to get in touch.`,
    });
  } else {
    out.push({
      q: `Is ${d.name} tourist friendly?`,
      a: `Yes — ${d.name} welcomes international visitors with an English menu, clear directions, and accessible information.`,
    });
  }

  return out.slice(0, 6);
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
