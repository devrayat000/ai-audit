import { NextRequest } from "next/server";
import { z } from "zod";
import { readRunStatus, type RunKind } from "@/lib/workflow/status-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  runId: z.string().min(8),
  kind: z.enum(["regen", "deploy", "publish"]).default("regen"),
});

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const parsed = querySchema.safeParse({
    runId: sp.get("runId") ?? "",
    kind: sp.get("kind") ?? "regen",
  });
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message, code: "VALIDATION" }, { status: 400 });
  }
  const status = await readRunStatus(parsed.data.kind as RunKind, parsed.data.runId);
  if (!status) {
    return Response.json(
      { error: "Run not found", code: "NOT_FOUND", runId: parsed.data.runId },
      { status: 404 },
    );
  }
  return Response.json(status, {
    headers: { "Cache-Control": "no-store" },
  });
}
