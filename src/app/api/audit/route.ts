import { NextRequest } from "next/server";
import { z } from "zod";
import { runAudit } from "@/lib/audit/runner";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const schema = z.object({
  url: z.string().min(4),
  industry: z
    .enum(["restaurant", "travel", "service", "ecommerce", "blog", "general"])
    .optional(),
  maxPages: z.number().int().min(1).max(50).optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body", code: "BAD_BODY" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues.map((i) => i.message).join("; "), code: "VALIDATION" },
      { status: 400 }
    );
  }
  try {
    const report = await runAudit({
      url: parsed.data.url,
      industry: parsed.data.industry,
      maxPages: parsed.data.maxPages ?? 12,
    });
    return Response.json(report);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Audit failed", code: "AUDIT_FAILED" },
      { status: 500 }
    );
  }
}
