import type { PublishedSite, RestaurantData } from "@/lib/sites/types";

export interface NavLink {
  href: string;
  label: string;
}

export interface ReservationCta {
  label: string;
  href: string;
  external?: boolean;
}

export function buildNavLinks(site: PublishedSite): NavLink[] {
  const d = site.data as RestaurantData;
  const links: NavLink[] = [{ href: "/", label: "Home" }];
  if (d.menu?.sections?.length) links.push({ href: "/menu", label: "Menu" });
  links.push({ href: "/reservation", label: "Reserve" });
  return links;
}

export function buildReservationCta(
  site: PublishedSite,
  preferInternalRoute = true,
): ReservationCta | undefined {
  const d = site.data as RestaurantData;
  if (preferInternalRoute) {
    return { label: "Reserve", href: "/reservation", external: false };
  }
  if (d.hero?.cta) {
    return {
      label: d.hero.cta.label,
      href: d.hero.cta.href,
      external: /^https?:\/\//i.test(d.hero.cta.href),
    };
  }
  if (d.reservationUrl) {
    return { label: "Reserve", href: d.reservationUrl, external: true };
  }
  return undefined;
}

export function nextOpenSummary(d: RestaurantData): string | null {
  if (!d.hours || d.hours.length === 0) return null;
  const open = d.hours.find((h) => !h.closed && h.opens && h.closes);
  if (!open) return null;
  return `${open.opens} – ${open.closes}`;
}

export function formatAddress(d: RestaurantData): string {
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

export function mapEmbedSrc(d: RestaurantData): string | null {
  if (d.contact.mapEmbedUrl) return d.contact.mapEmbedUrl;
  const addr = formatAddress(d);
  if (!addr) return null;
  return `https://www.google.com/maps?q=${encodeURIComponent(addr)}&output=embed`;
}

export function shortBrand(name: string): string {
  if (!name) return name;
  const first = name.split(/\s+/)[0];
  return first.length >= 3 ? first : name;
}

export function splitParagraphs(text: string): string[] {
  if (!text) return [];
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

/**
 * Score gallery images so interior/atmosphere shots float to the top, food
 * shots sink, and chrome (logo/favicon/social) is filtered out.
 */
export function rankInteriors(
  gallery: { url: string; alt?: string }[],
): { url: string; alt?: string }[] {
  return [...gallery]
    .map((g) => ({ ref: g, score: interiorScore(g.url, g.alt) }))
    .filter((g) => g.score > -1000)
    .sort((a, b) => b.score - a.score)
    .map((g) => g.ref);
}

function interiorScore(url: string, alt?: string): number {
  const haystack = `${url} ${alt ?? ""}`.toLowerCase();
  let score = 0;
  // Strong interior signals.
  if (/(interior|dining|hall|room|counter|bar(?!be)|seating|atmosphere|ambience|venue|space|inside)/i.test(haystack))
    score += 8;
  if (/(restaurant|store-?front|exterior|facade|entrance|building)/i.test(haystack))
    score += 5;
  if (/(table|chair|booth|chandelier|lighting|decor)/i.test(haystack))
    score += 3;
  if (/(hero|banner|cover|kv|main|featured|gallery|photo)/i.test(haystack))
    score += 2;
  // Food signals — keep but lower priority on gallery.
  if (/(dish|plate|food|menu-item|sushi|pasta|burger|cake|drink|wine|cocktail|dessert)/i.test(haystack))
    score -= 4;
  // Chrome — disqualify.
  if (/(logo|favicon|sprite|icon|avatar|profile|badge|stamp|qr-?code|social|share|whatsapp|line)/i.test(haystack))
    score -= 1000;
  if (/(\b\d{1,3}x\d{1,3}\b)/.test(haystack)) score -= 2;
  return score;
}
