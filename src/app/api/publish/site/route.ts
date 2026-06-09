import { NextRequest } from "next/server";
import { readPublishedSite } from "@/lib/sites/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const subdomain = searchParams.get("subdomain");

  if (!subdomain) {
    return Response.json(
      { error: "Missing subdomain parameter", code: "BAD_REQUEST" },
      { status: 400 }
    );
  }

  const site = await readPublishedSite(subdomain);
  if (!site) {
    return Response.json(
      { error: "Published site not found", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  return Response.json(site);
}
