import {
  assertBlobConfigured,
  blob,
  blobToken,
  isBlobConfigured,
} from "../storage/blob";
import type { PublishedSite } from "./types";
import { cache } from "react";

export function isValidSubdomain(sub: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(sub) && sub.length <= 63;
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

export async function writePublishedSite(site: PublishedSite): Promise<string> {
  assertBlobConfigured();
  const body = JSON.stringify(site);
  const r = await blob.put(siteKey(site.subdomain), body, {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
    token: blobToken(),
  });
  return r.url;
}

const discoverSiteBlobUrl = cache(async (subdomain: string) => {
  if (!isBlobConfigured()) return null;
  const pathname = siteKey(subdomain);
  try {
    const meta = await blob.head(pathname, { token: blobToken() });
    return meta.url;
  } catch {
    // head() throws for not-found; fall back to list() for older API quirks.
  }
  try {
    const r = await blob.list({
      prefix: pathname,
      limit: 1,
      token: blobToken(),
    });
    const found = r.blobs.find((b) => b.pathname === pathname) ?? r.blobs[0];
    return found?.url ?? null;
  } catch {
    return null;
  }
});

export const readPublishedSite = cache(async (subdomain: string) => {
  if (!isValidSubdomain(subdomain)) return null;
  const url = await discoverSiteBlobUrl(subdomain);
  if (!url) return null;
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return null;
    return (await r.json()) as PublishedSite;
  } catch {
    return null;
  }
});

export async function listPublishedSites(): Promise<
  Array<{ subdomain: string; url: string; uploadedAt: string }>
> {
  if (!isBlobConfigured()) return [];
  const r = await blob.list({ prefix: "sites/", token: blobToken() });
  return r.blobs
    .filter((b) => b.pathname.endsWith(".json"))
    .map((b) => ({
      subdomain: b.pathname.replace(/^sites\//, "").replace(/\.json$/, ""),
      url: b.url,
      uploadedAt: b.uploadedAt.toISOString(),
    }));
}

const RESERVED_SUBDOMAINS = new Set([
  "www",
  "api",
  "app",
  "admin",
  "mail",
  "blog",
  "ftp",
  "ns1",
  "ns2",
  "ns3",
  "ns4",
  "smtp",
  "pop",
  "imap",
  "test",
  "dev",
  "staging",
  "preview",
  "sites",
]);

export function isReservedSubdomain(sub: string): boolean {
  return RESERVED_SUBDOMAINS.has(sub);
}

function randomSuffix(len = 4): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

/**
 * Find an available subdomain starting from `seed`. Tries the seed first,
 * then `seed-<rand>` variants until one is free or we hit `maxAttempts`.
 */
export async function findAvailableSubdomain(
  seed: string,
  maxAttempts = 8,
): Promise<string | null> {
  let base = normalizeSubdomain(seed);
  if (!base || !isValidSubdomain(base) || isReservedSubdomain(base)) {
    base = `site-${randomSuffix(4)}`;
  }
  if (base.length > 50) base = base.slice(0, 50);

  const existing = await readPublishedSite(base);
  if (!existing) return base;

  for (let i = 0; i < maxAttempts; i++) {
    const candidate = `${base}-${randomSuffix(3 + Math.floor(i / 3))}`;
    if (!isValidSubdomain(candidate) || isReservedSubdomain(candidate))
      continue;
    const taken = await readPublishedSite(candidate);
    if (!taken) return candidate;
  }
  return null;
}

export async function deletePublishedSite(subdomain: string): Promise<void> {
  if (!isBlobConfigured()) return;
  try {
    await blob.del(siteKey(subdomain), { token: blobToken() });
  } catch {
    // ignore
  }
}
