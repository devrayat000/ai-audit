import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import type { Element } from "domhandler";
import type { PageData, SiteData } from "../types";
import { parseSchemaFromHtml } from "../analyzers/schema-markup";
import { resolveUrl } from "../utils/url";
import type {
  ContactInfo,
  ImageRef,
  MenuItem,
  MenuSection,
  OpeningHour,
  RestaurantData,
  SocialLinks,
} from "./types";

const DAY_MAP: Record<string, OpeningHour["day"]> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

function uniq<T>(arr: T[], key: (v: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const v of arr) {
    const k = key(v);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}

function clean(s: string | undefined | null): string | undefined {
  if (!s) return undefined;
  const t = s.replace(/\s+/g, " ").trim();
  return t.length === 0 ? undefined : t;
}

function findSchemaValue(blocks: unknown[], typeMatch: RegExp, key: string): string | undefined {
  for (const block of blocks) {
    const found = digJsonForType(block, typeMatch, key);
    if (found) return found;
  }
  return undefined;
}

function digJsonForType(node: unknown, typeMatch: RegExp, key: string): string | undefined {
  if (!node || typeof node !== "object") return undefined;
  if (Array.isArray(node)) {
    for (const n of node) {
      const r = digJsonForType(n, typeMatch, key);
      if (r) return r;
    }
    return undefined;
  }
  const obj = node as Record<string, unknown>;
  const t = obj["@type"];
  const matches =
    (typeof t === "string" && typeMatch.test(t)) ||
    (Array.isArray(t) && t.some((x) => typeof x === "string" && typeMatch.test(x)));
  if (matches && typeof obj[key] === "string") return obj[key] as string;
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v && typeof v === "object") {
      const r = digJsonForType(v, typeMatch, key);
      if (r) return r;
    }
  }
  return undefined;
}

function extractAddress(blocks: unknown[], $: CheerioAPI): ContactInfo {
  const out: ContactInfo = {};
  // schema first
  for (const block of blocks) {
    const a = digJsonForAddress(block);
    if (a) {
      out.street = out.street ?? a.streetAddress;
      out.city = out.city ?? a.addressLocality;
      out.region = out.region ?? a.addressRegion;
      out.postalCode = out.postalCode ?? a.postalCode;
      out.country = out.country ?? a.addressCountry;
    }
  }
  // DOM fallback
  if (!out.street) {
    const addrText = clean($("address").first().text());
    if (addrText) out.street = addrText;
  }
  // Phone, email
  const phoneHref = $('a[href^="tel:"]').first().attr("href")?.replace(/^tel:/, "");
  if (phoneHref) out.phone = phoneHref.trim();
  const emailHref = $('a[href^="mailto:"]').first().attr("href")?.replace(/^mailto:/, "");
  if (emailHref) out.email = emailHref.trim();
  return out;
}

function digJsonForAddress(node: unknown):
  | {
      streetAddress?: string;
      addressLocality?: string;
      addressRegion?: string;
      postalCode?: string;
      addressCountry?: string;
    }
  | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const r = digJsonForAddress(n);
      if (r) return r;
    }
    return null;
  }
  const obj = node as Record<string, unknown>;
  const t = obj["@type"];
  const isAddr =
    (typeof t === "string" && /PostalAddress/i.test(t)) ||
    (Array.isArray(t) && t.some((x) => typeof x === "string" && /PostalAddress/i.test(x)));
  if (isAddr) {
    return {
      streetAddress: typeof obj.streetAddress === "string" ? obj.streetAddress : undefined,
      addressLocality: typeof obj.addressLocality === "string" ? obj.addressLocality : undefined,
      addressRegion: typeof obj.addressRegion === "string" ? obj.addressRegion : undefined,
      postalCode: typeof obj.postalCode === "string" ? obj.postalCode : undefined,
      addressCountry:
        typeof obj.addressCountry === "string"
          ? obj.addressCountry
          : obj.addressCountry && typeof obj.addressCountry === "object"
            ? typeof (obj.addressCountry as Record<string, unknown>).name === "string"
              ? ((obj.addressCountry as Record<string, unknown>).name as string)
              : undefined
            : undefined,
    };
  }
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v && typeof v === "object") {
      const r = digJsonForAddress(v);
      if (r) return r;
    }
  }
  return null;
}

