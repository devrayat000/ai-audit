import { NextRequest } from "next/server";
import { z } from "zod";
import { start } from "workflow/api";
import { isVerificationBypassed, verifyProof } from "@/lib/verification/token";
import { regenerationWorkflow } from "@/workflows/regen";
import { getDomain, normalizeUrl } from "@/lib/utils/url";
import {
  newRunId,
  writeRunStatus,
  buildInitialStatus,
} from "@/lib/workflow/status-store";
import type { RegenInput } from "@/lib/regenerator/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const glossaryEntry = z.object({
  source: z.string(),
  handling: z.enum(["preserve", "transliterate", "translate"]),
  target: z.string(),
  origin: z.enum(["auto", "user"]).default("user"),
});

const translationCfg = z.object({
  mode: z.enum(["none", "literal", "transcreate", "bilingual"]),
  sourceLanguage: z.string(),
  sourceScript: z.string(),
  sourceDirection: z.enum(["ltr", "rtl"]),
  targetLanguage: z.string(),
  targetDirection: z.enum(["ltr", "rtl"]),
  targetFontFamily: z.string().optional(),
  glossary: z.array(glossaryEntry).default([]),
  industry: z.enum([
    "restaurant",
    "travel",
    "service",
    "ecommerce",
    "blog",
    "general",
  ]),
  humanReviewAcknowledged: z.boolean().optional(),
});

const schema = z.object({
  rootUrl: z.string().min(4),
  industry: z.enum([
    "restaurant",
    "travel",
    "service",
    "ecommerce",
    "blog",
    "general",
  ]),
  strategy: z.enum(["static-surgery", "next-project"]),
  proof: z.string().optional(),
  fixes: z.array(z.object({ analyzerKey: z.string(), enabled: z.boolean() })),
  translation: translationCfg.optional(),
  inlineAssets: z.boolean().optional(),
  maxPages: z.number().int().min(1).max(50).optional(),
});

export async function POST(req: NextRequest) {
  if (process.env.ENABLE_REGENERATION === "false") {
    return Response.json(
      { error: "Regeneration is disabled.", code: "DISABLED" },
      { status: 503 },
    );
  }
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
  const data = parsed.data;
  const rootUrl = normalizeUrl(data.rootUrl);
  const domain = getDomain(rootUrl).replace(/^www\./, "");

  if (!isVerificationBypassed()) {
    if (!data.proof) {
      return Response.json(
        {
          error: "Domain ownership proof is required in production.",
          code: "UNVERIFIED",
        },
        { status: 403 },
      );
    }
    const v = verifyProof(data.proof, domain);
    if (!v.valid) {
      return Response.json(
        {
          error: `Domain ownership proof invalid: ${v.reason ?? "unknown"}.`,
          code: "UNVERIFIED",
        },
        { status: 403 },
      );
    }
  }

  const tx = data.translation;
  if (tx && tx.mode !== "none" && tx.humanReviewAcknowledged !== true) {
    return Response.json(
      {
        error:
          "Human-review confirmation required for translated output. Re-submit with humanReviewAcknowledged=true.",
        code: "HUMAN_REVIEW_REQUIRED",
      },
      { status: 400 },
    );
  }

  const regenInput: RegenInput = {
    rootUrl,
    industry: data.industry,
    strategy: data.strategy,
    proof: data.proof,
    fixes: data.fixes,
    translation:
      tx && tx.mode !== "none"
        ? {
            mode: tx.mode,
            sourceLanguage: tx.sourceLanguage,
            sourceScript: tx.sourceScript,
            sourceDirection: tx.sourceDirection,
            targetLanguage: tx.targetLanguage,
            targetDirection: tx.targetDirection,
            targetFontFamily: tx.targetFontFamily,
            glossary: tx.glossary,
            industry: tx.industry,
          }
        : undefined,
    inlineAssets: data.inlineAssets,
    maxPages: data.maxPages,
  };

  const runId = newRunId();
  // Pre-write a queued status so the client can immediately poll without 404s.
  await writeRunStatus(
    buildInitialStatus(runId, "regen", { rootUrl, industry: data.industry }),
  );

  try {
    const run = await start(regenerationWorkflow, [runId, regenInput]);
    return new Response(run.readable, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    return Response.json(
      {
        error: e instanceof Error ? e.message : "Failed to start workflow",
        code: "WORKFLOW_START_FAILED",
      },
      { status: 500 },
    );
  }
}
