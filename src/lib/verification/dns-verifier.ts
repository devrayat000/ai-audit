import { promises as dns } from "node:dns";

export async function checkDnsTxt(domain: string, expected: string): Promise<{ ok: boolean; records: string[]; error?: string }> {
  const host = `_ai-audit.${domain.replace(/^www\./, "")}`;
  try {
    const records = await dns.resolveTxt(host);
    const flat = records.map((r) => r.join(""));
    const ok = flat.some((r) => r.trim() === expected.trim());
    return { ok, records: flat };
  } catch (e) {
    return { ok: false, records: [], error: e instanceof Error ? e.message : String(e) };
  }
}
