import {
  assertBlobConfigured,
  blob,
  blobToken,
  isBlobConfigured,
} from "@/lib/storage/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Diagnostic endpoint — verifies the publish pipeline can actually persist.
 * Writes a small `health/<ts>.json` to Vercel Blob, then reads it back.
 * Returns { ok: true, ...details } on success, or { ok: false, reason } on failure.
 */
export async function GET() {
  const details: Record<string, unknown> = {
    nodeEnv: process.env.NODE_ENV ?? null,
    sitePublicApex: process.env.SITE_PUBLIC_APEX ?? null,
    blobConfigured: isBlobConfigured(),
  };

  if (!isBlobConfigured()) {
    return Response.json(
      {
        ok: false,
        reason: "BLOB_READ_WRITE_TOKEN is missing.",
        details,
      },
      { status: 503 },
    );
  }

  const ts = Date.now();
  const key = `health/${ts}.json`;
  try {
    assertBlobConfigured();
    const put = await blob.put(
      key,
      JSON.stringify({ ts, source: "ai-audit publish health" }),
      {
        access: "public",
        contentType: "application/json",
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: 0,
        token: blobToken(),
      },
    );
    details.putUrl = put.url;

    const head = await blob.head(key, { token: blobToken() });
    details.headUrl = head.url;
    details.size = head.size;

    const r = await fetch(head.url, { cache: "no-store" });
    details.readStatus = r.status;
    if (!r.ok) {
      return Response.json(
        { ok: false, reason: `Read-back failed: ${r.status}`, details },
        { status: 502 },
      );
    }

    // best-effort cleanup
    try {
      await blob.del(key, { token: blobToken() });
      details.deleted = true;
    } catch {
      details.deleted = false;
    }

    return Response.json({ ok: true, details });
  } catch (e) {
    return Response.json(
      {
        ok: false,
        reason: e instanceof Error ? e.message : String(e),
        details,
      },
      { status: 500 },
    );
  }
}
