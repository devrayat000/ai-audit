import { NextRequest } from "next/server";
import { z } from "zod";
import { issueVerificationToken } from "@/lib/verification/token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  domain: z.string().min(3),
});

function normalizeDomain(input: string): string {
  let d = input.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "");
  d = d.replace(/\/.*$/, "");
  d = d.replace(/^www\./, "");
  return d;
}

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
  const domain = normalizeDomain(parsed.data.domain);
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
    return Response.json({ error: "Invalid domain", code: "BAD_DOMAIN" }, { status: 400 });
  }
  const t = issueVerificationToken(domain);
  return Response.json({
    domain,
    token: t.token,
    randomPart: t.randomPart,
    issuedAt: new Date(t.issuedAt).toISOString(),
    expiresAt: new Date(t.expiresAt).toISOString(),
    dnsRecord: {
      name: `_ai-audit.${domain}`,
      type: "TXT",
      value: t.token,
    },
    metaTag: `<meta name="ai-audit-verify" content="${t.token}">`,
  });
}
