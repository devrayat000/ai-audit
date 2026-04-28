import { NextRequest } from "next/server";
import { z } from "zod";
import { isVerificationBypassed, verifyProof } from "@/lib/verification/token";
import { runRegeneration } from "@/lib/regenerator";
import { getDomain, normalizeUrl } from "@/lib/utils/url";

export const runtime = "nodejs";
export const maxDuration = 300;
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
  industry: z.enum(["restaurant", "travel", "service", "ecommerce", "blog", "general"]),
  humanReviewAcknowledged: z.boolean().optional(),
});

const schema = z.object({
  rootUrl: z.string().min(4),
  industry: z.enum(["restaurant", "travel", "service", "ecommerce", "blog", "general"]),
  strategy: z.enum(["static-surgery", "next-project"]),
  proof: z.string().optional(),
  fixes: z.array(z.object({ analyzerKey: z.string(), enabled: z.boolean() })),
  translation: translationCfg.optional(),
  inlineAssets: z.boolean().optional(),
  maxPages: z.number().int().min(1).max(50).optional(),
});

if (process.env.ENABLE_REGENERATION === undefined) {
  // default-on for local dev
}

export async function POST(req: NextRequest) {
  if (process.env.ENABLE_REGENERATION === "false") {
    return Response.json({ error: "Regeneration is disabled.", code: "DISABLED" }, { status: 503 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON", code: "BAD_BODY" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message, code: "VALIDATION" }, { status: 400 });
  }
  const data = parsed.data;
  const rootUrl = normalizeUrl(data.rootUrl);
  const domain = getDomain(rootUrl).replace(/^www\./, "");

  const bypass = isVerificationBypassed();
  let v: { valid: boolean; method?: "dns-txt" | "meta-tag"; expiresAt?: number; reason?: string };
  if (bypass) {
    v = { valid: true, method: "meta-tag" };
    console.warn(
      `[regenerate] Verification BYPASSED for ${domain} — NODE_ENV=${process.env.NODE_ENV ?? "undefined"}, ALLOW_REGEN_WITHOUT_VERIFICATION=${process.env.ALLOW_REGEN_WITHOUT_VERIFICATION ?? "false"}. ` +
        "This MUST NOT happen in production."
    );
  } else {
    if (!data.proof) {
      return Response.json(
        { error: "Domain ownership proof is required in production.", code: "UNVERIFIED" },
        { status: 403 }
      );
    }
    v = verifyProof(data.proof, domain);
    if (!v.valid) {
      return Response.json(
        { error: `Domain ownership proof invalid: ${v.reason ?? "unknown"}.`, code: "UNVERIFIED" },
        { status: 403 }
      );
    }
  }

  const tx = data.translation;
  if (tx && tx.mode !== "none" && tx.humanReviewAcknowledged !== true) {
    return Response.json(
      {
        error:
          "Human-review confirmation required for translated output. Re-submit with humanReviewAcknowledged=true after the user checks the confirmation box.",
        code: "HUMAN_REVIEW_REQUIRED",
      },
      { status: 400 }
    );
  }

  try {
    const result = await runRegeneration({
      rootUrl,
      industry: data.industry,
      strategy: data.strategy,
      proof: data.proof,
      fixes: data.fixes,
      translation: tx && tx.mode !== "none"
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
    });

    return Response.json({
      strategy: result.strategy,
      rootUrl: result.rootUrl,
      domain: result.domain,
      fixesApplied: result.fixesApplied,
      pageDiffs: result.pageDiffs.map((d) => ({
        url: d.url,
        changes: d.changes.slice(0, 200),
        beforeLines: d.before.split("\n").length,
        afterLines: d.after.split("\n").length,
      })),
      homepagePreview: result.homepagePreview,
      originalHomepageScreenshot: result.originalHomepageScreenshot,
      translationWarnings: result.translationWarnings,
      totalSizeBytes: result.totalSizeBytes,
      durationMs: result.durationMs,
      zipBase64: result.zipBase64,
      notes: result.notes,
      pages: result.files.filter((f) => f.path.endsWith(".html")).map((f) => f.path),
      verifiedMethod: v.method,
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Regeneration failed", code: "REGEN_FAILED" },
      { status: 500 }
    );
  }
}
