import type { PublishedSite, RestaurantData } from "@/lib/sites/types";
import {
  AlertCircle,
  Clock,
  Mail,
  MapPin,
  Phone,
  Train,
  UtensilsCrossed,
  Users,
} from "lucide-react";
import { restaurantJsonLd } from "./schema";
import { proxied } from "./image";
import { RestaurantNav } from "./RestaurantNav";
import { RestaurantFooter } from "./RestaurantFooter";
import { ReservationForm } from "./ReservationForm";
import {
  buildNavLinks,
  buildReservationCta,
  mapEmbedSrc,
  rankInteriors,
  shortBrand,
} from "./shared";

interface Props {
  site: PublishedSite;
}

const POLICIES = [
  {
    icon: Clock,
    title: "Cancellation Policy",
    text: "Please cancel at least 24 hours in advance. Late cancellations or no-shows may incur a per-guest fee where applicable.",
  },
  {
    icon: AlertCircle,
    title: "Late Arrival",
    text: "Arrive on time where possible — tables are typically held for 15 minutes. Please call ahead if you are running late.",
  },
  {
    icon: Users,
    title: "Group Bookings",
    text: "Groups of 7 or more should request a reservation as early as possible. Private-dining options may be available on request.",
  },
  {
    icon: UtensilsCrossed,
    title: "Dietary Needs",
    text: "Tell us about allergies, dietary restrictions, or accessibility needs when booking — staff will accommodate where possible.",
  },
];

