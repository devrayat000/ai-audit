import {
  blob,
  blobToken,
  isBlobConfigured,
} from "../storage/blob";
import type { AuditReport } from "../types";
import { cache } from "react";

function auditKey(auditId: string): string {
  return `audits/${auditId}.json`;
}

export async function writeAuditReport(
  report: AuditReport
): Promise<string | null> {
  if (!isBlobConfigured()) {
    console.warn(
      "[audit/storage] BLOB_READ_WRITE_TOKEN not set — audit write skipped."
    );
    return null;
  }
  const body = JSON.stringify(report);
  try {
    const r = await blob.put(auditKey(report.id), body, {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 60,
      token: blobToken(),
    });
    return r.url;
  } catch (e) {
    console.error("[audit/storage] put failed", e);
    return null;
  }
}

export const readAuditReport = cache(async (auditId: string) => {
  if (!isBlobConfigured()) return null;
  const pathname = auditKey(auditId);
  try {
    const meta = await blob.head(pathname, { token: blobToken() });
    const r = await fetch(meta.url, { cache: "no-store" });
    if (!r.ok) return null;
    return (await r.json()) as AuditReport;
  } catch {
    return null;
  }
});
