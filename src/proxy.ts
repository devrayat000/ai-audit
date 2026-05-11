import { NextRequest, NextResponse } from "next/server";

// Hosts we treat as "app" (not subdomain content):
//   - localhost / 127.0.0.1
//   - root apex (e.g. shorobik.com)
//   - www.<apex>
// Anything else with a single subdomain label gets rewritten to /sites/<label>.

const APEX_HOSTS = (process.env.SITE_APEX_HOSTS ?? "shorobik.com,localhost:3000,localhost")
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

function extractSubdomain(host: string): string | null {
  const lower = host.toLowerCase();
  if (APEX_HOSTS.includes(lower)) return null;
  for (const apex of APEX_HOSTS) {
    if (lower === `www.${apex}`) return null;
    if (lower.endsWith(`.${apex}`)) {
      const sub = lower.slice(0, -1 - apex.length);
      if (!sub || sub === "www") return null;
      if (sub.includes(".")) return null;
      return sub;
    }
  }
  // dev convenience: <sub>.localhost / <sub>.lvh.me
  const m = lower.match(/^([a-z0-9-]+)\.(localhost|lvh\.me)(:\d+)?$/);
  if (m) return m[1];
  return null;
}

export function proxy(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  const sub = extractSubdomain(host);
  if (!sub) return NextResponse.next();

  const url = req.nextUrl.clone();
  const path = url.pathname;
  if (
    path.startsWith("/api") ||
    path.startsWith("/_next") ||
    path.startsWith("/sites/")
  ) {
    return NextResponse.next();
  }
  if (
    /\.(?:png|jpe?g|gif|webp|svg|ico|css|js|map|json|woff2?|ttf|eot|mp4|webm|mp3)$/i.test(path)
  ) {
    return NextResponse.next();
  }
  url.pathname = `/sites/${sub}${path === "/" ? "" : path}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
