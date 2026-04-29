import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { downloadZip } from "../storage/blob";

interface JszipFileShape {
  dir: boolean;
  async(t: "uint8array" | "string"): Promise<Uint8Array | string>;
}

interface JszipShape {
  files: Record<string, JszipFileShape>;
  loadAsync(data: ArrayBuffer | Uint8Array): Promise<JszipShape>;
}

interface JszipCtor {
  new (): JszipShape;
  loadAsync(data: ArrayBuffer | Uint8Array): Promise<JszipShape>;
}

async function loadJsZip(): Promise<JszipCtor | null> {
  try {
    const moduleName = "jszip";
    const mod = (await import(/* webpackIgnore: true */ moduleName)) as {
      default?: JszipCtor;
    } & JszipCtor;
    return (mod.default ?? (mod as unknown as JszipCtor)) as JszipCtor;
  } catch {
    return null;
  }
}

export async function unzipBufferToTempDir(buffer: Uint8Array): Promise<{ dir: string; fileCount: number }> {
  const Jszip = await loadJsZip();
  if (!Jszip) throw new Error("jszip is not installed; required for deploy.");
  const zip = await Jszip.loadAsync(buffer);
  const root = path.join(os.tmpdir(), `ai-audit-deploy-${crypto.randomUUID()}`);
  await fs.mkdir(root, { recursive: true });
  let fileCount = 0;
  for (const [relPath, entry] of Object.entries(zip.files)) {
    if (entry.dir) {
      await fs.mkdir(path.join(root, relPath), { recursive: true });
      continue;
    }
    const data = (await entry.async("uint8array")) as Uint8Array;
    const target = path.join(root, relPath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, data);
    fileCount++;
  }
  return { dir: root, fileCount };
}

export async function cleanupDir(dir: string): Promise<void> {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch {}
}

export interface VercelDeployEvent {
  type: string;
  payload?: unknown;
}

export interface VercelClientLike {
  createDeployment: (
    clientOptions: { token: string; teamId?: string; path: string; debug?: boolean },
    deploymentOptions?: Record<string, unknown>,
  ) => AsyncGenerator<VercelDeployEvent, unknown, void>;
}

export async function loadVercelClient(): Promise<VercelClientLike | null> {
  try {
    const moduleName = "@vercel/client";
    const mod = (await import(/* webpackIgnore: true */ moduleName)) as VercelClientLike & {
      default?: VercelClientLike;
    };
    if (typeof mod.createDeployment === "function") return mod;
    if (mod.default && typeof mod.default.createDeployment === "function") return mod.default;
    return null;
  } catch {
    return null;
  }
}

function sanitizeProjectName(input: string): string {
  let name = input
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (name.length === 0) name = "ai-audit-regen";
  if (name.length > 52) name = name.slice(0, 52);
  return `${name}-regen`;
}

export interface DeployInputs {
  /** Public URL of the regen zip on Vercel Blob (preferred). */
  zipUrl?: string;
  /** Inline base64 fallback when blob isn't configured. */
  zipBase64?: string;
  projectNameSeed: string;
  /** Optional progress hook fired for each deploy event (one-shot per call). */
  onEvent?: (event: VercelDeployEvent) => void | Promise<void>;
}

export interface DeployRunResult {
  events: VercelDeployEvent[];
  deploymentUrl?: string;
  error?: string;
}

/**
 * Run a Vercel deploy end-to-end. Designed to live inside a single Workflow
 * SDK step — the entire pipeline (download → unzip → createDeployment loop
 * → cleanup) is one idempotent unit of work and returns the final URL.
 */
export async function runVercelDeploy(input: DeployInputs): Promise<DeployRunResult> {
  const events: VercelDeployEvent[] = [];
  const push = (ev: VercelDeployEvent) => {
    events.push(ev);
    try {
      const r = input.onEvent?.(ev);
      if (r && typeof (r as Promise<void>).then === "function") {
        (r as Promise<void>).catch(() => {});
      }
    } catch {
      // ignore
    }
  };

  const token = process.env.VERCEL_TOKEN;
  if (!token) {
    push({
      type: "error",
      payload: {
        message:
          "VERCEL_TOKEN is not set on the server. Add it to .env.local to enable one-click deploy.",
      },
    });
    return { events, error: "VERCEL_TOKEN missing" };
  }

  const client = await loadVercelClient();
  if (!client) {
    push({
      type: "error",
      payload: { message: "@vercel/client is not installed. Run `pnpm add @vercel/client`." },
    });
    return { events, error: "@vercel/client missing" };
  }

  if (!input.zipUrl && !input.zipBase64) {
    push({
      type: "error",
      payload: { message: "No deployable bundle provided (need zipUrl or zipBase64)." },
    });
    return { events, error: "No bundle" };
  }

  push({ type: "preparing", payload: { message: "Fetching bundle…" } });
  let bytes: Uint8Array;
  try {
    if (input.zipUrl) {
      bytes = await downloadZip(input.zipUrl);
    } else {
      bytes = Uint8Array.from(Buffer.from(input.zipBase64!, "base64"));
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to fetch zip";
    push({ type: "error", payload: { message: msg } });
    return { events, error: msg };
  }

  let dir: string | null = null;
  let deploymentUrl: string | undefined;
  let error: string | undefined;

  try {
    const extracted = await unzipBufferToTempDir(bytes);
    dir = extracted.dir;
    push({
      type: "prepared",
      payload: { fileCount: extracted.fileCount, tmpDir: extracted.dir },
    });

    const teamId = process.env.VERCEL_TEAM_ID;
    const projectName = sanitizeProjectName(input.projectNameSeed);
    push({
      type: "deploy-started",
      payload: { projectName, teamId: teamId ?? null },
    });

    const deploymentOptions: Record<string, unknown> = {
      name: projectName,
      target: "production",
      projectSettings: {
        framework: null,
        buildCommand: null,
        installCommand: null,
        outputDirectory: ".",
      },
    };

    for await (const ev of client.createDeployment(
      { token, teamId, path: dir },
      deploymentOptions,
    )) {
      push({ type: ev.type, payload: ev.payload });
      const url = pickUrl(ev.payload);
      if (url && (ev.type === "ready" || ev.type === "alias-assigned" || ev.type === "created")) {
        deploymentUrl = url;
      }
      if (ev.type === "error") {
        error = pickMessage(ev.payload) ?? "Vercel reported an error";
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    push({ type: "error", payload: { message: msg } });
    error = msg;
  } finally {
    if (dir) await cleanupDir(dir);
  }

  return { events, deploymentUrl, error };
}

function pickUrl(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const p = payload as Record<string, unknown>;
  if (typeof p.url === "string") return p.url.startsWith("http") ? p.url : `https://${p.url}`;
  if (typeof p.alias === "string") return `https://${p.alias}`;
  if (Array.isArray(p.alias) && typeof p.alias[0] === "string") return `https://${p.alias[0]}`;
  if (p.deployment && typeof p.deployment === "object") return pickUrl(p.deployment);
  return undefined;
}

function pickMessage(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const p = payload as Record<string, unknown>;
  if (typeof p.message === "string") return p.message;
  if (p.error && typeof p.error === "object") {
    const e = p.error as { message?: unknown };
    if (typeof e.message === "string") return e.message;
  }
  return undefined;
}
