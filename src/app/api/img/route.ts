import { NextRequest } from "next/server";
import { DEFAULT_HUMAN_UA } from "@/lib/utils/ai-bots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Image proxy. Fetches `?u=<encoded-url>` server-side and pipes bytes
 * back. Defeats hotlink protection (we control Referer/UA) and keeps
 * browser from leaking subdomain in `Referer` to third parties.
 *
 * Strategy:
 *   1. Real Chrome UA + same-origin Referer (defeats most hotlink checks)
 *   2. Retry without Referer (some servers reject any non-empty Referer)
 *   3. Retry with mobile UA + no Referer (defeats UA-based blocks)
 * Each attempt has a 12s timeout.
 *
 * Content-type: trust upstream image/* directly; otherwise infer from
 * URL extension; otherwise sniff first 16 bytes for magic numbers.
 */

const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const FETCH_TIMEOUT_MS = 12000;

const ALLOWED_CONTENT_TYPES = /^image\//i;

interface Attempt {
  ua: string;
  withReferer: boolean;
}

const ATTEMPTS: Attempt[] = [
  { ua: DEFAULT_HUMAN_UA, withReferer: true },
  { ua: DEFAULT_HUMAN_UA, withReferer: false },
  { ua: MOBILE_UA, withReferer: false },
];

async function tryFetch(target: URL, attempt: Attempt): Promise<Response | null> {
  const headers: Record<string, string> = {
    "User-Agent": attempt.ua,
    Accept:
      "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
  };
  if (attempt.withReferer) {
    headers.Referer = `${target.protocol}//${target.host}/`;
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(target.toString(), {
      cache: "no-store",
      redirect: "follow",
      headers,
      signal: ctrl.signal,
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function extFromPath(pathname: string): string | null {
  const m = pathname
    .toLowerCase()
    .match(/\.(jpe?g|png|gif|webp|avif|svg|bmp|ico)(?:$|\?)/);
  if (!m) return null;
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
  return map[m[1]] ?? null;
}

function sniffMagicBytes(bytes: Uint8Array): string | null {
  if (bytes.length < 4) return null;
  const b = bytes;
  // JPEG: FF D8 FF
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  // PNG: 89 50 4E 47
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47)
    return "image/png";
  // GIF: GIF8
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38)
    return "image/gif";
  // WEBP: RIFF....WEBP
  if (
    b.length >= 12 &&
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  )
    return "image/webp";
  // AVIF/HEIC: 00 00 00 ?? 66 74 79 70 (ftyp)
  if (
    b.length >= 12 &&
    b[4] === 0x66 &&
    b[5] === 0x74 &&
    b[6] === 0x79 &&
    b[7] === 0x70
  )
    return "image/avif";
  // BMP: 42 4D
  if (b[0] === 0x42 && b[1] === 0x4d) return "image/bmp";
  // SVG: starts with <svg or <?xml then <svg
  const head = new TextDecoder().decode(b.slice(0, Math.min(b.length, 200))).toLowerCase();
  if (head.includes("<svg")) return "image/svg+xml";
  return null;
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

  let lastStatus = 0;
  let lastError = "";

  for (const attempt of ATTEMPTS) {
    const upstream = await tryFetch(target, attempt);
    if (!upstream) {
      lastError = "fetch failed or timed out";
      continue;
    }
    lastStatus = upstream.status;
    // Retry-eligible failure codes — try next attempt.
    if (
      !upstream.ok &&
      (upstream.status === 401 ||
        upstream.status === 403 ||
        upstream.status === 405 ||
        upstream.status === 429 ||
        upstream.status >= 500)
    ) {
      continue;
    }
    if (!upstream.ok) {
      return new Response(`Upstream ${upstream.status}`, { status: 502 });
    }

    const bytes = new Uint8Array(await upstream.arrayBuffer());
    let contentType =
      upstream.headers.get("content-type")?.split(";")[0].trim() ??
      "application/octet-stream";

    if (!ALLOWED_CONTENT_TYPES.test(contentType)) {
      const extType = extFromPath(target.pathname);
      if (extType) contentType = extType;
    }
    if (!ALLOWED_CONTENT_TYPES.test(contentType)) {
      const sniffed = sniffMagicBytes(bytes);
      if (sniffed) contentType = sniffed;
    }
    if (!ALLOWED_CONTENT_TYPES.test(contentType)) {
      // Likely a WAF/challenge HTML page — try next attempt.
      lastError = `non-image content-type: ${contentType}`;
      continue;
    }

    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=86400, immutable",
        "X-Proxied-From": target.host,
      },
    });
  }

  return new Response(
    `Proxy error: all attempts failed (last status ${lastStatus || "n/a"}: ${lastError || "unknown"})`,
    { status: 502 },
  );
}
