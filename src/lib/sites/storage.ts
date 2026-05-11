import { isBlobConfigured } from "../storage/blob";
import type { PublishedSite } from "./types";

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
  del: (urlOrPath: string | string[], opts?: { token?: string }) => Promise<void>;
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

export function isValidSubdomain(sub: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/.test(sub) && sub.length <= 63;
}

export function normalizeSubdomain(input: string): string {
  return input
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\..*$/, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

function siteKey(subdomain: string): string {
  return `sites/${subdomain}.json`;
}

export async function writePublishedSite(site: PublishedSite): Promise<string | null> {
  if (!isBlobConfigured()) return null;
  const blob = await loadBlob();
  if (!blob) return null;
  const body = JSON.stringify(site);
  const r = await blob.put(siteKey(site.subdomain), body, {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
  return r.url;
}

async function discoverSiteBlobUrl(subdomain: string): Promise<string | null> {
  if (!isBlobConfigured()) return null;
  const blob = await loadBlob();
  if (!blob) return null;
  const pathname = siteKey(subdomain);
  try {
    if (typeof blob.head === "function") {
      const meta = await blob.head(pathname, { token: process.env.BLOB_READ_WRITE_TOKEN });
      return meta.url;
    }
  } catch {
    // fall through
  }
  try {
    if (typeof blob.list === "function") {
      const r = await blob.list({
        prefix: pathname,
        limit: 1,
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      const found = r.blobs.find((b) => b.pathname === pathname) ?? r.blobs[0];
      return found?.url ?? null;
    }
  } catch {
    // ignore
  }
  return null;
}

export async function readPublishedSite(subdomain: string): Promise<PublishedSite | null> {
  const url = await discoverSiteBlobUrl(subdomain);
  if (!url) return null;
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return null;
    return (await r.json()) as PublishedSite;
  } catch {
    return null;
  }
}

export async function listPublishedSites(): Promise<
  Array<{ subdomain: string; url: string; uploadedAt: string }>
> {
  if (!isBlobConfigured()) return [];
  const blob = await loadBlob();
  if (!blob || typeof blob.list !== "function") return [];
  const r = await blob.list({ prefix: "sites/", token: process.env.BLOB_READ_WRITE_TOKEN });
  return r.blobs
    .filter((b) => b.pathname.endsWith(".json"))
    .map((b) => ({
      subdomain: b.pathname.replace(/^sites\//, "").replace(/\.json$/, ""),
      url: b.url,
      uploadedAt: b.uploadedAt.toISOString(),
    }));
}

export async function deletePublishedSite(subdomain: string): Promise<void> {
  if (!isBlobConfigured()) return;
  const blob = await loadBlob();
  if (!blob || typeof blob.del !== "function") return;
  await blob.del(siteKey(subdomain), { token: process.env.BLOB_READ_WRITE_TOKEN });
}
