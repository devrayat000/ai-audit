import type { PublishedSite, RestaurantData } from "@/lib/sites/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChevronRight,
  Clock,
  ExternalLink,
  MapPin,
  Phone,
  Sparkles,
  Utensils,
} from "lucide-react";
import { restaurantJsonLd } from "./schema";
import { proxied } from "./image";

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
  const jsonLd = restaurantJsonLd(site);

  return (
    <main className="min-h-screen bg-[oklch(0.98_0.02_85)] text-[oklch(0.18_0.02_50)] font-sans">
      {jsonLd.map((block, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }}
        />
      ))}

      {/* Sticky nav */}
      <header className="sticky top-0 z-30 border-b border-foreground/10 bg-[oklch(0.98_0.02_85)]/85 backdrop-blur supports-[backdrop-filter]:bg-[oklch(0.98_0.02_85)]/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-6">
          <a href="#top" className="font-serif text-xl font-medium tracking-tight md:text-2xl">
            {d.name}
          </a>
          <nav className="hidden items-center gap-6 text-xs uppercase tracking-[0.18em] text-muted-foreground md:flex">
            {d.about && <a className="hover:text-foreground" href="#about">Story</a>}
            {menuSections.length > 0 && <a className="hover:text-foreground" href="#menu">Menu</a>}
            {site.geo?.faqs && site.geo.faqs.length > 0 && (
              <a className="hover:text-foreground" href="#faq">FAQ</a>
            )}
            {gallery.length > 0 && <a className="hover:text-foreground" href="#gallery">Gallery</a>}
            <a className="hover:text-foreground" href="#visit">Visit</a>
          </nav>
          {d.hero.cta && (
            <a
              href={d.hero.cta.href}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:inline-flex"
            >
              <Button size="sm" className="rounded-full">
                {d.hero.cta.label}
              </Button>
            </a>
          )}
        </div>
      </header>

      {/* Hero */}
      <section
        id="top"
        className="relative isolate flex min-h-[78vh] items-center justify-center overflow-hidden px-4 py-24 text-center md:py-32"
      >
        {heroImg && (
          <img
            src={heroImg}
            alt=""
            className="absolute inset-0 -z-10 h-full w-full object-cover brightness-[0.45]"
            loading="eager"
            decoding="async"
            referrerPolicy="no-referrer"
          />
        )}
        {!heroImg && (
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-[oklch(0.35_0.12_25)] via-[oklch(0.25_0.10_25)] to-[oklch(0.15_0.06_50)]" />
        )}
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6">
          {d.cuisine && d.cuisine.length > 0 && (
            <Badge
              variant="outline"
              className="border-white/40 bg-white/10 text-white/90 backdrop-blur"
            >
              <Sparkles className="size-3" />
              {d.cuisine.join(" · ")}
            </Badge>
          )}
          <h1 className="font-serif text-5xl leading-[0.95] tracking-tight text-white md:text-7xl">
            {d.hero.heading ?? d.name}
          </h1>
          {d.hero.sub && (
            <p className="max-w-xl text-balance text-base leading-relaxed text-white/85 md:text-lg">
              {d.hero.sub}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            {d.hero.cta && (
              <a href={d.hero.cta.href} target="_blank" rel="noopener noreferrer">
                <Button size="lg" className="rounded-full">
                  {d.hero.cta.label}
                  <ChevronRight className="size-4" />
                </Button>
              </a>
            )}
            {menuSections.length > 0 && (
              <a href="#menu">
                <Button size="lg" variant="outline" className="rounded-full bg-white/10 text-white border-white/30 hover:bg-white/20">
                  View menu
                </Button>
              </a>
            )}
          </div>
          {d.contact.city && (
            <div className="mt-3 inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-white/70">
              <MapPin className="size-3" />
              {d.contact.city}
              {d.contact.region ? `, ${d.contact.region}` : ""}
            </div>
          )}
        </div>
      </section>

      {/* About + summary */}
      {(site.geo?.summary || site.geo?.about || d.about || (d.highlights && d.highlights.length > 0)) && (
        <section id="about" className="mx-auto max-w-6xl px-4 py-20 md:px-6 md:py-24">
          <div className="text-xs uppercase tracking-[0.32em] text-muted-foreground">
            Our story
          </div>
          <div className="mt-3 grid gap-10 md:grid-cols-[1.15fr_1fr] md:items-center md:gap-16">
            <div className="space-y-5">
              <h2 className="font-serif text-3xl tracking-tight md:text-5xl">
                About {d.name}
              </h2>
              {site.geo?.summary && (
                <p className="text-lg leading-relaxed text-foreground md:text-xl">
                  {site.geo.summary}
                </p>
              )}
              {(site.geo?.about ?? d.about) && (
                <p className="text-base leading-relaxed text-muted-foreground">
                  {site.geo?.about ?? d.about}
                </p>
              )}
              {d.highlights && d.highlights.length > 0 && (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {d.highlights.map((h, i) => (
                    <li
                      key={i}
                      className="rounded-lg border border-foreground/10 bg-card/60 px-4 py-3 text-sm leading-snug"
                    >
                      <span className="mr-2 text-[oklch(0.50_0.18_28)]">›</span>
                      {h}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {aboutImage && (
              <div className="relative aspect-[4/5] overflow-hidden rounded-2xl ring-1 ring-foreground/10">
                <img
                  src={proxied(aboutImage.url)}
                  alt={aboutImage.alt ?? `${d.name} interior`}
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                />
              </div>
            )}
          </div>
        </section>
      )}

      {/* Menu */}
      {menuSections.length > 0 && (
        <section
          id="menu"
          className="border-y border-foreground/10 bg-[oklch(0.96_0.025_85)] px-4 py-20 md:px-6 md:py-24"
        >
          <div className="mx-auto max-w-6xl">
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <div>
                <div className="text-xs uppercase tracking-[0.32em] text-muted-foreground">
                  Tasting list
                </div>
                <h2 className="mt-2 font-serif text-3xl tracking-tight md:text-5xl">Menu</h2>
              </div>
              <Badge variant="outline" className="gap-1">
                <Utensils className="size-3" />
                {menuSections.reduce((a, s) => a + s.items.length, 0)} dishes
              </Badge>
            </div>
            <div className="mt-10 grid gap-8 md:grid-cols-2">
              {menuSections.map((s, i) => (
                <Card key={i} className="bg-card">
                  <CardHeader>
                    <CardTitle className="font-serif text-2xl tracking-tight">
                      {s.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {s.items.map((item, j) => (
                      <div
                        key={j}
                        className="flex flex-col gap-1 border-b border-dashed border-foreground/10 pb-3 last:border-b-0 last:pb-0"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-base font-medium leading-tight">
                            {item.name}
                          </span>
                          {item.price && (
                            <span className="shrink-0 font-mono text-sm tabular-nums text-[oklch(0.50_0.18_28)]">
                              {item.price}
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <p className="text-sm leading-snug text-muted-foreground">
                            {item.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      {site.geo?.faqs && site.geo.faqs.length > 0 && (
        <section id="faq" className="mx-auto max-w-4xl px-4 py-20 md:px-6 md:py-24">
          <div className="text-xs uppercase tracking-[0.32em] text-muted-foreground">
            Good to know
          </div>
          <h2 className="mt-2 font-serif text-3xl tracking-tight md:text-5xl">
            Frequently asked questions
          </h2>
          <div className="mt-8 space-y-3">
            {site.geo.faqs.map((qa, i) => (
              <details
                key={i}
                className="group rounded-xl border border-foreground/10 bg-card px-5 py-4 [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex cursor-pointer items-start justify-between gap-3 font-medium leading-snug">
                  <span>{qa.q}</span>
                  <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {qa.a}
                </p>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* Gallery */}
      {gallery.length > 1 && (
        <section
          id="gallery"
          className="border-t border-foreground/10 bg-[oklch(0.96_0.025_85)] px-4 py-20 md:px-6 md:py-24"
        >
          <div className="mx-auto max-w-6xl">
            <div className="text-xs uppercase tracking-[0.32em] text-muted-foreground">
              Glimpses
            </div>
            <h2 className="mt-2 font-serif text-3xl tracking-tight md:text-5xl">Gallery</h2>
            <div className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 md:gap-3">
              {gallery.slice(0, 16).map((img, i) => (
                <div
                  key={i}
                  className="group relative aspect-square overflow-hidden rounded-lg ring-1 ring-foreground/10"
                >
                  <img
                    src={proxied(img.url)}
                    alt={img.alt ?? `${d.name} photo ${i + 1}`}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Visit / contact */}
      <section id="visit" className="mx-auto max-w-6xl px-4 py-20 md:px-6 md:py-24">
        <div className="text-xs uppercase tracking-[0.32em] text-muted-foreground">
          Plan your visit
        </div>
        <h2 className="mt-2 font-serif text-3xl tracking-tight md:text-5xl">Find us</h2>
        <div className="mt-10 grid gap-10 md:grid-cols-2 md:gap-12">
          <div className="space-y-6">
            {(d.contact.street || d.contact.city) && (
              <Card>
                <CardContent className="flex items-start gap-3 p-5">
                  <MapPin className="mt-0.5 size-5 shrink-0 text-[oklch(0.50_0.18_28)]" />
                  <address className="not-italic text-sm leading-relaxed">
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
                  </address>
                </CardContent>
              </Card>
            )}
            {(d.contact.phone || d.contact.email) && (
              <Card>
                <CardContent className="flex flex-col gap-3 p-5 text-sm">
                  {d.contact.phone && (
                    <a
                      href={`tel:${d.contact.phone}`}
                      className="inline-flex items-center gap-2 hover:text-[oklch(0.50_0.18_28)]"
                    >
                      <Phone className="size-4" />
                      {d.contact.phone}
                    </a>
                  )}
                  {d.contact.email && (
                    <a
                      href={`mailto:${d.contact.email}`}
                      className="inline-flex items-center gap-2 break-all hover:text-[oklch(0.50_0.18_28)]"
                    >
                      <ExternalLink className="size-4" />
                      {d.contact.email}
                    </a>
                  )}
                </CardContent>
              </Card>
            )}
            <div className="flex flex-wrap gap-2">
              {d.social.instagram && (
                <SocialPill href={d.social.instagram} label="Instagram" />
              )}
              {d.social.facebook && (
                <SocialPill href={d.social.facebook} label="Facebook" />
              )}
              {d.social.twitter && <SocialPill href={d.social.twitter} label="X" />}
              {d.social.tiktok && <SocialPill href={d.social.tiktok} label="TikTok" />}
              {d.social.youtube && <SocialPill href={d.social.youtube} label="YouTube" />}
              {d.social.line && <SocialPill href={d.social.line} label="LINE" />}
            </div>
            {d.reservationUrl && (
              <a
                href={d.reservationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block"
              >
                <Button size="lg" className="rounded-full">
                  Reserve a table
                  <ChevronRight className="size-4" />
                </Button>
              </a>
            )}
          </div>

          {d.hours && d.hours.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base font-medium">
                  <Clock className="size-4 text-[oklch(0.50_0.18_28)]" />
                  Opening hours
                </CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <tbody>
                    {DAY_ORDER.map((day) => {
                      const entry = d.hours?.find((h) => h.day === day);
                      return (
                        <tr key={day} className="border-b border-foreground/5 last:border-b-0">
                          <th
                            scope="row"
                            className="py-2 text-left font-medium"
                          >
                            {day}
                          </th>
                          <td className="py-2 text-right font-mono tabular-nums text-muted-foreground">
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
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-foreground/10 bg-card/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-8 text-xs text-muted-foreground md:px-6">
          <span>
            © {new Date().getFullYear()} {d.name}
          </span>
          <span className="uppercase tracking-[0.18em]">
            Source:{" "}
            <a
              href={site.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground"
            >
              {(() => {
                try {
                  return new URL(site.sourceUrl).hostname;
                } catch {
                  return site.sourceUrl;
                }
              })()}
            </a>{" "}
            · Restored for AI discoverability
          </span>
        </div>
      </footer>
    </main>
  );
}

function SocialPill({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-full border border-foreground/15 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.14em] hover:border-foreground hover:bg-foreground hover:text-background"
    >
      {label}
      <ExternalLink className="size-3" />
    </a>
  );
}
