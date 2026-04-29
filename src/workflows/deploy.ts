import { runVercelDeploy, type DeployRunResult } from "@/lib/deploy/vercel";
import {
  buildInitialStatus,
  patchRunStatus,
  writeRunStatus,
} from "@/lib/workflow/status-store";
import { getWritable } from "workflow";

export interface DeployInput {
  zipUrl?: string;
  zipBase64?: string;
  projectNameSeed: string;
}

/**
 * Deploy workflow. Orchestrates one workflow-suspendable run that uploads the
 * regenerated bundle to Vercel and reports progress through the run status.
 */
export async function deployWorkflow(
  runId: string,
  input: DeployInput,
): Promise<void> {
  "use workflow";

  await initDeployRun(runId, input);
  try {
    const r = await runDeployStep(runId, input);
    if (r.error) {
      await markDeployFailed(runId, r.error, r.events);
    } else {
      await markDeployCompleted(runId, r);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markDeployFailed(runId, message, []);
  }
}

async function initDeployRun(runId: string, input: DeployInput): Promise<void> {
  "use step";
  const initial = buildInitialStatus<DeployRunResult>(runId, "deploy", {
    projectNameSeed: input.projectNameSeed,
    via: input.zipUrl ? "blob" : "inline-base64",
  });
  initial.state = "running";
  initial.message = `Deploying ${input.projectNameSeed} to Vercel…`;
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

async function runDeployStep(
  runId: string,
  input: DeployInput,
): Promise<DeployRunResult> {
  "use step";
  const writer = getWritable<string>().getWriter();
  try {
    return await runVercelDeploy({
      zipUrl: input.zipUrl,
      zipBase64: input.zipBase64,
      projectNameSeed: input.projectNameSeed,
      onEvent: async (ev) => {
        const message = friendlyDeployMessage(ev);
        const meta = { type: ev.type, ...(toRecord(ev.payload) ?? {}) };
        await patchRunStatus<DeployRunResult>("deploy", runId, {
          state: "running",
          message,
          meta,
        });
        await writeStreamChunk(writer, {
          state: "running",
          message,
          meta,
        });
      },
    });
  } finally {
    writer.releaseLock();
  }
}

async function markDeployCompleted(
  runId: string,
  result: DeployRunResult,
): Promise<void> {
  "use step";
  await patchRunStatus<DeployRunResult>("deploy", runId, {
    state: "completed",
    progress: 100,
    message: result.deploymentUrl
      ? `Live at ${result.deploymentUrl}`
      : "Deployment finished.",
    result,
  });
  const writer = getWritable<string>().getWriter();
  await writeStreamChunk(writer, {
    state: "completed",
    progress: 100,
    message: result.deploymentUrl
      ? `Live at ${result.deploymentUrl}`
      : "Deployment finished.",
    result,
  });
  await writer.write("data: [DONE]\n\n");
  await writer.close();
}

async function markDeployFailed(
  runId: string,
  errorMessage: string,
  events: DeployRunResult["events"],
): Promise<void> {
  "use step";
  await patchRunStatus<DeployRunResult>("deploy", runId, {
    state: "failed",
    error: errorMessage,
    message: `Deploy failed: ${errorMessage}`,
    result: { events, error: errorMessage },
  });
  const writer = getWritable<string>().getWriter();
  await writeStreamChunk(writer, {
    state: "failed",
    message: `Deploy failed: ${errorMessage}`,
    error: errorMessage,
    result: { events, error: errorMessage },
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

function toRecord(p: unknown): Record<string, unknown> | undefined {
  if (!p || typeof p !== "object") return undefined;
  return p as Record<string, unknown>;
}

function friendlyDeployMessage(ev: {
  type: string;
  payload?: unknown;
}): string {
  const p = toRecord(ev.payload);
  switch (ev.type) {
    case "preparing":
      return typeof p?.message === "string"
        ? (p.message as string)
        : "Preparing…";
    case "prepared":
      return typeof p?.fileCount === "number"
        ? `Bundle ready (${p.fileCount} files)`
        : "Bundle ready";
    case "deploy-started":
      return typeof p?.projectName === "string"
        ? `Deploying as "${p.projectName}"`
        : "Deploying";
    case "hashes-calculated":
      return "Hashing files";
    case "file-count":
      return typeof p?.total === "number"
        ? `Counting files (${p.total})`
        : "Counting files";
    case "file-uploaded":
      return typeof p?.file === "string"
        ? `Uploaded ${p.file}`
        : "Uploaded file";
    case "files-uploaded":
      return "Files uploaded";
    case "created":
      return "Deployment created";
    case "building":
      return "Building";
    case "ready":
      return "Deployment ready";
    case "alias-assigned":
      return "Alias assigned";
    case "error":
      return typeof p?.message === "string" ? `Error: ${p.message}` : "Error";
    default:
      return ev.type;
  }
}