function extractSocial($: CheerioAPI): SocialLinks {
  const out: SocialLinks = {};
  $("a[href]").each((_, el) => {
    const href = ($(el).attr("href") ?? "").trim();
    if (!href) return;
    if (!out.instagram && /instagram\.com/i.test(href)) out.instagram = href;
    if (!out.facebook && /facebook\.com/i.test(href)) out.facebook = href;
    if (!out.twitter && /(?:twitter|x)\.com/i.test(href)) out.twitter = href;
    if (!out.tiktok && /tiktok\.com/i.test(href)) out.tiktok = href;
    if (!out.youtube && /youtube\.com/i.test(href)) out.youtube = href;
    if (!out.line && /line\.me/i.test(href)) out.line = href;
  });
  return out;
}

function extractHours(blocks: unknown[], $: CheerioAPI, body: string): OpeningHour[] {
  const map = new Map<string, OpeningHour>();
  // schema OpeningHoursSpecification
  function dig(node: unknown) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(dig);
      return;
    }
    const obj = node as Record<string, unknown>;
    const t = obj["@type"];
    const isHours =
      (typeof t === "string" && /OpeningHoursSpecification/i.test(t)) ||
      (Array.isArray(t) && t.some((x) => typeof x === "string" && /OpeningHoursSpecification/i.test(x)));
    if (isHours) {
      const days = obj.dayOfWeek;
      const opens = typeof obj.opens === "string" ? obj.opens : undefined;
      const closes = typeof obj.closes === "string" ? obj.closes : undefined;
      const list = Array.isArray(days) ? days : days ? [days] : [];
      for (const d of list) {
        if (typeof d !== "string") continue;
        const key = d.split("/").pop()?.toLowerCase() ?? "";
        const day = DAY_MAP[key];
        if (!day) continue;
        map.set(day, { day, opens, closes });
      }
    }
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (v && typeof v === "object") dig(v);
    }
  }
  blocks.forEach(dig);

  // text fallback — match patterns like "Mon-Fri 10:00 - 22:00"
  if (map.size === 0) {
    const re =
      /\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*\s*(?:-|to|–)?\s*(?:(mon|tue|wed|thu|fri|sat|sun)[a-z]*)?\s*[: ]?\s*(\d{1,2}[:.h]\d{2})\s*(?:-|to|–|—)\s*(\d{1,2}[:.h]\d{2})/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body))) {
      const startKey = m[1].toLowerCase();
      const endKey = (m[2] ?? m[1]).toLowerCase();
      const days = expandDayRange(startKey, endKey);
      const opens = m[3].replace(/[.h]/, ":");
      const closes = m[4].replace(/[.h]/, ":");
      for (const day of days) {
        map.set(day, { day, opens, closes });
      }
    }
  }
  // also rely on plain $ for span/dt patterns
  if (map.size === 0) {
    $("li, p, div, span, dt, dd").each((_, el) => {
      if (map.size >= 7) return;
      const text = $(el).text();
      const re = /\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*\b.*?(\d{1,2}[:.h]\d{2}).{0,8}(\d{1,2}[:.h]\d{2})/i;
      const m = re.exec(text);
      if (!m) return;
      const key = m[1].toLowerCase();
      const day = DAY_MAP[key];
      if (!day) return;
      map.set(day, { day, opens: m[2].replace(/[.h]/, ":"), closes: m[3].replace(/[.h]/, ":") });
    });
  }
  return Array.from(map.values());
}

function expandDayRange(startKey: string, endKey: string): OpeningHour["day"][] {
  const order: OpeningHour["day"][] = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];
  const start = DAY_MAP[startKey];
  const end = DAY_MAP[endKey] ?? start;
  if (!start) return [];
  const si = order.indexOf(start);
  const ei = order.indexOf(end);
  if (si < 0 || ei < 0) return [start];
  if (ei >= si) return order.slice(si, ei + 1);
  return [...order.slice(si), ...order.slice(0, ei + 1)];
}

function extractGalleryFromPages(pages: PageData[], rootUrl: string): ImageRef[] {
  const refs: ImageRef[] = [];
  for (const page of pages) {
    const html = page.renderedHtml || page.rawHtml;
    if (!html) continue;
    const $ = cheerio.load(html);
    $("img").each((_, el) => {
      const src = ($(el).attr("src") ?? "").trim();
      const alt = clean($(el).attr("alt"));
      if (!src) return;
      if (/^(data:|blob:)/i.test(src)) return;
      const abs = resolveUrl(page.url, src) ?? src;
      // filter: drop very small, sprite-like or icon URLs heuristically
      const looksIcon = /icon|sprite|logo[-_.]?small|favicon|emoji/i.test(abs);
      if (looksIcon) return;
      refs.push({ url: abs, alt });
    });
    // og:image as fallback
    const og = $('meta[property="og:image"]').attr("content");
    if (og) {
      refs.push({ url: resolveUrl(page.url, og) ?? og, alt: undefined });
    }
    void rootUrl;
  }
  return uniq(refs, (r) => r.url).slice(0, 24);
}

