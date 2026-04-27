import Sitemapper from "sitemapper";
import { fetchText } from "../utils/http";
import { resolveUrl } from "../utils/url";

export async function discoverSitemapUrls(rootUrl: string, robotsTxt: string | null): Promise<{
  urls: string[];
  status: number | null;
  sitemapsTried: string[];
}> {
  const candidates: string[] = [];
  if (robotsTxt) {
    const m = robotsTxt.match(/^\s*sitemap:\s*(.+)$/gim);
    if (m) {
      m.forEach((line) => {
        const u = line.split(/:\s*/i).slice(1).join(":").trim();
        if (u) candidates.push(u);
      });
    }
  }
  const u = new URL(rootUrl);
  candidates.push(`${u.origin}/sitemap.xml`);
  candidates.push(`${u.origin}/sitemap_index.xml`);

  const urls = new Set<string>();
  let status: number | null = null;
  const tried: string[] = [];

  for (const sm of candidates.slice(0, 4)) {
    tried.push(sm);
    try {
      const mapper = new Sitemapper({
        url: sm,
        timeout: 8000,
      });
      const res = await mapper.fetch();
      const sites = res.sites as Array<string | { loc?: string }>;
      if (sites && sites.length > 0) {
        sites.forEach((s) => {
          if (typeof s === "string") urls.add(s);
          else if (s && typeof s.loc === "string") urls.add(s.loc);
        });
        if (status === null) status = 200;
      }
    } catch {
      // try next
    }
    if (urls.size > 0) break;
  }

  if (urls.size === 0) {
    // try plain HTTP fetch of the first one
    for (const sm of candidates.slice(0, 2)) {
      const r = await fetchText(sm);
      status = r.status;
      if (r.ok && r.body) {
        const matches = r.body.match(/<loc>\s*([^<\s]+)\s*<\/loc>/gi) ?? [];
        matches.forEach((m) => {
          const inner = m.replace(/<\/?loc>/gi, "").trim();
          if (inner) urls.add(inner);
        });
        if (urls.size > 0) break;
      }
    }
  }

  return { urls: Array.from(urls), status, sitemapsTried: tried };
}

export function extractInternalLinks(
  links: string[],
  rootUrl: string
): string[] {
  const out = new Set<string>();
  let rootHost: string;
  try {
    rootHost = new URL(rootUrl).hostname.replace(/^www\./, "");
  } catch {
    return [];
  }
  for (const l of links) {
    const r = resolveUrl(rootUrl, l);
    if (!r) continue;
    try {
      const u = new URL(r);
      const h = u.hostname.replace(/^www\./, "");
      if (h !== rootHost) continue;
      if (!/^https?:$/.test(u.protocol)) continue;
      u.hash = "";
      out.add(u.toString());
    } catch {}
  }
  return Array.from(out);
}
