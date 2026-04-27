import { DEFAULT_HUMAN_UA } from "./ai-bots";

export interface FetchResult {
  url: string;
  status: number;
  ok: boolean;
  body: string;
  headers: Record<string, string>;
  redirected: boolean;
  finalUrl: string;
  durationMs: number;
  error?: string;
}

export async function fetchText(
  url: string,
  opts: { userAgent?: string; timeoutMs?: number; method?: "GET" | "HEAD" } = {}
): Promise<FetchResult> {
  const { userAgent = DEFAULT_HUMAN_UA, timeoutMs = 15000, method = "GET" } = opts;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method,
      headers: {
        "User-Agent": userAgent,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal: ctrl.signal,
    });
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => (headers[k] = v));
    const body = method === "HEAD" ? "" : await res.text();
    return {
      url,
      status: res.status,
      ok: res.ok,
      body,
      headers,
      redirected: res.redirected,
      finalUrl: res.url,
      durationMs: Date.now() - t0,
    };
  } catch (e) {
    return {
      url,
      status: 0,
      ok: false,
      body: "",
      headers: {},
      redirected: false,
      finalUrl: url,
      durationMs: Date.now() - t0,
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    clearTimeout(timer);
  }
}
