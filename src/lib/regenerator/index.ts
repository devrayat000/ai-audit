import { crawlSite } from "../crawler";
import { extractFacts } from "../recommendations/advisor";
import { injectHead } from "./static-surgery/injector";
import { fixHeadingHierarchy } from "./static-surgery/heading-fixer";
import { rewriteSemantics } from "./static-surgery/semantic-rewriter";
import { fixAltText } from "./static-surgery/alt-text-generator";
import { rewriteCopy } from "./static-surgery/copy-rewriter";
import { rewriteAssetUrls } from "./static-surgery/asset-inliner";
import { bundleZip } from "./static-surgery/bundler";
import { buildLlmsTxt, buildLlmsFullTxt } from "./files/llms-txt-generator";
import { buildRobotsTxt } from "./files/robots-txt-generator";
import { buildSitemap, buildSitemapWithAlternates } from "./files/sitemap-generator";
import { detectLanguageFromHtml } from "./i18n/detector";
import { classifyTextNodes } from "./i18n/classifier";
import { translateClassified, InMemoryTranslationCache } from "./i18n/translator";
import { applyTranslations } from "./i18n/applier";
import { applyDirection } from "./i18n/direction-handler";
import { detectExpansionRisks, flagPreservationFailures, flagLegalNodes } from "./i18n/expansion-checker";
import { pickFontPair, buildFontHeadHtml } from "./i18n/font-mapper";
import { injectHreflang, buildAlternatesForPair } from "./i18n/hreflang-builder";
import { scaffoldNextProject } from "./next-project/scaffolder";
import { extractRepeatingComponents } from "./next-project/component-extractor";
import { convertPage } from "./next-project/page-converter";
import { diffPage } from "./diff";
import type { CopyLlm } from "./static-surgery/copy-rewriter";
import type { AltTextLlm } from "./static-surgery/alt-text-generator";
import type { RegenFile, RegenInput, RegenResult, TranslationWarning } from "./types";

interface ClaudeClient {
  messages: {
    create(args: {
      model: string;
      max_tokens: number;
      system: string;
      messages: { role: "user"; content: string }[];
    }): Promise<{ content: Array<{ type: string; text?: string }> }>;
  };
}

function urlToZipPath(url: string, rootUrl: string): string {
  try {
    const u = new URL(url);
    const r = new URL(rootUrl);
    if (u.hostname !== r.hostname) return "";
    const path = u.pathname.replace(/^\/|\/$/g, "");
    if (!path) return "index.html";
    return `${path}/index.html`;
  } catch {
    return "";
  }
}

function makeCopyLlm(client: ClaudeClient | null): CopyLlm | null {
  if (!client) return null;
  return {
    async rewrite(input) {
      const sys =
        "You are a GEO copywriter. Rewrite text to be terse, entity-rich, action-oriented. Do NOT invent facts. Output only the rewritten text — no quotes, no explanations.";
      const user = `Kind: ${input.kind}\nIndustry: ${input.industry}\nPage: ${input.pageUrl}\nConstraints: ${input.constraints ?? "follow GEO best practice"}\nOriginal: ${input.text}\nRewrite:`;
      try {
        const res = await client.messages.create({
          model: "claude-opus-4-7",
          max_tokens: 256,
          system: sys,
          messages: [{ role: "user", content: user }],
        });
        const txt = res.content.map((c) => c.text ?? "").join("").trim();
        if (!txt) return null;
        return txt.replace(/^"|"$/g, "");
      } catch {
        return null;
      }
    },
    async generateFaq(input) {
      const sys =
        "You generate FAQ entries that AI engines can quote. 4 questions max. Output JSON array of {q, a}. Keep answers terse and factual. Do NOT invent facts not in the page text.";
      const user = `Industry: ${input.industry}\nPage title: ${input.pageTitle}\nPage URL: ${input.pageUrl}\nPage text excerpt: ${input.pageText.slice(0, 3000)}\nReturn JSON only.`;
      try {
        const res = await client.messages.create({
          model: "claude-opus-4-7",
          max_tokens: 600,
          system: sys,
          messages: [{ role: "user", content: user }],
        });
        const txt = res.content.map((c) => c.text ?? "").join("").trim();
        const start = txt.indexOf("[");
        const end = txt.lastIndexOf("]");
        if (start < 0 || end < 0) return [];
        const parsed = JSON.parse(txt.slice(start, end + 1));
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((x) => x && typeof x.q === "string" && typeof x.a === "string");
      } catch {
        return [];
      }
    },
  };
}

