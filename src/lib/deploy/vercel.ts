import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

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
    const mod = (await import(/* webpackIgnore: true */ moduleName)) as { default?: JszipCtor } & JszipCtor;
    return (mod.default ?? (mod as unknown as JszipCtor)) as JszipCtor;
  } catch {
    return null;
  }
}

export async function unzipBase64ToTempDir(zipBase64: string): Promise<{ dir: string; fileCount: number }> {
  const Jszip = await loadJsZip();
  if (!Jszip) throw new Error("jszip is not installed; required for deploy.");
  const buf = Buffer.from(zipBase64, "base64");
  const zip = await Jszip.loadAsync(buf);
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
    deploymentOptions?: Record<string, unknown>
  ) => AsyncGenerator<VercelDeployEvent, unknown, void>;
}

export async function loadVercelClient(): Promise<VercelClientLike | null> {
  try {
    const moduleName = "@vercel/client";
    const mod = (await import(/* webpackIgnore: true */ moduleName)) as VercelClientLike & {
      default?: VercelClientLike;
    };
    return mod.createDeployment ? mod : (mod.default ?? null);
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
  zipBase64: string;
  projectNameSeed: string;
}

export async function* runVercelDeploy(input: DeployInputs): AsyncGenerator<VercelDeployEvent, void, void> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) {
    yield { type: "error", payload: { message: "VERCEL_TOKEN is not set on the server. Add it to .env.local to enable one-click deploy." } };
    return;
  }

  const client = await loadVercelClient();
  if (!client) {
    yield { type: "error", payload: { message: "@vercel/client is not installed. Run `pnpm add @vercel/client`." } };
    return;
  }

  yield { type: "preparing", payload: { message: "Decoding bundle…" } };
  let dir: string | null = null;
  try {
    const { dir: tmp, fileCount } = await unzipBase64ToTempDir(input.zipBase64);
    dir = tmp;
    yield { type: "prepared", payload: { fileCount, tmpDir: tmp } };

    const teamId = process.env.VERCEL_TEAM_ID;
    const projectName = sanitizeProjectName(input.projectNameSeed);
    yield { type: "deploy-started", payload: { projectName, teamId: teamId ?? null } };

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
      {
        token,
        teamId,
        path: dir,
      },
      deploymentOptions
    )) {
      yield { type: ev.type, payload: ev.payload };
      if (ev.type === "ready" || ev.type === "error" || ev.type === "canceled" || ev.type === "alias-assigned") {
        // continue iteration; vercel may emit more events
      }
    }
  } catch (e) {
    yield { type: "error", payload: { message: e instanceof Error ? e.message : String(e) } };
  } finally {
    if (dir) await cleanupDir(dir);
  }
}
