/**
 * Helper for routing all template images through our server-side proxy.
 * Defeats hotlink protection on the origin site, strips the subdomain
 * referer, and lets us cache aggressively at the CDN.
 */
export function proxied(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  if (!/^https?:\/\//i.test(url)) return undefined;
  return `/api/img?u=${encodeURIComponent(url)}`;
}
