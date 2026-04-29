import { NextRequest } from "next/server";
import { z } from "zod";
import { start } from "workflow/api";
import { deployWorkflow } from "@/workflows/deploy";
import {
  newRunId,
  writeRunStatus,
  buildInitialStatus,
} from "@/lib/workflow/status-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z
  .object({
    zipUrl: z.string().url().optional(),
    zipBase64: z.string().min(20).optional(),
    projectNameSeed: z.string().min(1),
  })
  .refine((d) => !!d.zipUrl || !!d.zipBase64, {
    message: "Provide either zipUrl (preferred, blob) or zipBase64 (fallback).",
  });

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON", code: "BAD_BODY" },
      { status: 400 },
    );
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.message, code: "VALIDATION" },
      { status: 400 },
    );
  }

  const runId = newRunId();
  await writeRunStatus(
    buildInitialStatus(runId, "deploy", {
      projectNameSeed: parsed.data.projectNameSeed,
      via: parsed.data.zipUrl ? "blob" : "inline-base64",
    }),
  );

  try {
    const run = await start(deployWorkflow, [
      runId,
      {
        zipUrl: parsed.data.zipUrl,
        zipBase64: parsed.data.zipBase64,
        projectNameSeed: parsed.data.projectNameSeed,
      },
    ]);
    return new Response(run.readable, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    return Response.json(
      {
        error: e instanceof Error ? e.message : "Failed to start workflow",
        code: "WORKFLOW_START_FAILED",
      },
      { status: 500 },
    );
  }
}
