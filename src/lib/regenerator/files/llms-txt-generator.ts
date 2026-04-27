import type { PageData, SiteData } from "../../types";

export function buildLlmsTxt(site: SiteData, pages: PageData[], summary: { name: string; description: string }): string {
  const lines: string[] = [];
  lines.push(`# ${summary.name || site.domain}`);
  lines.push("");
  if (summary.description) lines.push(`> ${summary.description}`);
  lines.push("");
  lines.push("## Key pages");
  lines.push("");
  for (const p of pages.slice(0, 25)) {
    const path = (() => {
      try { return new URL(p.url).pathname || "/"; } catch { return p.url; }
    })();
    const title = path === "/" ? "Home" : path;
    lines.push(`- [${title}](${p.url}): ${textSnippet(p.renderedText, 120)}`);
  }
  lines.push("");
  return lines.join("\n");
}

export function buildLlmsFullTxt(site: SiteData, pages: PageData[], summary: { name: string; description: string }): string {
  const lines: string[] = [];
  lines.push(`# ${summary.name || site.domain}`);
  lines.push("");
  if (summary.description) lines.push(`> ${summary.description}`);
  lines.push("");
  for (const p of pages.slice(0, 30)) {
    lines.push(`---`);
    lines.push("");
    lines.push(`# ${p.url}`);
    lines.push("");
    lines.push(p.renderedText.replace(/\s+/g, " ").trim().slice(0, 6000));
    lines.push("");
  }
  return lines.join("\n");
}

function textSnippet(text: string, max: number): string {
  return text.replace(/\s+/g, " ").trim().slice(0, max);
}
