import { runRegeneration } from "@/lib/regenerator";
import type { RegenInput, RegenResult } from "@/lib/regenerator/types";
import {
  patchRunStatus,
  writeRunStatus,
  buildInitialStatus,
} from "@/lib/workflow/status-store";
import { getWritable } from "workflow";

/**
 * Regeneration workflow.
 *
 * `"use workflow"` makes this an orchestrator — it can suspend and resume
 * across multiple requests without holding the serverless function open.
 * Each `"use step"` function below runs as its own request and is checkpointed.
 */
export async function regenerationWorkflow(
  runId: string,
  input: RegenInput,
): Promise<void> {
  "use workflow";

  await initRegenRun(runId, input);
  try {
    const result = await regenerateAll(runId, input);
    await markRegenCompleted(runId, result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markRegenFailed(runId, message);
  }
}

async function initRegenRun(runId: string, input: RegenInput): Promise<void> {
  "use step";
  const initial = buildInitialStatus<RegenResult>(runId, "regen", {
    rootUrl: input.rootUrl,
    industry: input.industry,
    strategy: input.strategy,
  });
  initial.state = "running";
  initial.message = `Regenerating ${input.rootUrl}…`;
  await writeRunStatus(initial);
  const writer = getWritable<string>().getWriter();
  await writeStreamChunk(writer, {
    state: "running",
    message: initial.message,
    progress: initial.progress,
    meta: initial.meta,
  });
  writer.releaseLock();
}

async function regenerateAll(
  runId: string,
  input: RegenInput,
): Promise<RegenResult> {
  "use step";
  const writer = getWritable<string>().getWriter();
  try {
    return await runRegeneration(input, {
      onProgress: async (event) => {
        const meta: Record<string, unknown> = {
          type: event.type,
          ...(event.payload ?? {}),
        };
        const message = friendlyRegenMessage(event);
        const progress = approximateRegenProgress(event);
        await patchRunStatus<RegenResult>("regen", runId, {
          state: "running",
          message,
          progress,
          meta,
        });
        await writeStreamChunk(writer, {
          state: "running",
          message,
          progress,
          meta,
        });
      },
    });
  } finally {
    writer.releaseLock();
  }
}

async function markRegenCompleted(
  runId: string,
  result: RegenResult,
): Promise<void> {
  "use step";
  await patchRunStatus<RegenResult>("regen", runId, {
    state: "completed",
    progress: 100,
    message: "Regeneration complete.",
    result,
  });
  const writer = getWritable<string>().getWriter();
  await writeStreamChunk(writer, {
    state: "completed",
    message: "Regeneration complete.",
    progress: 100,
    result,
  });
  await writer.write("data: [DONE]\n\n");
  await writer.close();
}

async function markRegenFailed(runId: string, message: string): Promise<void> {
  "use step";
  await patchRunStatus<RegenResult>("regen", runId, {
    state: "failed",
    error: message,
    message: `Regeneration failed: ${message}`,
  });
  const writer = getWritable<string>().getWriter();
  await writeStreamChunk(writer, {
    state: "failed",
    message: `Regeneration failed: ${message}`,
    error: message,
  });
  await writer.write("data: [DONE]\n\n");
  await writer.close();
}

async function writeStreamChunk<T>(
  writer: WritableStreamDefaultWriter<string>,
  payload: T,
): Promise<void> {
  await writer.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function friendlyRegenMessage(event: {
  type: string;
  payload?: Record<string, unknown>;
}): string {
  const p = event.payload ?? {};
  const name = typeof p.name === "string" ? p.name : "";
  switch (event.type) {
    case "phase":
      return typeof p.message === "string" ? p.message : `Starting ${name}…`;
    case "phase-done":
      return `Finished ${name}.`;
    case "phase-warn":
      return typeof p.message === "string"
        ? p.message
        : `Warning during ${name}.`;
    case "page-start":
      return typeof p.url === "string"
        ? `Transforming ${p.url}`
        : "Transforming page";
    case "page-done":
      return typeof p.url === "string" ? `Done ${p.url}` : "Done page";
    default:
      return event.type;
  }
}

function approximateRegenProgress(event: {
  type: string;
  payload?: Record<string, unknown>;
}): number | undefined {
  const p = event.payload ?? {};
  if (event.type === "phase" && p.name === "crawl") return 5;
  if (event.type === "phase-done" && p.name === "crawl") return 25;
  if (
    event.type === "page-done" &&
    typeof p.index === "number" &&
    typeof p.total === "number"
  ) {
    const ratio = (p.index as number) / (p.total as number);
    return Math.round(25 + ratio * 60);
  }
  if (event.type === "phase-done" && p.name === "transform") return 85;
  if (event.type === "phase" && p.name === "bundle") return 88;
  if (event.type === "phase-done" && p.name === "bundle") return 92;
  if (event.type === "phase" && p.name === "upload") return 94;
  if (event.type === "phase-done" && p.name === "upload") return 99;
  return undefined;
}
