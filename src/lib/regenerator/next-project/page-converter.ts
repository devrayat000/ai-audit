import * as cheerio from "cheerio";
import type { RegenFile } from "../types";

export interface PageConvertInput {
  url: string;
  rootUrl: string;
  html: string;
}

function urlToRoute(url: string, rootUrl: string): string {
  try {
    const u = new URL(url);
    const r = new URL(rootUrl);
    if (u.hostname !== r.hostname) return "";
    let path = u.pathname.replace(/\/+$/, "");
    if (path === "" || path === "/") return "/";
    return path;
  } catch {
    return "";
  }
}

function htmlToJsxSafe(html: string): string {
  return html
    .replace(/class=/g, "className=")
    .replace(/<!--([\s\S]*?)-->/g, "{/* $1 */}")
    .replace(/(<(?:meta|link|img|input|br|hr|source|track|area|base|col|embed|param|wbr)[^>]*?)\s*\/?>/g, "$1 />")
    .replace(/{/g, "&#123;")
    .replace(/}/g, "&#125;");
}

export function convertPage(input: PageConvertInput): RegenFile | null {
  const route = urlToRoute(input.url, input.rootUrl);
  if (!route) return null;
  const $ = cheerio.load(input.html);
  const title = $("title").first().text().trim();
  const desc = $('meta[name="description"]').attr("content")?.trim() ?? "";
  const bodyInner = $("body").html() ?? "";
  const jsxBody = htmlToJsxSafe(bodyInner);

  const segments = route === "/" ? [] : route.replace(/^\//, "").split("/");
  const dir = segments.length === 0 ? "src/app" : `src/app/${segments.join("/")}`;
  const filePath = `${dir}/page.tsx`;

  const content = `export const metadata = {
  title: ${JSON.stringify(title || route)},
  description: ${JSON.stringify(desc)},
};

export default function Page() {
  return (
    <div dangerouslySetInnerHTML={{ __html: ${JSON.stringify(htmlEntitiesEscape(bodyInner))} }} />
  );
}

// JSX-safe rendering reference (commented):
// ${jsxBody.slice(0, 200).replace(/\n/g, " ")}
`;
  return { path: filePath, content };
}

function htmlEntitiesEscape(s: string): string {
  return s.replace(/`/g, "\\`");
}
