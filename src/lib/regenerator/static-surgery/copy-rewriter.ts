import * as cheerio from "cheerio";
import type { Industry } from "../../types";

export interface CopyLlm {
  rewrite(input: {
    kind: "title" | "description" | "h1" | "hero";
    text: string;
    industry: Industry;
    pageUrl: string;
    constraints?: string;
  }): Promise<string | null>;
  generateFaq(input: { industry: Industry; pageTitle: string; pageUrl: string; pageText: string }): Promise<{ q: string; a: string }[]>;
}

export interface CopyOptions {
  industry: Industry;
  pageUrl: string;
  llm?: CopyLlm | null;
  enableFaq: boolean;
  facts: { name: string; description?: string; city?: string };
}

const VAGUE_H1 = /^(welcome|home|hello|about us|our (site|website))\.?$/i;

export async function rewriteCopy(html: string, opts: CopyOptions): Promise<{
  html: string;
  faqQas: { q: string; a: string }[];
  notes: string[];
}> {
  const $ = cheerio.load(html);
  const notes: string[] = [];
  const faqQas: { q: string; a: string }[] = [];

  // Title
  const titleEl = $("title").first();
  const title = titleEl.text().trim();
  if (!title || title.length < 30 || title.length > 65) {
    const fallback = `${opts.facts.name}${opts.facts.city ? ` — ${opts.facts.city}` : ""}`.slice(0, 60);
    let next = fallback;
    if (opts.llm) {
      try {
        const r = await opts.llm.rewrite({
          kind: "title",
          text: title || opts.facts.name,
          industry: opts.industry,
          pageUrl: opts.pageUrl,
          constraints: "30–65 chars. Entity-rich. No clickbait.",
        });
        if (r) next = r.slice(0, 65);
      } catch {}
    }
    if (titleEl.length === 0) $("head").prepend(`<title>${next}</title>`);
    else titleEl.text(next);
    notes.push("Rewrote <title>.");
  }

  // Meta description
  let descEl = $('meta[name="description"]');
  const desc = descEl.attr("content")?.trim() ?? "";
  if (!desc || desc.length < 70 || desc.length > 160) {
    const fallback = (opts.facts.description ||
      `${opts.facts.name}${opts.facts.city ? ` based in ${opts.facts.city}` : ""}.`).slice(0, 158);
    let next = fallback;
    if (opts.llm) {
      try {
        const r = await opts.llm.rewrite({
          kind: "description",
          text: desc || fallback,
          industry: opts.industry,
          pageUrl: opts.pageUrl,
          constraints: "70–160 chars. One sentence. Entity-rich. Action-oriented.",
        });
        if (r) next = r.slice(0, 160);
      } catch {}
    }
    if (descEl.length === 0) {
      $("head").append(`<meta name="description" content="${next.replace(/"/g, "&quot;")}">`);
    } else {
      descEl.attr("content", next);
    }
    notes.push("Rewrote meta description.");
  }

  // h1
  const h1 = $("h1").first();
  const h1Text = h1.text().trim();
  if (h1Text && VAGUE_H1.test(h1Text)) {
    let next = `${opts.facts.name}${opts.facts.city ? ` in ${opts.facts.city}` : ""}`;
    if (opts.llm) {
      try {
        const r = await opts.llm.rewrite({
          kind: "h1",
          text: h1Text,
          industry: opts.industry,
          pageUrl: opts.pageUrl,
          constraints: "One line. Includes business name and city if available.",
        });
        if (r) next = r;
      } catch {}
    }
    h1.text(next);
    notes.push("Rewrote <h1>.");
  }

  // FAQ generation (append before footer)
  if (opts.enableFaq && opts.llm) {
    const pageText = $("body").text().replace(/\s+/g, " ").trim().slice(0, 4000);
    try {
      const qas = await opts.llm.generateFaq({
        industry: opts.industry,
        pageTitle: title || opts.facts.name,
        pageUrl: opts.pageUrl,
        pageText,
      });
      if (qas.length > 0) {
        faqQas.push(...qas);
        const block = ["<section aria-label=\"FAQ\" class=\"ai-audit-generated-faq\"><h2>Frequently asked questions</h2>"];
        for (const qa of qas) {
          block.push(`<details><summary><strong>${escapeHtml(qa.q)}</strong></summary><p>${escapeHtml(qa.a)}</p></details>`);
        }
        block.push("</section>");
        const footer = $("footer").first();
        if (footer.length > 0) footer.before(block.join(""));
        else $("body").append(block.join(""));
        notes.push(`Generated FAQ with ${qas.length} question(s).`);
      }
    } catch {}
  }

  return { html: $.html(), faqQas, notes };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