function makeAltLlm(client: ClaudeClient | null): AltTextLlm | null {
  if (!client) return null;
  return {
    async describe(input) {
      const sys =
        "You write concise alt text (<= 120 chars) for an image based on its filename and surrounding page context. Be specific. Do not start with 'Image of' or 'Photo of'.";
      const user = `Page title: ${input.pageTitle}\nImage src: ${input.src}\nSurrounding text: ${input.surroundingText}\nAlt text:`;
      try {
        const res = await client.messages.create({
          model: "claude-opus-4-7",
          max_tokens: 80,
          system: sys,
          messages: [{ role: "user", content: user }],
        });
        const txt = res.content.map((c) => c.text ?? "").join("").trim();
        return txt || null;
      } catch {
        return null;
      }
    },
  };
}

async function loadAnthropic(apiKey: string): Promise<ClaudeClient | null> {
  if (!apiKey) return null;
  try {
    const moduleName = "@anthropic-ai/sdk";
    const mod = (await import(/* webpackIgnore: true */ moduleName)) as {
      default?: { new (cfg: { apiKey: string }): ClaudeClient };
    } & { new (cfg: { apiKey: string }): ClaudeClient };
    const Ctor = mod.default ?? (mod as unknown as { new (cfg: { apiKey: string }): ClaudeClient });
    return new Ctor({ apiKey });
  } catch {
    return null;
  }
}

