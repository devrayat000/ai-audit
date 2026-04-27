import { fetchText, FetchResult } from "../utils/http";

export async function fetchRaw(url: string, userAgent?: string): Promise<FetchResult> {
  return fetchText(url, { userAgent, timeoutMs: 15000 });
}
