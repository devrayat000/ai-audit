import * as cheerio from "cheerio";
import type { CheerioAPI, Cheerio } from "cheerio";
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

const PRICE_RE =
  /(?:(?:¥|\$|€|£|₹|৳|RM|₩|฿|₫|₱|HK\$|S\$|NT\$|CHF|kr|zł|R\$)\s?\d[\d.,]*)|(?:\b\d[\d,]*\.\d{2}\b)|(?:\b\d[\d,]{2,}\s?(?:円|JPY|USD|EUR|GBP|INR|BDT|TWD|HKD|KRW|THB|VND|PHP|MYR|IDR|SGD)\b)/i;

const PRICE_SUFFIX_DISQUALIFIERS =
  /\s*(?:\/\s*(?:month|year|mo|yr|hr|hour|day|wk|week|person|pax|pp|guest)|%|off|discount)\b/i;

const NON_MENU_NAME_RE =
  /\b(home|about|contact|reservation|reserve|booking|menu|career|jobs?|gallery|news|press|blog|story|location|hours|directions|order|delivery|takeout|takeaway|sign in|sign up|signin|signup|login|log\s?in|log\s?out|register|account|profile|cart|checkout|wishlist|search|filter|sort|share|follow|subscribe|newsletter|privacy|terms|policy|cookie|copyright|all rights reserved|©|powered by|read more|learn more|view more|see all|show all|next|previous|view|details|info|information|read review|write a review|©\s?\d{4}|all-?inclusive|free shipping|free delivery|track order|return policy|faq|help|support|download|app store|google play)\b/i;

function isLikelyChrome(s: string): boolean {
  return NON_MENU_NAME_RE.test(s);
}

function isValidPrice(price: string | undefined): boolean {
  if (!price) return false;
  if (PRICE_SUFFIX_DISQUALIFIERS.test(price)) return false;
  const digits = price.match(/\d[\d.,]*/);
  if (!digits) return false;
  const num = parseFloat(digits[0].replace(/[,]/g, ""));
  if (!Number.isFinite(num)) return false;
  // Reject obvious year stamps, version numbers, page counters.
  if (num >= 1900 && num <= 2100 && !/[.,]/.test(digits[0])) return false;
  if (num <= 0) return false;
  return true;
}

function isInChromeRegion($el: Cheerio<Element>): boolean {
  if (
    $el.closest("nav, header, footer, aside, .nav, .navbar, .menu-nav, .topbar, .sidebar, .breadcrumb, .footer, .header, .cookies, .cookie-banner, .newsletter, .subscribe, .login, .auth, .cart, .checkout").length > 0
  ) {
    return true;
  }
  return false;
}

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
  if (!out.street) {
    const addrText = clean($("address").first().text());
    if (addrText) out.street = addrText;
  }
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

function isPlaceholderUrl(url: string): boolean {
  if (/^(data:|blob:)/i.test(url)) return true;
  if (/(^|\/)1x1\.(gif|png)/i.test(url)) return true;
  if (/transparent\.(gif|png)/i.test(url)) return true;
  if (/placeholder/i.test(url) && /\.(gif|svg)$/i.test(url)) return true;
  return false;
}

function pickFromSrcset(srcset: string): string | null {
  const parts = srcset.split(",").map((p) => p.trim()).filter(Boolean);
  let best: { url: string; weight: number } | null = null;
  for (const part of parts) {
    const [url, descRaw] = part.split(/\s+/);
    if (!url) continue;
    const desc = descRaw ?? "1x";
    const m = desc.match(/^(\d+(?:\.\d+)?)(w|x)$/i);
    const weight = m ? parseFloat(m[1]) * (m[2].toLowerCase() === "w" ? 1 : 1000) : 0;
    if (!best || weight > best.weight) best = { url, weight };
  }
  return best?.url ?? null;
}

const LAZY_ATTRS = [
  "data-src",
  "data-original",
  "data-lazy-src",
  "data-lazy",
  "data-defer-src",
  "data-srcset",
  "data-original-src",
  "data-actualsrc",
  "data-hi-res-src",
] as const;

