import { NextRequest } from "next/server";
import { z } from "zod";
import type { CheckResult, Industry } from "@/lib/types";
import { streamRecommendation } from "@/lib/recommendations/llm-advisor";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const schema = z.object({
  industry: z.enum(["restaurant", "travel", "service", "ecommerce", "blog", "general"]),
  pageUrl: z.string().optional(),
  pageTitle: z.string().optional(),
  pageDescription: z.string().optional(),
  pageTextSnippet: z.string().optional(),
  check: z.object({
    analyzerKey: z.string(),
    category: z.string(),
    name: z.string(),
    status: z.enum(["pass", "warn", "fail"]),
    message: z.string(),
    evidence: z.unknown().optional(),
    fixSuggestion: z.string().optional(),
  }),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON", code: "BAD_BODY" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.message, code: "VALIDATION" },
      { status: 400 }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      {
        error:
          "ANTHROPIC_API_KEY not set. Add it to .env.local to enable AI-generated recommendations.",
        code: "NO_API_KEY",
      },
      { status: 503 }
    );
  }

  let Anthropic: { new (cfg: { apiKey: string }): unknown };
  try {
    const moduleName = "@anthropic-ai/sdk";
    const mod = (await import(/* webpackIgnore: true */ moduleName)) as {
      default?: unknown;
    } & Record<string, unknown>;
    Anthropic = (mod.default ?? mod) as typeof Anthropic;
  } catch {
    return Response.json(
      {
        error:
          "@anthropic-ai/sdk is not installed. Run `pnpm add @anthropic-ai/sdk` to enable AI fixes.",
        code: "MISSING_SDK",
      },
      { status: 503 }
    );
  }

  const client = new Anthropic({ apiKey }) as never;
  const check = parsed.data.check as unknown as CheckResult;
  const industry = parsed.data.industry as Industry;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of streamRecommendation(client, {
          check,
          industry,
          pageUrl: parsed.data.pageUrl,
          pageTitle: parsed.data.pageTitle,
          pageDescription: parsed.data.pageDescription,
          pageTextSnippet: parsed.data.pageTextSnippet,
        })) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      } catch (e) {
        controller.enqueue(
          encoder.encode(
            `\n\n[error] ${e instanceof Error ? e.message : "Streaming failed"}`
          )
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
