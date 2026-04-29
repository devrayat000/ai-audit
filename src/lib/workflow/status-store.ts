import crypto from "node:crypto";
import { isBlobConfigured } from "../storage/blob";

interface BlobModule {
  put: (
    path: string,
    body: string | Uint8Array,
    opts: {
      access: "public";
      contentType?: string;
      addRandomSuffix?: boolean;
      allowOverwrite?: boolean;
      cacheControlMaxAge?: number;
      token?: string;
    },
  ) => Promise<{ url: string; pathname: string }>;
  head: (
    pathnameOrUrl: string,
    opts?: { token?: string },
  ) => Promise<{ url: string; pathname: string; size: number; uploadedAt: Date }>;
  list: (opts?: { prefix?: string; limit?: number; token?: string }) => Promise<{
    blobs: Array<{ url: string; pathname: string; size: number; uploadedAt: Date }>;
  }>;
}

async function loadBlob(): Promise<BlobModule | null> {
  try {
    const moduleName = "@vercel/blob";
    const mod = (await import(/* webpackIgnore: true */ moduleName)) as BlobModule;
    if (typeof mod.put === "function") return mod;
    return null;
  } catch {
    return null;
  }
}

export type RunKind = "regen" | "deploy";
export type RunState = "queued" | "running" | "completed" | "failed";

export interface RunStatus<T = unknown> {
  runId: string;
  kind: RunKind;
  state: RunState;
  message?: string;
  progress?: number;
  meta?: Record<string, unknown>;
  /** filled when state === "completed" */
  result?: T;
  /** filled when state === "failed" */
  error?: string;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
}

function statusKey(kind: RunKind, runId: string): string {
  return `runs/${kind}/${runId}.json`;
}

export function newRunId(): string {
  return crypto.randomBytes(10).toString("hex");
}

export function buildInitialStatus<T = unknown>(
  runId: string,
  kind: RunKind,
  meta?: Record<string, unknown>,
): RunStatus<T> {
  const ts = new Date().toISOString();
  return {
    runId,
    kind,
    state: "queued",
    message: "Queued",
    progress: 0,
    meta,
    startedAt: ts,
    updatedAt: ts,
  };
}

export async function writeRunStatus<T = unknown>(status: RunStatus<T>): Promise<string | null> {
  if (!isBlobConfigured()) return null;
  const blob = await loadBlob();
  if (!blob) return null;
  const next = { ...status, updatedAt: new Date().toISOString() };
  const key = statusKey(next.kind, next.runId);
  try {
    const r = await blob.put(key, JSON.stringify(next), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 5,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return r.url;
  } catch {
    return null;
  }
}

async function findStatusUrl(kind: RunKind, runId: string): Promise<string | null> {
  if (!isBlobConfigured()) return null;
  const blob = await loadBlob();
  if (!blob) return null;
  const pathname = statusKey(kind, runId);
  // Prefer head() — direct lookup by pathname.
  if (typeof blob.head === "function") {
    try {
      const meta = await blob.head(pathname, {
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      return meta.url;
    } catch {
      // Fall through to list().
    }
  }
  if (typeof blob.list === "function") {
    try {
      const r = await blob.list({
        prefix: pathname,
        limit: 1,
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      const found = r.blobs.find((b) => b.pathname === pathname) ?? r.blobs[0];
      return found?.url ?? null;
    } catch {
      return null;
    }
  }
  return null;
}

export async function readRunStatus<T = unknown>(
  kind: RunKind,
  runId: string,
): Promise<RunStatus<T> | null> {
  const url = await findStatusUrl(kind, runId);
  if (!url) return null;
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return null;
    return (await r.json()) as RunStatus<T>;
  } catch {
    return null;
  }
}

export async function patchRunStatus<T = unknown>(
  kind: RunKind,
  runId: string,
  patch: Partial<RunStatus<T>>,
): Promise<RunStatus<T> | null> {
  const current =
    (await readRunStatus<T>(kind, runId)) ?? buildInitialStatus<T>(runId, kind);
  const next: RunStatus<T> = { ...current, ...patch, runId, kind } as RunStatus<T>;
  if (patch.state === "completed" || patch.state === "failed") {
    next.completedAt = new Date().toISOString();
  }
  await writeRunStatus<T>(next);
  return next;
}