export async function runRegeneration(input: RegenInput): Promise<RegenResult> {
  const t0 = Date.now();
  const apiKey = process.env.ANTHROPIC_API_KEY ?? "";
  const claude = await loadAnthropic(apiKey);
  const copyLlm = makeCopyLlm(claude);
  const altLlm = makeAltLlm(claude);

  const fixSet = new Set(input.fixes.filter((f) => f.enabled).map((f) => f.analyzerKey));
  const notes: string[] = [];
  const fixesApplied = new Set<string>();
  const warnings: TranslationWarning[] = [];
  const pageDiffs = [];

  // Fresh crawl (we don't persist audit data; on-the-fly).
  notes.push("Crawling site for regeneration…");
  const { siteData, pages, errors } = await crawlSite(input.rootUrl, {
    industry: input.industry,
    maxPages: Math.min(input.maxPages ?? 12, Number(process.env.MAX_REGEN_PAGES ?? 50)),
  });
  notes.push(...errors.slice(0, 5).map((e) => `crawl: ${e}`));

  if (pages.length === 0) {
    throw new Error("No pages could be crawled.");
  }

  const homepage = pages.find((p) => p.url === siteData.rootUrl) ?? pages[0];
  const facts = extractFacts(homepage, siteData);

  const translation = input.translation;
  const cache = new InMemoryTranslationCache();

  const files: RegenFile[] = [];
  let homepagePreview = "";

  // For bilingual mode: target prefix for translated subtree
  const langPrefix = translation && translation.mode === "bilingual" ? `/${translation.targetLanguage}` : "";

  for (const page of pages) {
    const before = page.renderedHtml || page.rawHtml;
    let html = before;

    // Static-surgery pipeline (HTML mutations only — applies to source-language version)
    if (input.strategy === "static-surgery" || input.strategy === "next-project") {
      // 1. Heading fix
      if (fixSet.has("content-structure")) {
        const r = fixHeadingHierarchy(html);
        html = r.html;
        if (r.changed) fixesApplied.add("content-structure");
        notes.push(...r.notes);
      }
      // 2. Semantic wrap
      if (fixSet.has("semantic-html")) {
        const r = rewriteSemantics(html);
        html = r.html;
        if (r.changed) fixesApplied.add("semantic-html");
        notes.push(...r.notes);
      }
      // 3. Alt text
      if (fixSet.has("images-alt")) {
        const r = await fixAltText(html, {
          pageUrl: page.url,
          pageTitle: facts.name,
          industry: input.industry,
          llm: altLlm,
        });
        html = r.html;
        if (r.updated > 0) fixesApplied.add("images-alt");
        notes.push(...r.notes);
      }
      // 4. Copy rewrites + FAQ
      let faqQas: { q: string; a: string }[] = [];
      if (fixSet.has("meta-tags") || fixSet.has("ai-content-patterns") || fixSet.has("readability")) {
        const r = await rewriteCopy(html, {
          industry: input.industry,
          pageUrl: page.url,
          llm: copyLlm,
          enableFaq: fixSet.has("content-structure") || fixSet.has("ai-content-patterns"),
          facts: { name: facts.name, description: facts.description, city: facts.city },
        });
        html = r.html;
        faqQas = r.faqQas;
        if (r.notes.length > 0) {
          fixesApplied.add("meta-tags");
          fixesApplied.add("ai-content-patterns");
        }
        notes.push(...r.notes);
      }
      // 5. Head injection: meta, schema, viewport, lang, canonical
      const headRes = injectHead(html, {
        industry: input.industry,
        facts: { ...facts, name: facts.name || siteData.domain },
        pageUrl: page.url,
        rootUrl: input.rootUrl,
        applyFixes: fixSet,
        enableFaq: faqQas.length > 0,
        faqQas,
      });
      html = headRes.html;
      headRes.applied.forEach((k) => fixesApplied.add(k));
      // 6. Asset URLs
      html = rewriteAssetUrls(html, {
        pageUrl: page.url,
        rootUrl: input.rootUrl,
        absolutize: input.inlineAssets !== true,
      });
    }

    const sourceVersionHtml = html;

    // Translation pipeline
    let translatedHtml: string | null = null;
    if (translation && translation.mode !== "none") {
      const { nodes } = classifyTextNodes(sourceVersionHtml, translation.glossary);
      const result = await translateClassified({
        client: claude,
        cfg: translation,
        cache,
        nodes,
      });
      result.errors.forEach((e) => notes.push(e));

      const translated = applyTranslations({
        html: sourceVersionHtml,
        nodes,
        translations: new Map(
          [...result.perNodeId.entries()].map(([k, v]) => [k, { translation: v.translation }])
        ),
        newLang: translation.targetLanguage,
      });

      const directionRes = applyDirection(translated, translation.sourceDirection, translation.targetDirection);
      let dirHtml = directionRes.html;
      if (directionRes.warnings.length > 0) {
        directionRes.warnings.forEach((w) =>
          warnings.push({ pageUrl: page.url, selector: "html", kind: "rtl-flip", message: w })
        );
      }

      const fontPair = pickFontPair(translation.sourceScript, translation.targetFontFamily);
      const fontHead = buildFontHeadHtml(fontPair, translation.targetLanguage === "en" || /Latn/i.test(translation.sourceScript));
      dirHtml = dirHtml.replace(/<head([^>]*)>/i, `<head$1>\n${fontHead}\n`);

      // Warnings
      warnings.push(
        ...detectExpansionRisks({
          pageUrl: page.url,
          nodes,
          translations: new Map([...result.perNodeId.entries()].map(([k, v]) => [k, { translation: v.translation }])),
        })
      );
      warnings.push(...flagPreservationFailures(page.url, nodes, result.perNodeId));
      warnings.push(...flagLegalNodes(page.url, nodes));

      translatedHtml = dirHtml;
    }

    // Hreflang for bilingual
    let finalSourceHtml = sourceVersionHtml;
    let finalTargetHtml = translatedHtml;
    if (translation && translation.mode === "bilingual" && translatedHtml) {
      try {
        const u = new URL(page.url);
        const targetUrl = `${u.origin}${langPrefix}${u.pathname}${u.search}`;
        const sourceUrl = page.url;
        const alts = buildAlternatesForPair(sourceUrl, targetUrl, translation.sourceLanguage, translation.targetLanguage);
        finalSourceHtml = injectHreflang(sourceVersionHtml, alts);
        finalTargetHtml = injectHreflang(translatedHtml, alts);
      } catch {}
    }

    // Compute output paths
    const baseZipPath = urlToZipPath(page.url, input.rootUrl);
    if (!baseZipPath) continue;

    if (translation && translation.mode === "bilingual" && finalTargetHtml) {
      files.push({ path: baseZipPath, content: finalSourceHtml });
      files.push({ path: prefixZipPath(baseZipPath, langPrefix), content: finalTargetHtml });
    } else if (translation && (translation.mode === "literal" || translation.mode === "transcreate") && finalTargetHtml) {
      files.push({ path: baseZipPath, content: finalTargetHtml });
    } else {
      files.push({ path: baseZipPath, content: finalSourceHtml });
    }

    // Diff (against the original rendered HTML, only for translated/source pair as appropriate)
    const afterForDiff = finalTargetHtml ?? finalSourceHtml;
    pageDiffs.push(diffPage(page.url, before, afterForDiff));

    if (page.url === homepage.url) {
      homepagePreview = afterForDiff;
    }
  }

  // Site-level files (always at root). For bilingual, sitemap merges both.
  if (fixSet.has("ai-bot-access")) {
    files.push({ path: "robots.txt", content: buildRobotsTxt(input.rootUrl) });
    fixesApplied.add("ai-bot-access");
  }

  const summary = { name: facts.name, description: facts.description };
  if (fixSet.has("llms-txt")) {
    files.push({ path: "llms.txt", content: buildLlmsTxt(siteData, pages, summary) });
    files.push({ path: "llms-full.txt", content: buildLlmsFullTxt(siteData, pages, summary) });
    fixesApplied.add("llms-txt");
  }

  if (fixSet.has("sitemap")) {
    if (translation && translation.mode === "bilingual") {
      const pairs = pages
        .map((p) => {
          try {
            const u = new URL(p.url);
            const targetUrl = `${u.origin}${langPrefix}${u.pathname}${u.search}`;
            return {
              url: p.url,
              alternates: [
                { hreflang: translation.sourceLanguage, href: p.url },
                { hreflang: translation.targetLanguage, href: targetUrl },
                { hreflang: "x-default", href: p.url },
              ],
            };
          } catch {
            return null;
          }
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
      files.push({ path: "sitemap.xml", content: buildSitemapWithAlternates(pairs) });
    } else {
      files.push({ path: "sitemap.xml", content: buildSitemap(pages.map((p) => p.url)) });
    }
    fixesApplied.add("sitemap");
  }

  // README + audit copy
  files.push({
    path: "README.md",
    content: regenReadme(input, [...fixesApplied], notes.length, warnings.length, pages.length),
  });

  // Next.js project bonus output
  if (input.strategy === "next-project") {
    const scaffold = scaffoldNextProject({
      projectName: facts.name?.toLowerCase().replace(/[^a-z0-9-]+/g, "-") || siteData.domain.replace(/[^a-z0-9-]+/g, "-"),
      rootUrl: input.rootUrl,
      industry: input.industry,
      description: facts.description || `${facts.name} site`,
    });
    for (const f of scaffold) files.push({ path: `next-project/${f.path}`, content: f.content });

    const components = extractRepeatingComponents(pages.map((p) => ({ url: p.url, html: p.renderedHtml || p.rawHtml })));
    components.forEach((c) => {
      files.push({
        path: `next-project/src/components/${c.name}.tsx`,
        content: `// Extracted from ${c.pages.length} pages.
export function ${c.name}() {
  return (
    <div dangerouslySetInnerHTML={{ __html: ${JSON.stringify(c.html.slice(0, 4000))} }} />
  );
}
`,
      });
    });

    for (const p of pages) {
      const f = convertPage({ url: p.url, rootUrl: input.rootUrl, html: p.renderedHtml || p.rawHtml });
      if (f) files.push({ path: `next-project/${f.path}`, content: f.content });
    }
  }

  const { bytes, totalUncompressed } = await bundleZip(files);

  return {
    strategy: input.strategy,
    rootUrl: input.rootUrl,
    domain: siteData.domain,
    files,
    fixesApplied: [...fixesApplied],
    pageDiffs,
    homepagePreview,
    translationWarnings: warnings,
    totalSizeBytes: totalUncompressed,
    durationMs: Date.now() - t0,
    zipBase64: Buffer.from(bytes).toString("base64"),
    notes,
  };
}

function prefixZipPath(zipPath: string, prefix: string): string {
  if (!prefix) return zipPath;
  const clean = prefix.replace(/^\/+|\/+$/g, "");
  if (zipPath === "index.html") return `${clean}/index.html`;
  return `${clean}/${zipPath}`;
}

function regenReadme(
  input: RegenInput,
  fixes: string[],
  noteCount: number,
  warnCount: number,
  pageCount: number
): string {
  return `# AI-Audit Regenerated Site

Original URL: ${input.rootUrl}
Industry: ${input.industry}
Strategy: ${input.strategy}
Pages: ${pageCount}
Fixes applied: ${fixes.join(", ") || "none"}
Translation warnings: ${warnCount}
Pipeline notes: ${noteCount}

## Deploy

Drop these files onto any static host (Netlify Drop, Vercel CLI, S3+CloudFront).

## Important caveats

- Static snapshot: dynamic features (forms, search, cart) are not rewired. Restore them manually.
- Asset URLs are absolute back to the original origin by default. If you want a self-contained bundle, re-run with the "inline assets" toggle.
- ${warnCount > 0 ? "Translation warnings indicate strings that may need human review before publishing." : "No translation warnings produced."}

## Re-audit

Re-run AI Audit on the deployed regenerated site to confirm score improvements.
`;
}

export { detectLanguageFromHtml };
