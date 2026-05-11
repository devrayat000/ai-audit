import { isValidSubdomain, readPublishedSite } from "@/lib/sites/storage";
import { buildSiteLlmsFullTxt } from "@/lib/sites/geo-files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = await ctx.params;
  if (!isValidSubdomain(subdomain)) return new Response("Not found", { status: 404 });
  const site = await readPublishedSite(subdomain);
  if (!site) return new Response("Not found", { status: 404 });
  return new Response(buildSiteLlmsFullTxt(site), {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