function pickHeroImage(gallery: ImageRef[], homepageHtml: string): ImageRef | undefined {
  const $ = cheerio.load(homepageHtml);
  const og = $('meta[property="og:image"]').attr("content");
  if (og) return { url: og };
  // pick first image whose alt or src looks "hero-y"
  const candidate = gallery.find((g) =>
    /(hero|banner|cover|kv|main|top)/i.test(`${g.url} ${g.alt ?? ""}`),
  );
  return candidate ?? gallery[0];
}

function extractMenu(pages: PageData[]): { sections: MenuSection[] } | undefined {
  // look for a "menu"-pathed page
  const menuPage =
    pages.find((p) => /\/menu|cuisine|food|dishes/i.test(p.url)) ?? pages[0];
  if (!menuPage) return undefined;
  const html = menuPage.renderedHtml || menuPage.rawHtml;
  const $ = cheerio.load(html);
  const sections: MenuSection[] = [];

  // pattern A: schema.org Menu / MenuSection / MenuItem
  const blocks = parseSchemaFromHtml(html).raw;
  const schemaSections = digMenuSections(blocks);
  if (schemaSections.length > 0) {
    return { sections: schemaSections };
  }

  // pattern B: heading-grouped lists. For each heading, find sibling items.
  const headingSel = "h2, h3";
  $(headingSel).each((_, h) => {
    const $h = $(h);
    const title = clean($h.text());
    if (!title) return;
    if (!/menu|appetiz|starter|entrée|main|dessert|drink|beverage|wine|special/i.test(title) && sections.length === 0) {
      // first heading: still try to capture if items look like menu items underneath
    }
    const items = collectMenuItemsAfter($, $h.get(0) as Element, menuPage.url);
    if (items.length >= 2) {
      sections.push({ title, items });
    }
  });

  if (sections.length === 0) {
    // pattern C: any list of "name … price"
    const items: MenuItem[] = [];
    $("li, .menu-item, [class*='menu']").each((_, el) => {
      const text = clean($(el).text());
      if (!text) return;
      const priceMatch = text.match(/(?:¥|\$|€|£|₹|৳)\s?\d[\d,.]*|\b\d[\d,]*\s?(?:円|JPY|USD|EUR|GBP)\b/);
      if (!priceMatch) return;
      const name = text.replace(priceMatch[0], "").trim().slice(0, 80);
      if (name.length < 2) return;
      items.push({ name, price: priceMatch[0] });
    });
    if (items.length >= 3) sections.push({ title: "Menu", items: uniqByName(items) });
  }
  return sections.length > 0 ? { sections } : undefined;
}

function digMenuSections(blocks: unknown[]): MenuSection[] {
  const out: MenuSection[] = [];
  function walk(node: unknown) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    const obj = node as Record<string, unknown>;
    const t = obj["@type"];
    const isMenuSection =
      (typeof t === "string" && /MenuSection/i.test(t)) ||
      (Array.isArray(t) && t.some((x) => typeof x === "string" && /MenuSection/i.test(x)));
    if (isMenuSection) {
      const title =
        typeof obj.name === "string" ? obj.name : "Menu";
      const itemsRaw = obj.hasMenuItem ?? obj.menuItem;
      const items = collectMenuItemsFromSchema(itemsRaw);
      if (items.length > 0) out.push({ title, items });
    }
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (v && typeof v === "object") walk(v);
    }
  }
  blocks.forEach(walk);
  return out;
}

function collectMenuItemsFromSchema(raw: unknown): MenuItem[] {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  const items: MenuItem[] = [];
  for (const r of list) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name : undefined;
    if (!name) continue;
    const desc = typeof o.description === "string" ? o.description : undefined;
    let price: string | undefined;
    const offers = o.offers;
    if (offers && typeof offers === "object") {
      const off = Array.isArray(offers) ? offers[0] : offers;
      if (off && typeof off === "object") {
        const p = (off as Record<string, unknown>).price;
        const cur = (off as Record<string, unknown>).priceCurrency;
        if (typeof p === "string" || typeof p === "number") {
          price = `${typeof cur === "string" ? cur + " " : ""}${p}`;
        }
      }
    }
    let image: ImageRef | undefined;
    if (typeof o.image === "string") image = { url: o.image };
    items.push({ name, description: desc, price, image });
  }
  return items;
}

