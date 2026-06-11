import { NextRequest } from "next/server";
import { z } from "zod";
import { resumeHook } from "workflow/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  runId: z.string(),
  answers: z.record(z.string(), z.string()),
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
      { status: 400 }
    );
  }

  const { runId, answers } = parsed.data;

  try {
    // Resume the workflow hook matching the customize run
    await resumeHook(`customize:${runId}`, answers);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      {
        error: e instanceof Error ? e.message : "Failed to resume publish workflow hook",
        code: "RESUME_FAILED",
      },
      { status: 500 }
    );
  }
}
