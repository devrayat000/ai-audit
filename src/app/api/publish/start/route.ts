import { NextRequest } from "next/server";
import { z } from "zod";
import { start } from "workflow/api";
import { publishSiteWorkflow } from "@/workflows/publish";
import {
  buildInitialStatus,
  newRunId,
  writeRunStatus,
} from "@/lib/workflow/status-store";
import {
  isValidSubdomain,
  normalizeSubdomain,
  readPublishedSite,
} from "@/lib/sites/storage";
import { normalizeUrl } from "@/lib/utils/url";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const schema = z.object({
  sourceUrl: z.string().min(4),
  subdomain: z.string().min(2).max(63),
  industry: z.enum(["restaurant", "travel", "service", "general"]),
  overwrite: z.boolean().optional(),
  /** Full audit report. Forwarded to the publish workflow's enrichment step. */
  audit: z.unknown().optional(),
});

const RESERVED = new Set([
  "www", "api", "app", "admin", "mail", "blog", "ftp",
  "ns1", "ns2", "ns3", "ns4", "smtp", "pop", "imap",
  "test", "dev", "staging", "preview", "sites",
]);

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON", code: "BAD_BODY" },
      { status: 400 },
    );
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.message, code: "VALIDATION" },
      { status: 400 },
    );
  }

  const sourceUrl = normalizeUrl(parsed.data.sourceUrl);
  const subdomain = normalizeSubdomain(parsed.data.subdomain);

  if (!isValidSubdomain(subdomain)) {
    return Response.json(
      {
        error: "Subdomain must be alphanumeric, may include dashes, and be 2–63 chars.",
        code: "BAD_SUBDOMAIN",
      },
      { status: 400 },
    );
  }
  if (RESERVED.has(subdomain)) {
    return Response.json(
      { error: `Subdomain "${subdomain}" is reserved.`, code: "RESERVED" },
      { status: 400 },
    );
  }

  if (!parsed.data.overwrite) {
    const existing = await readPublishedSite(subdomain);
    if (existing) {
      return Response.json(
        {
          error: `Subdomain "${subdomain}" is already published from ${existing.sourceUrl}. Pass overwrite=true to replace.`,
          code: "TAKEN",
        },
        { status: 409 },
      );
    }
  }

  const runId = newRunId();
  await writeRunStatus(
    buildInitialStatus(runId, "publish", {
      sourceUrl,
      subdomain,
      industry: parsed.data.industry,
    }),
  );

  try {
    const run = await start(publishSiteWorkflow, [
      runId,
      {
        sourceUrl,
        subdomain,
        industry: parsed.data.industry,
        audit: parsed.data.audit as never,
      },
    ]);
    return new Response(run.readable, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Run-Id": runId,
        "X-Subdomain": subdomain,
      },
    });
  } catch (e) {
    return Response.json(
      {
        error: e instanceof Error ? e.message : "Failed to start publish workflow",
        code: "WORKFLOW_START_FAILED",
      },
      { status: 500 },
    );
  }
}
