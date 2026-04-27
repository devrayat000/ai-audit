import { NextRequest } from "next/server";
import { z } from "zod";
import { recommendStrategy } from "@/lib/regenerator/strategy";
import type { AuditReport } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  audit: z
    .object({
      pages: z.array(z.object({ jsDependencyRatio: z.number(), url: z.string() })),
    })
    .partial()
    .passthrough()
    .optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {}
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message, code: "VALIDATION" }, { status: 400 });
  }
  const rec = recommendStrategy(parsed.data.audit as unknown as AuditReport | undefined);
  return Response.json(rec);
}
