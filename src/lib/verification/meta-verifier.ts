import * as cheerio from "cheerio";
import { fetchText } from "../utils/http";

export async function checkMetaTag(rootUrl: string, expected: string): Promise<{ ok: boolean; found: string | null; error?: string }> {
  const r = await fetchText(rootUrl, { timeoutMs: 12000 });
  if (!r.ok) {
    return { ok: false, found: null, error: r.error ?? `Status ${r.status}` };
  }
  try {
    const $ = cheerio.load(r.body);
    const found = $('meta[name="ai-audit-verify"]').attr("content")?.trim() ?? null;
    return { ok: !!found && found === expected.trim(), found };
  } catch (e) {
    return { ok: false, found: null, error: e instanceof Error ? e.message : String(e) };
  }
}
