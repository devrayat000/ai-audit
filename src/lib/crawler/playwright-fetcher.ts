import { type Browser, chromium } from "playwright";
import { DEFAULT_HUMAN_UA } from "../utils/ai-bots";

export interface RenderResult {
  url: string;
  finalUrl: string;
  status: number;
  renderedHtml: string;
  renderedText: string;
  responseHeaders: Record<string, string>;
  loadTimeMs: number;
  links: string[];
  /** base64-encoded JPEG screenshot of the viewport, only set when opts.screenshot === true */
  screenshotBase64?: string;
  error?: string;
}

export interface RenderOptions {
  screenshot?: boolean;
  viewportWidth?: number;
  viewportHeight?: number;
}

let browserPromise: Promise<Browser> | null = null;
let browserUnavailableReason: string | null = null;

async function getBrowser(): Promise<Browser | null> {
  if (browserUnavailableReason) return null;
  if (!browserPromise) {
    if (process.env.VERCEL) {
      const token = process.env.BROWSERLESS_API_KEY;
      if (!token) {
        browserUnavailableReason =
          "BROWSERLESS_API_KEY is not set on Vercel — Playwright cannot connect.";
        return null;
      }
      browserPromise = chromium
        .connectOverCDP(`wss://production-sfo.browserless.io?token=${token}`)
        .catch((e: unknown) => {
          browserUnavailableReason = `Browserless connect failed: ${
            e instanceof Error ? e.message : String(e)
          }`;
          browserPromise = null;
          throw e;
        });
    } else {
      browserPromise = chromium
        .launch({ headless: true })
        .catch((e: unknown) => {
          browserUnavailableReason = `Local chromium launch failed: ${
            e instanceof Error ? e.message : String(e)
          }. Install with: pnpm exec playwright install chromium`;
          browserPromise = null;
          throw e;
        });
    }
  }
  try {
    return await browserPromise;
  } catch {
    return null;
  }
}

export async function closeBrowser(): Promise<void> {
  if (browserPromise) {
    try {
      const b = await browserPromise;
      if (b) await b.close();
    } catch {}
    browserPromise = null;
  }
}

function emptyRender(
  url: string,
  t0: number,
  reason: string,
): RenderResult {
  return {
    url,
    finalUrl: url,
    status: 0,
    renderedHtml: "",
    renderedText: "",
    responseHeaders: {},
    loadTimeMs: Date.now() - t0,
    links: [],
    error: reason,
  };
}

export async function renderPage(
  url: string,
  opts: RenderOptions = {},
): Promise<RenderResult> {
  const t0 = Date.now();
  const browser = await getBrowser();
  if (!browser) {
    return emptyRender(
      url,
      t0,
      browserUnavailableReason ?? "Browser unavailable",
    );
  }
  let ctx: Awaited<ReturnType<Browser["newContext"]>>;
  try {
    ctx = await browser.newContext({
      userAgent: DEFAULT_HUMAN_UA,
      viewport: {
        width: opts.viewportWidth ?? 1280,
        height: opts.viewportHeight ?? 800,
      },
    });
  } catch (e) {
    return emptyRender(
      url,
      t0,
      `newContext failed: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  const page = await ctx.newPage();
  let status = 0;
  let responseHeaders: Record<string, string> = {};
  try {
    const resp = await page.goto(url, {
      waitUntil: "networkidle",
      timeout: 20000,
    });
    status = resp?.status() ?? 0;
    if (resp) {
      responseHeaders = resp.headers();
    }
    const renderedHtml = await page.content();
    const renderedText = await page.evaluate(() => {
      return document.body ? document.body.innerText || "" : "";
    });
    const links: string[] = await page.evaluate(() => {
      const out: string[] = [];
      document.querySelectorAll("a[href]").forEach((a) => {
        const h = (a as HTMLAnchorElement).href;
        if (h) out.push(h);
      });
      return out;
    });
    let screenshotBase64: string | undefined;
    if (opts.screenshot) {
      try {
        const buf = await page.screenshot({
          type: "jpeg",
          quality: 70,
          fullPage: false,
        });
        screenshotBase64 = Buffer.from(buf).toString("base64");
      } catch {
        // ignore screenshot failures
      }
    }
    const finalUrl = page.url();
    return {
      url,
      finalUrl,
      status,
      renderedHtml,
      renderedText,
      responseHeaders,
      loadTimeMs: Date.now() - t0,
      links,
      screenshotBase64,
    };
  } catch (e) {
    return {
      url,
      finalUrl: url,
      status,
      renderedHtml: "",
      renderedText: "",
      responseHeaders,
      loadTimeMs: Date.now() - t0,
      links: [],
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    await ctx.close().catch(() => {});
  }
}
