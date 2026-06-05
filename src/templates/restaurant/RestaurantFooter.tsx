import { ExternalLink, Mail, MapPin, Phone } from "lucide-react";
import type { PublishedSite, RestaurantData } from "@/lib/sites/types";

interface NavLink {
  href: string;
  label: string;
}

interface Props {
  site: PublishedSite;
  navLinks: NavLink[];
  reservationCta?: { label: string; href: string };
}

export function RestaurantFooter({ site, navLinks, reservationCta }: Props) {
  const d = site.data as RestaurantData;
  return (
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
              {...(/^https?:\/\//i.test(reservationCta.href)
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
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

function shortBrand(name: string): string {
  if (!name) return name;
  const first = name.split(/\s+/)[0];
  return first.length >= 3 ? first : name;
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
