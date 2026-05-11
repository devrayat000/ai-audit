import { NextRequest } from "next/server";
import { z } from "zod";
import {
  isValidSubdomain,
  normalizeSubdomain,
  readPublishedSite,
} from "@/lib/sites/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  subdomain: z.string().min(2).max(63),
});

const RESERVED = new Set([
  "www", "api", "app", "admin", "mail", "blog", "ftp",
  "ns1", "ns2", "ns3", "ns4", "smtp", "pop", "imap",
  "test", "dev", "staging", "preview", "sites",
]);

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
  const subdomain = normalizeSubdomain(parsed.data.subdomain);
  if (!isValidSubdomain(subdomain)) {
    return Response.json({
      ok: false,
      subdomain,
      reason: "Subdomain must be alphanumeric, may include dashes, 2–63 chars.",
    });
  }
  if (RESERVED.has(subdomain)) {
    return Response.json({ ok: false, subdomain, reason: "Reserved." });
  }
  const existing = await readPublishedSite(subdomain);
  if (existing) {
    return Response.json({
      ok: false,
      subdomain,
      reason: `Already published from ${existing.sourceUrl}.`,
      takenBy: existing.sourceUrl,
    });
  }
  return Response.json({ ok: true, subdomain });
}
