import { NextRequest } from "next/server";
import { z } from "zod";
import {
  findAvailableSubdomain,
  isReservedSubdomain,
  isValidSubdomain,
  normalizeSubdomain,
  readPublishedSite,
} from "@/lib/sites/storage";
import { normalizeUrl } from "@/lib/utils/url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  subdomain: z.string().min(2).max(63),
  /** When provided, lets us tell the user that the slot is "yours" (same source URL). */
  sourceUrl: z.string().optional(),
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
    return Response.json(
      { error: parsed.error.message, code: "VALIDATION" },
      { status: 400 },
    );
  }
  const subdomain = normalizeSubdomain(parsed.data.subdomain);
  if (!isValidSubdomain(subdomain)) {
    return Response.json({
      ok: false,
      subdomain,
      reason: "Subdomain must be alphanumeric, may include dashes, 2–63 chars.",
    });
  }
  if (isReservedSubdomain(subdomain)) {
    return Response.json({ ok: false, subdomain, reason: "Reserved." });
  }
  const existing = await readPublishedSite(subdomain);
  if (existing) {
    const sourceUrl = parsed.data.sourceUrl
      ? normalizeUrl(parsed.data.sourceUrl)
      : null;
    const sameSource =
      !!sourceUrl &&
      existing.sourceUrl.replace(/\/$/, "") === sourceUrl.replace(/\/$/, "");
    const suggestion = sameSource
      ? null
      : await findAvailableSubdomain(subdomain);
    return Response.json({
      ok: false,
      subdomain,
      reason: sameSource
        ? "Already published from this site. Updating will overwrite."
        : `Already published from ${existing.sourceUrl}.`,
      takenBy: existing.sourceUrl,
      sameSource,
      suggestion,
    });
  }
  return Response.json({ ok: true, subdomain });
}
