import { NextRequest } from "next/server";
import { z } from "zod";
import { ruleBasedFor } from "@/lib/recommendations/advisor";
import type { CheckResult, Industry, SiteData } from "@/lib/types";

export const runtime = "nodejs";

const schema = z.object({
  industry: z.enum(["restaurant", "travel", "service", "ecommerce", "blog", "general"]),
  rootUrl: z.string(),
  domain: z.string(),
  check: z.unknown(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON", code: "BAD_BODY" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message, code: "VALIDATION" }, { status: 400 });
  }
  const site: SiteData = {
    rootUrl: parsed.data.rootUrl,
    domain: parsed.data.domain,
    robotsTxt: null,
    robotsTxtStatus: null,
    sitemapUrls: [],
    sitemapStatus: null,
    llmsTxt: null,
    llmsFullTxt: null,
    industry: parsed.data.industry as Industry,
    homepageHeaders: {},
    redirectsHttps: false,
    canonicalHostMatch: false,
    certValid: false,
  };
  const recs = ruleBasedFor(parsed.data.check as CheckResult, site, undefined);
  return Response.json({ recommendations: recs });
}