function collectMenuItemsAfter($: CheerioAPI, heading: Element, pageUrl: string): MenuItem[] {
  const items: MenuItem[] = [];
  let cur: Element | null = heading.next as Element | null;
  while (cur) {
    if (cur.type === "tag") {
      const tag = cur.tagName?.toLowerCase();
      if (tag === "h1" || tag === "h2" || tag === "h3") break;
      const $cur = $(cur);
      // li with possible price
      $cur.find("li, .menu-item, [class*='item']").each((_, li) => {
        const text = clean($(li).text());
        if (!text) return;
        const priceMatch = text.match(/(?:¥|\$|€|£|₹|৳)\s?\d[\d,.]*|\b\d[\d,]*\s?(?:円|JPY|USD|EUR|GBP)\b/);
        const name = (priceMatch ? text.replace(priceMatch[0], "") : text).trim().split("\n")[0].slice(0, 80);
        if (name.length < 2) return;
        const img = $(li).find("img").first().attr("src");
        const imgRef: ImageRef | undefined = img ? { url: resolveUrl(pageUrl, img) ?? img } : undefined;
        items.push({ name, price: priceMatch?.[0], image: imgRef });
      });
    }
    cur = (cur as { next?: Element | null }).next ?? null;
  }
  return uniqByName(items).slice(0, 30);
}

function uniqByName(items: MenuItem[]): MenuItem[] {
  return uniq(items, (i) => i.name.toLowerCase());
}

export function scrapeRestaurant(
  homepage: PageData,
  pages: PageData[],
  site: SiteData,
): RestaurantData {
  const html = homepage.renderedHtml || homepage.rawHtml;
  const $ = cheerio.load(html);
  const blocks = parseSchemaFromHtml(html).raw;

  const name =
    clean(findSchemaValue(blocks, /Restaurant|FoodEstablishment|LocalBusiness/i, "name")) ??
    clean($('meta[property="og:site_name"]').attr("content")) ??
    clean($("title").first().text().split(/[|\-—–·]/)[0]) ??
    site.domain;

  const tagline =
    clean($("h1").first().text()) ?? clean($('meta[property="og:title"]').attr("content"));

  const description =
    clean($('meta[name="description"]').attr("content")) ??
    clean($('meta[property="og:description"]').attr("content")) ??
    clean($("p").first().text());

  const priceRange = clean(findSchemaValue(blocks, /Restaurant/i, "priceRange"));
  const cuisineRaw = findSchemaValue(blocks, /Restaurant/i, "servesCuisine");
  const cuisine = cuisineRaw ? [cuisineRaw] : undefined;

  const gallery = extractGalleryFromPages(pages, site.rootUrl);
  const heroImage = pickHeroImage(gallery, html);

  const heading = clean($("h1").first().text()) ?? name;
  const heroSub =
    clean($("h1").first().next("p").text()) ??
    clean($('meta[property="og:description"]').attr("content")) ??
    description;

  const contact = extractAddress(blocks, $);
  const social = extractSocial($);
  const body = $("body").text();
  const hours = extractHours(blocks, $, body);
  const menu = extractMenu(pages);

  const reservationUrl = (() => {
    const a = $("a[href]").filter((_, el) => /reserv|book|予約/i.test(clean($(el).text()) ?? "")).first();
    const href = a.attr("href");
    return href ? resolveUrl(homepage.url, href) ?? href : undefined;
  })();
  const orderUrl = (() => {
    const a = $("a[href]").filter((_, el) => /order|delivery|出前/i.test(clean($(el).text()) ?? "")).first();
    const href = a.attr("href");
    return href ? resolveUrl(homepage.url, href) ?? href : undefined;
  })();

  const highlights = collectHighlights($);

  return {
    industry: "restaurant",
    name,
    tagline,
    description,
    cuisine,
    priceRange,
    hero: {
      heading,
      sub: heroSub,
      image: heroImage,
      cta: reservationUrl
        ? { label: "Reserve a table", href: reservationUrl }
        : orderUrl
          ? { label: "Order online", href: orderUrl }
          : undefined,
    },
    about: clean($("section, article, div").filter((_, el) =>
      /about|story|history|nuestra historia/i.test(($(el).attr("class") ?? "") + " " + ($(el).attr("id") ?? "")),
    ).first().find("p").map((_, p) => clean($(p).text())).get().filter(Boolean).join(" ")) || description,
    highlights,
    menu,
    gallery,
    hours,
    contact,
    social,
    reservationUrl,
    orderUrl,
  };
}

function collectHighlights($: CheerioAPI): string[] {
  const out: string[] = [];
  $("ul li, .feature, .highlight").each((_, el) => {
    const text = clean($(el).text());
    if (!text) return;
    if (text.length > 12 && text.length < 120) out.push(text);
  });
  return uniq(out, (s) => s.toLowerCase()).slice(0, 6);
}
