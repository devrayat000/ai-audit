import { NextRequest } from "next/server";
import { z } from "zod";
import { parseToken, signVerifiedProof } from "@/lib/verification/token";
import { checkDnsTxt } from "@/lib/verification/dns-verifier";
import { checkMetaTag } from "@/lib/verification/meta-verifier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  token: z.string(),
  method: z.enum(["dns-txt", "meta-tag"]),
  domain: z.string(),
  rootUrl: z.string().optional(),
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
  const { token, method, domain, rootUrl } = parsed.data;
  const t = parseToken(token);
  if (!t.valid) {
    return Response.json({ status: "failed", message: "Invalid or tampered token.", code: "BAD_TOKEN" }, { status: 400 });
  }
  if (Date.now() > t.expiresAt) {
    return Response.json({ status: "expired", message: "Token expired. Issue a new one." }, { status: 410 });
  }
  if (t.domain.toLowerCase() !== domain.toLowerCase()) {
    return Response.json({ status: "failed", message: "Token does not match domain." }, { status: 400 });
  }

  if (method === "dns-txt") {
    const r = await checkDnsTxt(domain, token);
    if (!r.ok) {
      return Response.json({
        status: "pending",
        message: r.error
          ? `DNS lookup failed: ${r.error}. Add the TXT record then try again (DNS can take a few minutes to propagate).`
          : `TXT record not found yet. Looking at _ai-audit.${domain}. ${r.records.length} other records found.`,
        records: r.records,
      });
    }
    const proof = signVerifiedProof(domain, "dns-txt");
    return Response.json({ status: "verified", proof: proof.proof, expiresAt: new Date(proof.expiresAt).toISOString(), method: "dns-txt" });
  }

  // meta-tag
  const target = rootUrl ?? `https://${domain}`;
  const r = await checkMetaTag(target, token);
  if (!r.ok) {
    return Response.json({
      status: "pending",
      message: r.error
        ? `Could not fetch ${target}: ${r.error}.`
        : r.found
          ? `Found a different ai-audit-verify value (${r.found.slice(0, 16)}…). Make sure you used the latest token.`
          : "Did not find a <meta name=\"ai-audit-verify\"> tag in the homepage HTML. Add it and try again.",
    });
  }
  const proof = signVerifiedProof(domain, "meta-tag");
  return Response.json({ status: "verified", proof: proof.proof, expiresAt: new Date(proof.expiresAt).toISOString(), method: "meta-tag" });
}
