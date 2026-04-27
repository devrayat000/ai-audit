export function buildSitemap(urls: string[], lastmod?: string): string {
  const date = (lastmod ?? new Date().toISOString().slice(0, 10));
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">');
  for (const u of urls) {
    lines.push("  <url>");
    lines.push(`    <loc>${escapeXml(u)}</loc>`);
    lines.push(`    <lastmod>${date}</lastmod>`);
    lines.push("  </url>");
  }
  lines.push("</urlset>");
  return lines.join("\n");
}

export function buildSitemapWithAlternates(
  pairs: Array<{ url: string; alternates: Array<{ hreflang: string; href: string }> }>,
  lastmod?: string
): string {
  const date = lastmod ?? new Date().toISOString().slice(0, 10);
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">');
  for (const p of pairs) {
    lines.push("  <url>");
    lines.push(`    <loc>${escapeXml(p.url)}</loc>`);
    lines.push(`    <lastmod>${date}</lastmod>`);
    for (const a of p.alternates) {
      lines.push(`    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${escapeXml(a.href)}"/>`);
    }
    lines.push("  </url>");
  }
  lines.push("</urlset>");
  return lines.join("\n");
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
