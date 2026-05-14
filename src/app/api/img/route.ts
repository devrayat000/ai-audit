import { NextRequest } from "next/server";
import { DEFAULT_HUMAN_UA } from "@/lib/utils/ai-bots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Image proxy. Fetches `?u=<encoded-url>` server-side and pipes bytes
 * back. Defeats hotlink protection (we control Referer/UA) and keeps
 * browser from leaking subdomain in `Referer` to third parties.
 *
 * Only allows http/https URLs. Returns upstream Content-Type. CDN cached
 * 1 day.
 *
 * Two-attempt strategy: try with same-origin Referer first (defeats
 * hotlink checks), then retry without Referer (some servers reject any
 * non-empty Referer). Uses real Chrome UA — bot-like UAs trigger 403s
 * on Cloudflare/Akamai/etc.
 */

const ALLOWED_CONTENT_TYPES = /^image\//i;

async function tryFetch(target: URL, withReferer: boolean): Promise<Response> {
  const headers: Record<string, string> = {
    "User-Agent": DEFAULT_HUMAN_UA,
    Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
  };
  if (withReferer) {
    headers.Referer = `${target.protocol}//${target.host}/`;
  }
  return fetch(target.toString(), {
    cache: "no-store",
    redirect: "follow",
    headers,
  });
}

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
    let upstream = await tryFetch(target, true);
    // Retry without Referer if rejected — some hosts return 403 on any Referer.
    if (!upstream.ok && (upstream.status === 403 || upstream.status === 401)) {
      upstream = await tryFetch(target, false);
    }
    if (!upstream.ok) {
      return new Response(`Upstream ${upstream.status}`, { status: 502 });
    }
    let contentType =
      upstream.headers.get("content-type") ?? "application/octet-stream";
    // Infer image/* from extension if upstream lied (some CDNs return
    // application/octet-stream for valid images).
    if (!ALLOWED_CONTENT_TYPES.test(contentType)) {
      const ext = target.pathname.toLowerCase().match(/\.(jpe?g|png|gif|webp|avif|svg|bmp|ico)(?:$|\?)/);
      if (ext) {
        const map: Record<string, string> = {
          jpg: "image/jpeg",
          jpeg: "image/jpeg",
          png: "image/png",
          gif: "image/gif",
          webp: "image/webp",
          avif: "image/avif",
          svg: "image/svg+xml",
          bmp: "image/bmp",
          ico: "image/x-icon",
        };
        contentType = map[ext[1]] ?? contentType;
      }
    }
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