function pickImgUrl($el: Cheerio<Element>): string | null {
  const srcset = ($el.attr("srcset") ?? "").trim();
  if (srcset) {
    const best = pickFromSrcset(srcset);
    if (best && !isPlaceholderUrl(best)) return best;
  }
  for (const attr of LAZY_ATTRS) {
    const v = ($el.attr(attr) ?? "").trim();
    if (!v || isPlaceholderUrl(v)) continue;
    if (attr === "data-srcset") {
      const best = pickFromSrcset(v);
      if (best) return best;
    } else {
      return v;
    }
  }
  const src = ($el.attr("src") ?? "").trim();
  if (src && !isPlaceholderUrl(src)) return src;
  return null;
}

function pushAbsImage(
  refs: ImageRef[],
  pageUrl: string,
  raw: string,
  alt?: string,
): void {
  if (!raw) return;
  if (isPlaceholderUrl(raw)) return;
  const abs = resolveUrl(pageUrl, raw);
  if (!abs || !/^https?:\/\//i.test(abs)) return;
  // Drop chrome: favicons, sprites, social icons, qr codes, logos.
  const looksChrome =
    /(?:^|\/)(?:favicon|sprite|emoji|spinner|loader|qr[-_]?code|whatsapp|line|share)(?:[-_.]|$)/i.test(abs) ||
    /icon-?\d+x\d+/i.test(abs) ||
    /(?:^|\/)logos?(?:[-_./]|$)/i.test(abs) ||
    /(?:^|\/)(?:social|avatar)(?:[-_./]|$)/i.test(abs);
  if (looksChrome) return;
  refs.push({ url: abs, alt });
}

function extractGalleryFromPages(pages: PageData[], rootUrl: string): ImageRef[] {
  const refs: ImageRef[] = [];
  for (const page of pages) {
    const html = page.renderedHtml || page.rawHtml;
    if (!html) continue;
    const $ = cheerio.load(html);

    const og = $('meta[property="og:image"]').attr("content")?.trim();
    if (og) pushAbsImage(refs, page.url, og);
    const twitter = $('meta[name="twitter:image"]').attr("content")?.trim();
    if (twitter) pushAbsImage(refs, page.url, twitter);

    $("picture source[srcset]").each((_, el) => {
      const srcset = ($(el).attr("srcset") ?? "").trim();
      if (!srcset) return;
      const best = pickFromSrcset(srcset);
      if (!best) return;
      const alt = clean($(el).closest("picture").find("img").attr("alt"));
      pushAbsImage(refs, page.url, best, alt);
    });

    $("img").each((_, el) => {
      const $el = $(el);
      const url = pickImgUrl($el);
      if (!url) return;
      const alt = clean($el.attr("alt"));
      pushAbsImage(refs, page.url, url, alt);
    });

    $("[style*='background']").each((_, el) => {
      const style = $(el).attr("style") ?? "";
      const m = style.match(/background(?:-image)?\s*:\s*url\((['"]?)([^'")]+)\1\)/i);
      if (!m) return;
      pushAbsImage(refs, page.url, m[2].trim());
    });

    void rootUrl;
  }
  return uniq(refs, (r) => r.url).slice(0, 36);
}

function pickHeroImage(gallery: ImageRef[]): ImageRef | undefined {
  // Prefer explicit hero-ish + interior/exterior shots over food.
  const ranked = [...gallery].sort((a, b) => heroScore(b) - heroScore(a));
  return ranked[0] ?? gallery[0];
}

function heroScore(img: ImageRef): number {
  const hay = `${img.url} ${img.alt ?? ""}`.toLowerCase();
  let s = 0;
  if (/(hero|banner|cover|kv|main-?image|top-?image|featured)/i.test(hay)) s += 10;
  if (/(interior|exterior|dining|restaurant|venue|storefront|facade|building)/i.test(hay)) s += 6;
  if (/(dish|plate|menu-item|food|sushi|burger|pasta|cake|drink|wine)/i.test(hay)) s -= 2;
  if (/(logo|favicon|sprite|icon|avatar|social|share)/i.test(hay)) s -= 1000;
  return s;
}

// ───── Menu extraction ─────────────────────────────────────────────────────────

const MENU_URL_HINT = /\/(?:menu|menus|cuisine|food|dishes|carte|carta|speisekarte|メニュー|menu-list)(?:\/|$|\?|#)/i;

function findMenuPages(pages: PageData[]): PageData[] {
  // Order menu pages first, but always try every page so single-page sites still work.
  const menuish: PageData[] = [];
  const rest: PageData[] = [];
  for (const p of pages) {
    if (MENU_URL_HINT.test(p.url)) menuish.push(p);
    else rest.push(p);
  }
  return [...menuish, ...rest];
}

function extractMenu(pages: PageData[]): { sections: MenuSection[] } | undefined {
  for (const page of findMenuPages(pages)) {
    const html = page.renderedHtml || page.rawHtml;
    if (!html) continue;
    const $ = cheerio.load(html);

    // 1. JSON-LD Menu/MenuSection/MenuItem.
    const blocks = parseSchemaFromHtml(html).raw;
    const schemaSections = digMenuSections(blocks);
    if (sectionsHaveItems(schemaSections, 3)) return { sections: schemaSections };

    // 2. Structured CSS class blocks (.menu-section / .menu-category).
    const classySections = extractMenuFromClassedBlocks($, page.url);
    if (sectionsHaveItems(classySections, 3)) return { sections: classySections };

    // 3. Heading-grouped lists.
    const headingSections = extractMenuFromHeadings($, page.url);
    if (sectionsHaveItems(headingSections, 3)) return { sections: headingSections };

    // 4. Definition lists.
    const dlSections = extractMenuFromDl($, page.url);
    if (sectionsHaveItems(dlSections, 3)) return { sections: dlSections };

    // 5. Tables of dishes.
    const tableSections = extractMenuFromTables($, page.url);
    if (sectionsHaveItems(tableSections, 3)) return { sections: tableSections };

    // 6. Flat list — any element with a price string nearby.
    const flatItems = extractFlatPricedItems($, page.url);
    if (flatItems.length >= 3) {
      return { sections: [{ title: "Menu", items: flatItems }] };
    }
  }
  return undefined;
}

function sectionsHaveItems(sections: MenuSection[], minTotal: number): boolean {
  const total = sections.reduce((a, s) => a + s.items.length, 0);
  return total >= minTotal;
}

const SECTION_BLOCK_SELECTORS = [
  "[class*='menu-section']",
  "[class*='menu-category']",
  "[class*='menu_section']",
  "[class*='menu_category']",
  "[class*='food-category']",
  "[id*='menu-section']",
  "[id*='menu-category']",
] as const;

const ITEM_BLOCK_SELECTORS = [
  ".menu-item",
  ".menu_item",
  ".food-item",
  ".dish",
  ".dish-item",
  ".product",
  "[class*='menu-item']",
  "[class*='menuItem']",
  "[class*='food-item']",
  "[class*='dish-item']",
  "[class*='-dish']",
  "li.product",
  "li.dish",
] as const;

function extractMenuFromClassedBlocks(
  $: CheerioAPI,
  pageUrl: string,
): MenuSection[] {
  const sections: MenuSection[] = [];
  $(SECTION_BLOCK_SELECTORS.join(",")).each((_, sec) => {
    const $sec = $(sec as Element);
    if (isInChromeRegion($sec)) return;
    const title =
      clean($sec.find("h1, h2, h3, h4, .menu-section-title, [class*='title']").first().text()) ??
      clean($sec.attr("data-title")) ??
      "Menu";
    if (isLikelyChrome(title)) return;
    const items = extractItemsFromContainer($sec, $, pageUrl);
    if (items.length >= 2) sections.push({ title, items });
  });
  return mergeDuplicateSections(sections);
}

function extractItemsFromContainer(
  $container: Cheerio<Element>,
  $: CheerioAPI,
  pageUrl: string,
): MenuItem[] {
  const items: MenuItem[] = [];

  $container.find(ITEM_BLOCK_SELECTORS.join(",")).each((_, el) => {
    const $el = $(el);
    const item = parseItemElement($el, $, pageUrl);
    if (item) items.push(item);
  });

  if (items.length === 0) {
    // fall back to any li inside the container — but require a price string,
    // otherwise nav/footer links get picked up.
    $container.find("li").each((_, el) => {
      const $el = $(el);
      const item = parseItemElement($el, $, pageUrl, { requirePrice: true });
      if (item) items.push(item);
    });
  }

  return uniqByName(items);
}

function parseItemElement(
  $el: Cheerio<Element>,
  $: CheerioAPI,
  pageUrl: string,
  opts: { requirePrice?: boolean } = {},
): MenuItem | null {
  // Reject if inside obvious chrome (nav/header/footer/sidebar/etc.).
  if (isInChromeRegion($el)) return null;

  // Name lookup: dedicated child classes first.
  const nameSelectors = [
    "[class*='menu-item-title']",
    "[class*='menu-item-name']",
    "[class*='item-title']",
    "[class*='item-name']",
    "[class*='dish-name']",
    "[class*='dish-title']",
    "[class*='product-title']",
    "[class*='product-name']",
    "h1, h2, h3, h4, h5, .title, .name",
  ];
  let name: string | undefined;
  for (const sel of nameSelectors) {
    const t = clean($el.find(sel).first().text());
    if (t) {
      name = t;
      break;
    }
  }

  // Price lookup.
  const priceSelectors = [
    "[class*='price']",
    "[class*='amount']",
    "[class*='cost']",
    ".menu-item-price",
  ];
  let priceText: string | undefined;
  for (const sel of priceSelectors) {
    const t = clean($el.find(sel).first().text());
    if (!t) continue;
    const m = t.match(PRICE_RE);
    if (m && isValidPrice(m[0])) {
      priceText = m[0];
      break;
    }
  }

  // Description.
  const descSelectors = [
    "[class*='description']",
    "[class*='desc']",
    "[class*='detail']",
    "[class*='summary']",
    ".menu-item-description",
    "p",
  ];
  let description: string | undefined;
  for (const sel of descSelectors) {
    const $d = $el.find(sel).first();
    if (!$d.length) continue;
    if (name && clean($d.text()) === name) continue;
    const t = clean($d.text());
    if (t && t.length > 5 && (!priceText || !t.startsWith(priceText))) {
      description = t.slice(0, 400);
      break;
    }
  }

  // Fallback: parse the full text of the element.
  if (!name || !priceText) {
    const raw = clean($el.text());
    if (!raw) return null;
    const m = raw.match(PRICE_RE);
    if (m && !priceText && isValidPrice(m[0])) priceText = m[0];
    if (!name) {
      const candidate = raw
        .replace(priceText ?? "", "")
        .split(/[\n\.]/)[0]
        .trim();
      if (candidate.length >= 2 && candidate.length <= 100) name = candidate;
    }
  }

  if (!name || name.length < 2) return null;
  if (name.length > 120) return null;
  if (isLikelyChrome(name)) return null;
  if (opts.requirePrice && !priceText) return null;

  // Image.
  let image: ImageRef | undefined;
  const $img = $el.find("img").first();
  if ($img.length) {
    const url = pickImgUrl($img);
    if (url) {
      const abs = resolveUrl(pageUrl, url);
      if (abs && /^https?:\/\//i.test(abs) && !isPlaceholderUrl(abs)) {
        image = { url: abs, alt: clean($img.attr("alt")) };
      }
    }
  }

  return {
    name,
    description,
    price: priceText,
    image,
  };
}

const HEADING_KEYWORDS =
  /(menu|appetiz|starter|entrée|entree|main|dessert|drink|beverage|wine|cocktail|special|salad|soup|side|small[-\s]?plate|share|tapas|sushi|sashimi|grill|noodle|pizza|pasta|burger|breakfast|brunch|lunch|dinner|coffee|tea|wagyu|cuisine|sets?|combo|signature|chef|seasonal|kid|vegetarian|vegan|halal)/i;

function extractMenuFromHeadings(
  $: CheerioAPI,
  pageUrl: string,
): MenuSection[] {
  const sections: MenuSection[] = [];
  const headings = $("h2, h3, h4").toArray();
  for (const h of headings) {
    const $h = $(h);
    if (isInChromeRegion($h)) continue;
    const title = clean($h.text());
    if (!title) continue;
    if (title.length > 80) continue;
    if (isLikelyChrome(title)) continue;
    const items = collectMenuItemsAfter($, h, pageUrl);
    if (items.length >= 2) {
      sections.push({ title, items });
    }
  }
  // If many sections matched, prefer ones with keyword titles; otherwise keep all.
  if (sections.length > 12) {
    const keyworded = sections.filter((s) => HEADING_KEYWORDS.test(s.title));
    if (keyworded.length >= 3) return keyworded.slice(0, 20);
  }
  return mergeDuplicateSections(sections).slice(0, 20);
}

function collectMenuItemsAfter(
  $: CheerioAPI,
  heading: Element,
  pageUrl: string,
): MenuItem[] {
  const items: MenuItem[] = [];
  // Walk forward through siblings until we hit a stronger/equal heading.
  const stopAt = (heading.tagName || "").toLowerCase();
  const stopTags = stopAt === "h2"
    ? ["h1", "h2"]
    : stopAt === "h3"
      ? ["h1", "h2", "h3"]
      : ["h1", "h2", "h3", "h4"];
  let cur: Element | null = (heading as { next?: Element | null }).next ?? null;
  while (cur) {
    if (cur.type === "tag") {
      const tag = cur.tagName?.toLowerCase();
      if (tag && stopTags.includes(tag)) break;
      const $cur = $(cur);
      // 1. Try item-block selectors inside this sibling.
      $cur.find(ITEM_BLOCK_SELECTORS.join(",")).each((_, el) => {
        const item = parseItemElement($(el), $, pageUrl);
        if (item) items.push(item);
      });
      // 2. Try li within the sibling — require price to avoid nav lists.
      if (items.length === 0) {
        $cur.find("li").each((_, li) => {
          const item = parseItemElement($(li), $, pageUrl, { requirePrice: true });
          if (item) items.push(item);
        });
      }
      // 3. The sibling itself may be a single item card (require price).
      if (items.length === 0) {
        const direct = parseItemElement($cur, $, pageUrl, { requirePrice: true });
        if (direct) items.push(direct);
      }
    }
    cur = (cur as { next?: Element | null }).next ?? null;
  }
  return uniqByName(items).slice(0, 40);
}

function extractMenuFromDl($: CheerioAPI, pageUrl: string): MenuSection[] {
  const sections: MenuSection[] = [];
  $("dl").each((_, dl) => {
    const $dl = $(dl);
    if (isInChromeRegion($dl)) return;
    const heading = clean($dl.prev("h1, h2, h3, h4").text()) ?? "Menu";
    if (isLikelyChrome(heading)) return;
    const items: MenuItem[] = [];
    const children = $dl.children().toArray();
    for (let i = 0; i < children.length; i++) {
      const el = children[i];
      const tag = (el as { tagName?: string }).tagName?.toLowerCase();
      if (tag !== "dt") continue;
      const $dt = $(el);
      const nameText = clean($dt.text());
      if (!nameText) continue;
      const nameMatch = nameText.match(PRICE_RE);
      const name = (nameMatch ? nameText.replace(nameMatch[0], "") : nameText)
        .trim()
        .slice(0, 120);
      if (name.length < 2) continue;
      if (isLikelyChrome(name)) continue;
      const priceFromName = nameMatch && isValidPrice(nameMatch[0]) ? nameMatch[0] : undefined;
      let description: string | undefined;
      let priceText: string | undefined = priceFromName;
      // Scan following dd siblings.
      for (let j = i + 1; j < children.length; j++) {
        const nx = children[j];
        const nxTag = (nx as { tagName?: string }).tagName?.toLowerCase();
        if (nxTag !== "dd") break;
        const ddText = clean($(nx).text());
        if (!ddText) continue;
        const m = ddText.match(PRICE_RE);
        if (m && !priceText && isValidPrice(m[0])) priceText = m[0];
        const desc = (m ? ddText.replace(m[0], "") : ddText).trim();
        if (desc.length > 5 && !description) description = desc.slice(0, 400);
        i = j;
      }
      // DL fallback — require at least a price OR a real description to keep noise out.
      if (!priceText && !description) continue;
      items.push({ name, description, price: priceText, image: undefined });
      void pageUrl;
    }
    if (items.length >= 2) sections.push({ title: heading, items: uniqByName(items) });
  });
  return sections;
}

function extractMenuFromTables($: CheerioAPI, pageUrl: string): MenuSection[] {
  const sections: MenuSection[] = [];
  $("table").each((_, table) => {
    const $table = $(table);
    if (isInChromeRegion($table)) return;
    const heading =
      clean($table.find("caption").first().text()) ??
      clean($table.prev("h1, h2, h3, h4").text()) ??
      "Menu";
    if (isLikelyChrome(heading)) return;
    const items: MenuItem[] = [];
    $table.find("tr").each((_, tr) => {
      const $tr = $(tr);
      const cells = $tr.find("td").toArray().map((c) => clean($(c).text()) ?? "");
      if (cells.length < 2) return;
      const priceCellIdx = cells.findIndex((c) => {
        const m = c.match(PRICE_RE);
        return m && isValidPrice(m[0]);
      });
      if (priceCellIdx < 0) return;
      const priceMatch = cells[priceCellIdx].match(PRICE_RE);
      const nameCandidates = cells.filter((_, i) => i !== priceCellIdx);
      const name = nameCandidates
        .filter((c) => c && c.length >= 2 && c.length <= 100 && !isLikelyChrome(c))
        .sort((a, b) => b.length - a.length)[0];
      if (!name) return;
      const description = nameCandidates
        .filter((c) => c !== name && c.length > 8)
        .join(" — ")
        .slice(0, 400);
      items.push({
        name,
        description: description || undefined,
        price: priceMatch?.[0],
        image: undefined,
      });
      void pageUrl;
    });
    if (items.length >= 3) sections.push({ title: heading, items: uniqByName(items) });
  });
  return sections;
}

function extractFlatPricedItems($: CheerioAPI, pageUrl: string): MenuItem[] {
  const items: MenuItem[] = [];
  $("li, p, article, .menu-item, [class*='menu']").each((_, el) => {
    const $el = $(el);
    if ($el.children("li, article").length > 0) return;
    if (isInChromeRegion($el)) return;
    const text = clean($el.text());
    if (!text || text.length > 400) return;
    const m = text.match(PRICE_RE);
    if (!m || !isValidPrice(m[0])) return;
    const name = text
      .replace(m[0], "")
      .split("\n")[0]
      .trim()
      .slice(0, 100);
    if (name.length < 2) return;
    if (isLikelyChrome(name)) return;
    items.push({ name, price: m[0] });
    void pageUrl;
  });
  return uniqByName(items).slice(0, 40);
}

function mergeDuplicateSections(sections: MenuSection[]): MenuSection[] {
  const byTitle = new Map<string, MenuSection>();
  for (const s of sections) {
    const key = s.title.toLowerCase();
    const existing = byTitle.get(key);
    if (existing) {
      existing.items = uniqByName([...existing.items, ...s.items]);
    } else {
      byTitle.set(key, { ...s });
    }
  }
  return Array.from(byTitle.values());
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
    else if (Array.isArray(o.image) && typeof o.image[0] === "string")
      image = { url: o.image[0] };
    items.push({ name, description: desc, price, image });
  }
  return items;
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
  const heroImage = pickHeroImage(gallery);

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