export function RestaurantReservation({ site }: Props) {
  const d = site.data as RestaurantData;
  const navLinks = buildNavLinks(site);
  const reservationCta = buildReservationCta(site);
  const jsonLd = restaurantJsonLd(site);
  const interiors = rankInteriors(
    d.gallery.filter((g) => /^https?:\/\//i.test(g.url)),
  );
  const heroImg = proxied(interiors[0]?.url ?? d.hero.image?.url);

  const contactInfo: { Icon: typeof Phone; label: string; value: string; href: string }[] = [];
  if (d.contact.phone)
    contactInfo.push({
      Icon: Phone,
      label: "Phone",
      value: d.contact.phone,
      href: `tel:${d.contact.phone.replace(/\s+/g, "")}`,
    });
  if (d.contact.email)
    contactInfo.push({
      Icon: Mail,
      label: "Email",
      value: d.contact.email,
      href: `mailto:${d.contact.email}`,
    });

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
        currentPath="/reservation"
      />

      <main>
        {/* Hero */}
        <section className="relative pt-16 md:pt-20 h-72 md:h-96 overflow-hidden flex items-end">
          <div className="absolute inset-0">
            {heroImg ? (
              <img
                src={heroImg}
                alt={`Reservations at ${d.name}`}
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
          <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 pb-12 w-full">
            <p className="font-sans text-[10px] uppercase tracking-[0.3em] text-gold mb-2">
              Reservations
            </p>
            <h1 className="font-serif text-4xl md:text-6xl font-light text-white text-balance">
              Book Your Table
            </h1>
            <p className="font-sans text-sm text-white/60 mt-2">
              Reserve a seat at {d.name} — confirmation within 24 hours
            </p>
          </div>
        </section>

        {/* Main content */}
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-16 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-16">
            {/* Left: form */}
            <div className="lg:col-span-2">
              <ReservationForm externalBookingUrl={d.reservationUrl} />
            </div>

            {/* Right: sidebar */}
            <aside className="flex flex-col gap-8">
              {contactInfo.length > 0 && (
                <div>
                  <p className="font-sans text-[10px] uppercase tracking-[0.3em] text-gold mb-5">
                    Contact Us
                  </p>
                  <ul className="flex flex-col gap-4">
                    {contactInfo.map(({ Icon, label, value, href }) => (
                      <li key={label}>
                        <a href={href} className="flex items-center gap-3 group">
                          <div className="w-8 h-8 border border-border flex items-center justify-center shrink-0 group-hover:border-gold group-hover:scale-110 transition-all duration-300">
                            <Icon
                              size={14}
                              className="text-muted-foreground group-hover:text-gold transition-colors duration-300"
                            />
                          </div>
                          <div>
                            <p className="font-sans text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                              {label}
                            </p>
                            <p className="font-sans text-sm text-foreground group-hover:text-gold transition-colors">
                              {value}
                            </p>
                          </div>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {d.hours && d.hours.length > 0 && (
                <div className="bg-secondary/50 border border-border p-5">
                  <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-4">
                    Opening Hours
                  </p>
                  <ul className="flex flex-col gap-2 font-sans text-sm">
                    {d.hours.map((h) => (
                      <li
                        key={h.day}
                        className="flex justify-between gap-4 border-b border-border last:border-0 pb-2 last:pb-0"
                      >
                        <span className="text-muted-foreground">{h.day}</span>
                        <span className="text-foreground tabular-nums">
                          {h.closed
                            ? "Closed"
                            : h.opens && h.closes
                              ? `${h.opens} – ${h.closes}`
                              : "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {d.reservationUrl && (
                <div className="bg-ink text-white p-6">
                  <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-gold mb-3">
                    Instant Booking
                  </p>
                  <h3 className="font-serif text-xl font-light text-white mb-3">
                    Book on the restaurant&apos;s own system
                  </h3>
                  <p className="font-sans text-xs text-white/55 leading-relaxed mb-5">
                    Skip the wait — confirm a table immediately via the
                    restaurant&apos;s reservation platform.
                  </p>
                  <a
                    href={d.reservationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block font-sans text-xs tracking-[0.15em] uppercase px-5 py-3 border border-white/30 text-white hover:bg-white/10 transition-colors"
                  >
                    Book Instantly
                  </a>
                </div>
              )}
            </aside>
          </div>
        </div>

        {/* Policies */}
        <section className="py-20 bg-secondary/40 border-t border-border">
          <div className="max-w-7xl mx-auto px-6 lg:px-10">
            <div className="text-center mb-12">
              <p className="font-sans text-[10px] uppercase tracking-[0.3em] text-gold mb-3">
                Good to Know
              </p>
              <h2 className="font-serif text-4xl font-light text-foreground text-balance">
                Restaurant Policies
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {POLICIES.map(({ icon: Icon, title, text }) => (
                <div
                  key={title}
                  className="group bg-card border border-border p-6 hover:shadow-lg hover:border-gold/30 hover:-translate-y-1 transition-all duration-300"
                >
                  <Icon
                    size={18}
                    className="text-gold mb-4 group-hover:scale-110 transition-transform duration-300"
                  />
                  <h3 className="font-sans text-sm font-semibold text-foreground mb-2">
                    {title}
                  </h3>
                  <p className="font-sans text-xs text-muted-foreground leading-relaxed">
                    {text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Mini map / location */}
        {(d.contact.street || d.contact.city) && (
          <section className="py-20 bg-background border-t border-border">
            <div className="max-w-7xl mx-auto px-6 lg:px-10">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
                <div>
                  <p className="font-sans text-[10px] uppercase tracking-[0.3em] text-gold mb-3">
                    Getting Here
                  </p>
                  <h2 className="font-serif text-3xl md:text-4xl font-light text-foreground mb-6 text-balance">
                    {d.contact.city
                      ? `Located in ${d.contact.city}`
                      : "Visit Us"}
                  </h2>
                  <div className="flex flex-col gap-4">
                    {(d.contact.street || d.contact.city) && (
                      <div className="flex gap-3 items-start">
                        <MapPin
                          size={16}
                          className="text-gold shrink-0 mt-0.5"
                        />
                        <p className="font-sans text-sm text-foreground leading-relaxed">
                          {[
                            d.contact.street,
                            d.contact.city,
                            d.contact.region,
                            d.contact.postalCode,
                            d.contact.country,
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                      </div>
                    )}
                    {d.contact.phone && (
                      <div className="flex gap-3 items-start">
                        <Train
                          size={16}
                          className="text-gold shrink-0 mt-0.5"
                        />
                        <p className="font-sans text-sm text-foreground">
                          Public transport details available on request — call{" "}
                          <a
                            href={`tel:${d.contact.phone}`}
                            className="text-gold hover:opacity-70"
                          >
                            {d.contact.phone}
                          </a>
                          .
                        </p>
                      </div>
                    )}
                  </div>
                  <a
                    href="/"
                    className="inline-block mt-6 font-sans text-xs tracking-[0.15em] uppercase text-gold border-b border-gold pb-0.5 hover:opacity-70 transition-opacity"
                  >
                    Full Directions
                  </a>
                </div>
                <div className="relative h-64 bg-muted border border-border overflow-hidden">
                  {mapEmbedSrc(d) ? (
                    <iframe
                      title={`${d.name} mini map`}
                      src={mapEmbedSrc(d)!}
                      className="w-full h-full"
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                      <MapPin size={32} className="text-gold" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      <RestaurantFooter site={site} navLinks={navLinks} />
    </div>
  );
}
