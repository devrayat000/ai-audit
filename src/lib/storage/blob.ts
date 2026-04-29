import crypto from "node:crypto";

interface PutResult {
  url: string;
  pathname: string;
  contentType?: string;
  contentDisposition?: string;
}

interface BlobModule {
  put: (
    path: string,
    body: Uint8Array | Buffer | Blob | ReadableStream | string,
    opts: {
      access: "public";
      contentType?: string;
      addRandomSuffix?: boolean;
      cacheControlMaxAge?: number;
      token?: string;
    }
  ) => Promise<PutResult>;
  del: (urlOrPath: string | string[], opts?: { token?: string }) => Promise<void>;
  head: (
    urlOrPath: string,
    opts?: { token?: string }
  ) => Promise<{ size: number; uploadedAt: Date; pathname: string; url: string }>;
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

export interface UploadedZip {
  url: string;
  pathname: string;
  sizeBytes: number;
}

export function isBlobConfigured(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

function defaultZipKey(seed: string): string {
  const id = crypto.randomBytes(8).toString("hex");
  const cleanSeed = seed.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "regen";
  const ts = new Date().toISOString().slice(0, 10);
  return `regen/${ts}/${cleanSeed}-${id}.zip`;
}

export async function uploadZip(buffer: Uint8Array, seed: string): Promise<UploadedZip> {
  const blob = await loadBlob();
  if (!blob) throw new Error("@vercel/blob is not installed.");
  if (!isBlobConfigured()) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not set. Add it to .env.local.");
  }
  const key = defaultZipKey(seed);
  const result = await blob.put(key, buffer, {
    access: "public",
    contentType: "application/zip",
    addRandomSuffix: false,
    cacheControlMaxAge: 60 * 60 * 24 * 7,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
  return {
    url: result.url,
    pathname: result.pathname,
    sizeBytes: buffer.byteLength,
  };
}

export async function downloadZip(url: string): Promise<Uint8Array> {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`Failed to download zip from blob (${r.status})`);
  const arr = new Uint8Array(await r.arrayBuffer());
  return arr;
}

export async function deleteZip(urlOrPath: string): Promise<void> {
  const blob = await loadBlob();
  if (!blob) return;
  if (!isBlobConfigured()) return;
  try {
    await blob.del(urlOrPath, { token: process.env.BLOB_READ_WRITE_TOKEN });
  } catch {
    // ignore
  }
}
