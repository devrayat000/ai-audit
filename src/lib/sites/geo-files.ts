import type { PublishedSite, RestaurantData } from "./types";

const AI_BOTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-Web",
  "PerplexityBot",
  "Google-Extended",
  "CCBot",
  "Applebot-Extended",
  "Amazonbot",
  "Meta-ExternalAgent",
  "Bytespider",
];

export function buildSiteRobotsTxt(site: PublishedSite): string {
  const sitemap = `${site.meta.canonical.replace(/\/$/, "")}/sitemap.xml`;
  const lines: string[] = ["User-agent: *", "Allow: /", ""];
  for (const b of AI_BOTS) {
    lines.push(`User-agent: ${b}`);
    lines.push("Allow: /");
    lines.push("");
  }
  lines.push(`Sitemap: ${sitemap}`);
  lines.push("");
  return lines.join("\n");
}

export function buildSiteSitemap(site: PublishedSite): string {
  const root = site.meta.canonical.replace(/\/$/, "");
  const date = new Date(site.updatedAt).toISOString().slice(0, 10);
  const entries = [root, `${root}/llms.txt`, `${root}/llms-full.txt`];
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ];
  for (const url of entries) {
    lines.push("  <url>");
    lines.push(`    <loc>${escapeXml(url)}</loc>`);
    lines.push(`    <lastmod>${date}</lastmod>`);
    lines.push("  </url>");
  }
  lines.push("</urlset>");
  return lines.join("\n");
}

export function buildSiteLlmsTxt(site: PublishedSite): string {
  if (site.geo?.llmsTxt) return site.geo.llmsTxt;
  const name = site.data.name;
  const desc = site.geo?.summary ?? site.data.description ?? site.meta.description;
  const root = site.meta.canonical.replace(/\/$/, "");
  const lines: string[] = [];
  lines.push(`# ${name}`);
  lines.push("");
  if (desc) lines.push(`> ${desc}`);
  lines.push("");
  lines.push("## Key pages");
  lines.push("");
  lines.push(`- [Home](${root}/): Overview, hours, contact`);
  if (site.data.industry === "restaurant" && (site.data as RestaurantData).menu) {
    lines.push(`- [Menu](${root}/#menu): Dishes & pricing`);
  }
  lines.push(`- [Visit](${root}/#contact): Address, hours, social`);
  lines.push("");
  lines.push("## About");
  lines.push("");
  lines.push((site.geo?.about ?? site.data.about ?? desc ?? "").replace(/\n/g, " "));
  lines.push("");
  if (site.geo?.faqs && site.geo.faqs.length > 0) {
    lines.push("## FAQ");
    lines.push("");
    for (const qa of site.geo.faqs) {
      lines.push(`### ${qa.q}`);
      lines.push("");
      lines.push(qa.a);
      lines.push("");
    }
  }
  return lines.join("\n");
}

export function buildSiteLlmsFullTxt(site: PublishedSite): string {
  if (site.geo?.llmsFullTxt) return site.geo.llmsFullTxt;
  const root = site.meta.canonical.replace(/\/$/, "");
  const d = site.data;
  const out: string[] = [];
  out.push(`# ${d.name}`);
  out.push("");
  if (site.geo?.summary) {
    out.push(`> ${site.geo.summary}`);
    out.push("");
  } else if (d.description) {
    out.push(`> ${d.description}`);
    out.push("");
  }
  out.push(`Source URL: ${root}`);
  out.push("");

  if (d.industry === "restaurant") {
    const r = d as RestaurantData;
    if (r.cuisine?.length) {
      out.push(`Cuisine: ${r.cuisine.join(", ")}`);
    }
    if (r.priceRange) out.push(`Price range: ${r.priceRange}`);
    out.push("");

    out.push("## Contact");
    if (r.contact.phone) out.push(`Phone: ${r.contact.phone}`);
    if (r.contact.email) out.push(`Email: ${r.contact.email}`);
    const addr = [
      r.contact.street,
      [r.contact.city, r.contact.region, r.contact.postalCode].filter(Boolean).join(", "),
      r.contact.country,
    ]
      .filter(Boolean)
      .join(" / ");
    if (addr) out.push(`Address: ${addr}`);
    out.push("");

    if (r.hours && r.hours.length > 0) {
      out.push("## Opening hours");
      for (const h of r.hours) {
        out.push(
          `- ${h.day}: ${h.closed ? "Closed" : h.opens && h.closes ? `${h.opens}–${h.closes}` : "—"}`,
        );
      }
      out.push("");
    }

    if (r.menu && r.menu.sections.length > 0) {
      out.push("## Menu");
      for (const sec of r.menu.sections) {
        out.push(`### ${sec.title}`);
        for (const item of sec.items) {
          out.push(`- **${item.name}**${item.price ? ` — ${item.price}` : ""}`);
          if (item.description) out.push(`  ${item.description}`);
        }
        out.push("");
      }
    }
  }

  if (site.geo?.faqs && site.geo.faqs.length > 0) {
    out.push("## Frequently asked questions");
    for (const qa of site.geo.faqs) {
      out.push(`### ${qa.q}`);
      out.push(qa.a);
      out.push("");
    }
  }

  out.push("## Social");
  for (const [k, v] of Object.entries(d.social)) {
    if (v) out.push(`- ${k}: ${v}`);
  }

  return out.join("\n");
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
