import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Image proxy. Fetches `?u=<encoded-url>` server-side and pipes the bytes
 * back. Defeats hotlink protection (we control the Referer / User-Agent) and
 * keeps the browser from leaking the subdomain in `Referer` to third parties.
 *
 * Only allows http/https URLs. Returns the upstream Content-Type. Caches at
 * the CDN for 1 day.
 */

const ALLOWED_CONTENT_TYPES = /^image\//i;

const FRIENDLY_UA =
  "Mozilla/5.0 (compatible; ShorobikImageProxy/1.0; +https://shorobik.com)";

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("u");
  if (!raw) return new Response("Missing u", { status: 400 });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new Response("Invalid URL", { status: 400 });
  }
  if (!/^https?:$/.test(target.protocol)) {
    return new Response("Unsupported protocol", { status: 400 });
  }

  try {
    const upstream = await fetch(target.toString(), {
      cache: "no-store",
      redirect: "follow",
      headers: {
        "User-Agent": FRIENDLY_UA,
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        // Spoof a same-origin referer to the asset's own host — kills hotlink protection.
        Referer: `${target.protocol}//${target.host}/`,
      },
    });
    if (!upstream.ok) {
      return new Response(`Upstream ${upstream.status}`, { status: 502 });
    }
    const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
    if (!ALLOWED_CONTENT_TYPES.test(contentType)) {
      return new Response(`Refusing non-image content-type: ${contentType}`, {
        status: 415,
      });
    }
    const bytes = await upstream.arrayBuffer();
    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=86400, immutable",
        "X-Proxied-From": target.host,
      },
    });
  } catch (e) {
    return new Response(
      `Proxy error: ${e instanceof Error ? e.message : "unknown"}`,
      { status: 502 },
    );
  }
}
