import type { Browser } from "playwright";
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

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = (async () => {
      const { chromium } = await import("playwright");
      return chromium.launch({ headless: true });
    })();
  }
  return browserPromise;
}

export async function closeBrowser(): Promise<void> {
  if (browserPromise) {
    try {
      const b = await browserPromise;
      await b.close();
    } catch {}
    browserPromise = null;
  }
}

export async function renderPage(url: string, opts: RenderOptions = {}): Promise<RenderResult> {
  const t0 = Date.now();
  const browser = await getBrowser();
  const ctx = await browser.newContext({
    userAgent: DEFAULT_HUMAN_UA,
    viewport: { width: opts.viewportWidth ?? 1280, height: opts.viewportHeight ?? 800 },
  });
  const page = await ctx.newPage();
  let status = 0;
  let responseHeaders: Record<string, string> = {};
  try {
    const resp = await page.goto(url, { waitUntil: "networkidle", timeout: 20000 });
    status = resp?.status() ?? 0;
    if (resp) {
      responseHeaders = resp.headers();
    }
    const renderedHtml = await page.content();
    const renderedText = await page.evaluate(() => {
      return document.body ? (document.body.innerText || "") : "";
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
