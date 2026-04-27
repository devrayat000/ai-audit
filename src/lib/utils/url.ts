export function normalizeUrl(input: string): string {
  let url = input.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = "https://" + url;
  }
  try {
    const u = new URL(url);
    u.hash = "";
    return u.toString().replace(/\/$/, "");
  } catch {
    return url;
  }
}

export function getDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function sameDomain(a: string, b: string): boolean {
  try {
    const ha = new URL(a).hostname.replace(/^www\./, "");
    const hb = new URL(b).hostname.replace(/^www\./, "");
    return ha === hb;
  } catch {
    return false;
  }
}

export function resolveUrl(base: string, href: string): string | null {
  try {
    return new URL(href, base).toString().split("#")[0];
  } catch {
    return null;
  }
}

export function isHtmlUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return false;
    if (
      /\.(jpg|jpeg|png|gif|svg|webp|ico|css|js|mjs|json|xml|pdf|zip|mp3|mp4|webm|woff2?|ttf|otf|eot)$/i.test(
        u.pathname
      )
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function shortId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
