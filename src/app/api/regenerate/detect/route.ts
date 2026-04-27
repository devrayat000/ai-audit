import { NextRequest } from "next/server";
import { z } from "zod";
import { fetchText } from "@/lib/utils/http";
import { detectLanguageFromHtml, languageName } from "@/lib/regenerator/i18n/detector";
import { buildAutoGlossary } from "@/lib/regenerator/i18n/glossary";
import { normalizeUrl } from "@/lib/utils/url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ url: z.string() });

export async function POST(req: NextRequest) {
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
  const url = normalizeUrl(parsed.data.url);
  const r = await fetchText(url, { timeoutMs: 12000 });
  if (!r.ok) {
    return Response.json({ error: r.error ?? `Status ${r.status}`, code: "FETCH_FAILED" }, { status: 502 });
  }
  const detected = await detectLanguageFromHtml(r.body);
  const glossary = buildAutoGlossary([r.body]);
  return Response.json({
    detected,
    languageName: languageName(detected.language),
    glossary,
  });
}
