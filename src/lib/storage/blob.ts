/**
 * Centralised Vercel Blob helpers.
 *
 * We statically import `@vercel/blob` — the package is in `serverExternalPackages`
 * so the bundler won't try to inline it. Static imports surface configuration
 * errors immediately instead of failing silently at the dynamic-import call site.
 */
import {
  put as blobPut,
  head as blobHead,
  list as blobList,
  del as blobDel,
} from "@vercel/blob";

export function isBlobConfigured(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

export function assertBlobConfigured(): void {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN is not set. Provision a Vercel Blob store and add the read-write token to .env.local (and to your deployment env).",
    );
  }
}

export const blobToken = (): string | undefined => process.env.BLOB_READ_WRITE_TOKEN;

export const blob = {
  put: blobPut,
  head: blobHead,
  list: blobList,
  del: blobDel,
};
