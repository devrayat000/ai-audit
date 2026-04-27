# AI Audit Analyzer + Regenerator — Build Spec for Claude Code

> **Mission:** Build a complete, production-ready Next.js 16 web application that (a) audits any website for AI / LLM compatibility (GEO — Generative Engine Optimization), (b) produces per-page and site-wide reports with industry-specific recommendations, and (c) **regenerates an AI-optimized version of the verified-owned site** — preserving the original design while injecting all the fixes the audit identified, ready to download or one-click deploy.

> **Mode:** Build the entire application end-to-end. No phasing, no MVPs — ship everything described below in one cohesive codebase.

---

## 1. Tech Stack (use these exact versions or `latest`)

| Layer | Choice | Version |
|---|---|---|
| Framework | Next.js (App Router) | `16.2.4` (or `latest`) |
| Language | TypeScript | `latest` (strict mode) |
| Runtime | React | `19.2` (bundled with Next 16) |
| Styling | Tailwind CSS | `v4` (or `latest`) |
| UI primitives | shadcn/ui (Radix-based) | `latest` |
| Icons | lucide-react | `latest` |
| Crawler | Playwright | `1.59.1` (or `latest`) — used server-side only |
| HTML parsing | cheerio | `latest` |
| Schema.org parsing | `schema-dts` + custom JSON-LD parser | `latest` |
| Robots parsing | `robots-parser` | `latest` |
| URL/sitemap parsing | `sitemapper` | `latest` |
| Reading score | `text-readability` | `latest` |
| Validation | zod | `latest` |
| State / forms | react-hook-form | `latest` |
| Async queue (in-memory) | `p-queue` | `latest` |
| DB | SQLite via `better-sqlite3` (dev) — abstract for swap to Postgres later | `latest` |
| ORM | Drizzle ORM | `latest` |
| AI recommendations | `@anthropic-ai/sdk` (Claude API) | `latest` |
| HTML rewriter (regen) | `parse5` + `domhandler` + `cheerio` | `latest` |
| CSS preservation | `postcss` + `postcss-safe-parser` | `latest` |
| Code formatting | `prettier` | `latest` |
| Zip bundling | `jszip` | `latest` |
| Domain verification | `dns/promises` (Node built-in) | — |
| Sandbox preview | `iframe srcdoc` (no extra dep) | — |
| Language detection | `franc-min` + ISO 639-1 mapper | `latest` |
| Script direction | `rtl-detect` | `latest` |
| PDF report export | `@react-pdf/renderer` | `latest` |
| Charts | `recharts` | `latest` |
| Animations | `motion` (Framer Motion successor) | `latest` |
| Testing | Vitest + Playwright Test | `latest` |

**Node:** 22.x or 24.x. **Package manager:** `pnpm`.

---

## 2. Project Structure

```
ai-audit-analyzer/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                          # Landing + URL submission
│   ├── audit/
│   │   ├── [auditId]/
│   │   │   ├── page.tsx                  # Site-wide report
│   │   │   ├── loading.tsx               # Live progress UI
│   │   │   ├── pages/
│   │   │   │   └── [pageId]/page.tsx     # Per-page report
│   │   │   └── regenerate/
│   │   │       ├── page.tsx              # Regeneration setup + verification
│   │   │       └── [jobId]/page.tsx      # Live regen + preview + download
│   │   └── new/route.ts                  # POST starts an audit
│   ├── api/
│   │   ├── audit/
│   │   │   ├── start/route.ts            # POST: kick off audit
│   │   │   ├── [auditId]/status/route.ts # GET: SSE stream of progress
│   │   │   ├── [auditId]/route.ts        # GET: full results JSON
│   │   │   └── [auditId]/export/route.ts # GET: PDF export
│   │   ├── recommend/route.ts            # POST: LLM-generated fix for a finding
│   │   ├── verify/
│   │   │   ├── start/route.ts            # POST: issue verification token
│   │   │   └── check/route.ts            # POST: confirm DNS/meta token
│   │   └── regenerate/
│   │       ├── start/route.ts            # POST: kick off regeneration (auth-gated)
│   │       ├── [jobId]/status/route.ts   # GET: SSE progress
│   │       ├── [jobId]/preview/route.ts  # GET: rendered HTML for iframe preview
│   │       ├── [jobId]/diff/route.ts     # GET: before/after diff JSON
│   │       └── [jobId]/download/route.ts # GET: zip of regenerated site
│   └── globals.css
├── lib/
│   ├── crawler/
│   │   ├── index.ts                      # Orchestrator
│   │   ├── playwright-fetcher.ts         # JS-rendered fetch
│   │   ├── raw-fetcher.ts                # Plain HTTP fetch (what AI bots see)
│   │   ├── url-discovery.ts              # sitemap.xml + link extraction + BFS
│   │   └── industry-detector.ts          # Heuristic: restaurant/travel/service/etc.
│   ├── analyzers/
│   │   ├── base.ts                       # BaseAnalyzer interface + types
│   │   ├── ai-bot-access.ts              # Checks robots.txt + actual fetch w/ AI UAs
│   │   ├── llms-txt.ts                   # /llms.txt + /llms-full.txt
│   │   ├── schema-markup.ts              # JSON-LD, Microdata, RDFa parsing
│   │   ├── meta-tags.ts                  # title, description, OG, Twitter
│   │   ├── content-structure.ts          # headings, paragraphs, lists, FAQ
│   │   ├── readability.ts                # Flesch, sentence length
│   │   ├── eeat.ts                       # author, about, contact, dates
│   │   ├── semantic-html.ts              # article, section, main, nav
│   │   ├── images-alt.ts                 # alt text coverage + quality
│   │   ├── https-security.ts
│   │   ├── canonical.ts                  # canonical URL + duplicate content
│   │   ├── mobile.ts                     # viewport + responsive checks
│   │   ├── performance.ts                # size, render-blocking, basic CWV
│   │   ├── js-vs-raw.ts                  # KEY: compares JS-rendered vs raw HTML
│   │   ├── internal-linking.ts           # link graph health
│   │   ├── language.ts                   # html[lang]
│   │   └── index.ts                      # registry of all analyzers
│   ├── scoring/
│   │   ├── weights.ts                    # category weights
│   │   ├── score-engine.ts               # aggregates CheckResults → page/site scores
│   │   └── grade.ts                      # numeric → letter grade (A+/A/B/C/D/F)
│   ├── recommendations/
│   │   ├── advisor.ts                    # Pulls rule-based fixes
│   │   ├── llm-advisor.ts                # Calls Claude for content rewrites
│   │   ├── schema-templates.ts           # Pre-built JSON-LD by industry
│   │   └── industry-rules.ts             # Restaurant/travel/service-specific musts
│   ├── regenerator/
│   │   ├── index.ts                      # Top-level orchestrator
│   │   ├── strategy.ts                   # Picks 'static-surgery' or 'next-project'
│   │   ├── static-surgery/
│   │   │   ├── injector.ts               # Inserts JSON-LD, meta, llms.txt
│   │   │   ├── semantic-rewriter.ts      # div → article/section/main where safe
│   │   │   ├── heading-fixer.ts          # Normalizes h1-h6 hierarchy
│   │   │   ├── alt-text-generator.ts     # Claude vision call per <img>
│   │   │   ├── copy-rewriter.ts          # Claude rewrites titles/headings/hero
│   │   │   ├── asset-inliner.ts          # Inlines critical CSS, rewrites asset paths
│   │   │   └── bundler.ts                # Outputs zip of static site
│   │   ├── next-project/
│   │   │   ├── scaffolder.ts             # Generates Next.js project skeleton
│   │   │   ├── component-extractor.ts    # Identifies repeating patterns → components
│   │   │   ├── page-converter.ts         # Each crawled URL → app/.../page.tsx
│   │   │   └── bundler.ts                # Outputs zip of Next.js project
│   │   ├── files/
│   │   │   ├── llms-txt-generator.ts
│   │   │   ├── robots-txt-generator.ts
│   │   │   └── sitemap-generator.ts
│   │   ├── i18n/
│   │   │   ├── detector.ts                  # Language + script + direction detection
│   │   │   ├── classifier.ts                # Classifies each text node: preserve / translate / transcreate
│   │   │   ├── translator.ts                # Claude API translation with batching + caching
│   │   │   ├── glossary.ts                  # Per-domain term locking (business name, dishes, etc.)
│   │   │   ├── font-mapper.ts               # Source font → Latin equivalent
│   │   │   ├── direction-handler.ts         # RTL → LTR layout flip (CSS logical props)
│   │   │   ├── expansion-checker.ts         # Flags layouts likely to overflow after translation
│   │   │   └── hreflang-builder.ts          # Builds <link rel="alternate" hreflang="..."> tags
│   │   └── diff.ts                       # Generates before/after diff
│   ├── verification/
│   │   ├── token.ts                      # HMAC-signed verification tokens
│   │   ├── dns-verifier.ts               # Checks TXT record on _ai-audit.<domain>
│   │   └── meta-verifier.ts              # Fetches site, looks for <meta name="ai-audit-verify">
│   ├── db/
│   │   ├── schema.ts                     # Drizzle schema
│   │   ├── client.ts                     # DB client init
│   │   └── migrations/
│   ├── jobs/
│   │   ├── audit-runner.ts               # Top-level orchestrator
│   │   └── progress-emitter.ts           # SSE event emitter
│   └── utils/
│       ├── url.ts
│       ├── http.ts
│       └── ai-bots.ts                    # List of AI bot user-agents
├── components/
│   ├── ui/                               # shadcn/ui primitives
│   ├── audit-form.tsx
│   ├── progress-stream.tsx               # Live SSE consumer
│   ├── score-card.tsx
│   ├── score-radial.tsx
│   ├── check-result-row.tsx
│   ├── page-list.tsx
│   ├── recommendation-card.tsx
│   ├── code-snippet.tsx                  # JSON-LD copy-to-clipboard
│   ├── industry-selector.tsx
│   ├── pdf-report.tsx
│   ├── verification-flow.tsx             # DNS / meta verification stepper
│   ├── regenerate-cta.tsx                # Banner on report → "Regenerate optimized version"
│   ├── regenerate-strategy-picker.tsx    # Static vs Next.js project chooser
│   ├── regenerate-progress.tsx           # SSE consumer for regen status
│   ├── side-by-side-preview.tsx          # Two iframes: original vs optimized
│   ├── diff-viewer.tsx                   # Inline before/after diff
│   ├── language-picker.tsx               # Source detected, target chooser
│   ├── glossary-editor.tsx               # User reviews/edits the term lock list before regen
│   ├── translation-warnings.tsx          # Layout-overflow + RTL→LTR alerts
│   └── deploy-buttons.tsx                # Vercel + Netlify + raw download
├── public/
├── drizzle.config.ts
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## 3. Database Schema (Drizzle)

```ts
// audits — one per submitted URL
audits {
  id: text PK (cuid)
  rootUrl: text
  industry: text  // 'restaurant' | 'travel' | 'service' | 'ecommerce' | 'blog' | 'general'
  status: text    // 'queued' | 'crawling' | 'analyzing' | 'completed' | 'failed'
  totalPages: integer
  pagesAnalyzed: integer
  overallScore: integer
  grade: text
  createdAt: timestamp
  completedAt: timestamp
}

// pages — one per crawled URL
pages {
  id: text PK
  auditId: text FK → audits.id
  url: text
  title: text
  statusCode: integer
  pageScore: integer
  pageGrade: text
  rawHtmlLength: integer
  renderedHtmlLength: integer
  jsDependencyRatio: real  // 0..1, how much content needs JS
}

// check_results — one per analyzer per page (or per-site for site-wide)
check_results {
  id: text PK
  auditId: text FK
  pageId: text FK NULLABLE  // null = site-wide check
  analyzerKey: text          // 'ai-bot-access' | 'schema-markup' | ...
  category: text             // 'access' | 'structure' | 'content' | 'meta' | 'security'
  status: text               // 'pass' | 'warn' | 'fail'
  score: integer
  maxScore: integer
  message: text
  evidence: jsonb            // raw findings
  fixSuggestion: text
}

// recommendations — LLM-generated, on-demand
recommendations {
  id: text PK
  checkResultId: text FK
  type: text          // 'schema-template' | 'content-rewrite' | 'meta-rewrite'
  content: text       // the fix (code block, rewritten copy, etc.)
  generatedAt: timestamp
}

// domain_verifications — proof user owns the domain
domain_verifications {
  id: text PK (cuid)
  domain: text                     // canonical domain (no protocol, no www)
  token: text                      // HMAC-signed random token
  method: text                     // 'dns-txt' | 'meta-tag'
  status: text                     // 'pending' | 'verified' | 'expired' | 'failed'
  verifiedAt: timestamp NULLABLE
  expiresAt: timestamp             // 24h after creation
  createdAt: timestamp
}

// regeneration_jobs — one per regenerate request
regeneration_jobs {
  id: text PK (cuid)
  auditId: text FK → audits.id
  verificationId: text FK → domain_verifications.id   // MUST be 'verified'
  strategy: text                   // 'static-surgery' | 'next-project'
  sourceLanguage: text             // ISO 639-1, e.g. 'bn', 'fr', 'ja' — auto-detected
  sourceScript: text               // e.g. 'Beng', 'Latn', 'Arab' (ISO 15924)
  sourceDirection: text            // 'ltr' | 'rtl'
  targetLanguage: text             // ISO 639-1, default 'en'
  targetDirection: text            // 'ltr' | 'rtl'
  translationMode: text            // 'none' | 'literal' | 'transcreate' | 'bilingual'
  multilingualOutput: boolean      // true → output BOTH original and translated with hreflang
  glossary: jsonb                  // { "Bangla term": "preserved English equivalent" }
  status: text                     // 'queued' | 'processing' | 'completed' | 'failed'
  progress: integer                // 0..100
  currentStep: text                // human-readable, e.g. "Rewriting hero copy"
  fixesApplied: jsonb              // list of fix keys applied
  outputPath: text NULLABLE        // path to zip on disk
  outputSizeBytes: integer NULLABLE
  previewHtmlPath: text NULLABLE   // for the homepage preview iframe
  errorMessage: text NULLABLE
  createdAt: timestamp
  completedAt: timestamp NULLABLE
}

// translation_cache — avoid re-translating same strings across pages
translation_cache {
  id: text PK
  jobId: text FK → regeneration_jobs.id
  sourceText: text
  sourceTextHash: text             // sha256, indexed
  targetText: text
  classification: text             // 'preserve' | 'literal' | 'transcreate'
  contextHint: text NULLABLE       // e.g. "page title", "alt text", "menu item"
  createdAt: timestamp
}
```

---

## 4. Core Type Definitions

```ts
// lib/analyzers/base.ts
export type CheckStatus = 'pass' | 'warn' | 'fail';
export type Category = 'access' | 'structure' | 'content' | 'meta' | 'security' | 'performance' | 'eeat';

export interface CheckResult {
  analyzerKey: string;
  category: Category;
  name: string;              // "AI Bot Access (robots.txt)"
  shortDescription: string;  // "AI bots can crawl your site"
  status: CheckStatus;
  score: number;
  maxScore: number;
  message: string;           // human-readable summary
  evidence: Record<string, unknown>;
  fixSuggestion: string;     // brief, actionable
  llmFixAvailable: boolean;  // true → "Generate fix" button shown
}

export interface PageData {
  url: string;
  statusCode: number;
  rawHtml: string;           // no JS executed
  renderedHtml: string;      // after JS
  renderedText: string;
  responseHeaders: Record<string, string>;
  loadTimeMs: number;
  industry: Industry;
}

export interface SiteData {
  rootUrl: string;
  domain: string;
  robotsTxt: string | null;
  sitemapUrls: string[];
  llmsTxt: string | null;
  llmsFullTxt: string | null;
  industry: Industry;
}

export interface BaseAnalyzer {
  key: string;
  scope: 'page' | 'site';
  run(input: PageData | SiteData): Promise<CheckResult[]>;
}
```

---

## 5. The Full Analyzer List (implement ALL of these)

### Site-scope analyzers

| Key | What it checks | Score |
|---|---|---|
| `ai-bot-access` | `robots.txt` allows GPTBot, ClaudeBot, PerplexityBot, Google-Extended, CCBot, Bytespider, Applebot-Extended, Amazonbot, Meta-ExternalAgent, OAI-SearchBot. **Plus:** actually fetch with each UA — many sites allow in robots.txt but block at WAF (return 403/429). | 20 |
| `llms-txt` | `/llms.txt` exists, valid format, references key pages. `/llms-full.txt` bonus. | 20 |
| `sitemap` | `sitemap.xml` present, valid XML, referenced in robots.txt. | 5 |
| `https-security` | HTTPS enforced, valid cert, HSTS header, no mixed content. | 10 |
| `canonical-domain` | Single canonical domain (www vs non-www, http→https redirects). | 5 |

### Page-scope analyzers

| Key | What it checks | Score |
|---|---|---|
| `schema-markup` | JSON-LD present, valid, **industry-appropriate** types. Restaurant → Restaurant + Menu + OpeningHoursSpecification + PostalAddress. Travel → TravelAgency / TouristAttraction / LodgingBusiness. Service → LocalBusiness + Service + Organization. Plus generic: BreadcrumbList, FAQPage, Article. | 20 |
| `meta-tags` | `<title>` 30–65 chars, meta description 70–160 chars, OG tags, Twitter card, canonical. | 15 |
| `content-structure` | One `<h1>`, logical heading hierarchy (no h1→h3 skips), FAQ presence, lists, tables, paragraph length. | 15 |
| `readability` | Flesch reading ease ≥ 50, avg sentence length ≤ 22 words, no walls of text. | 5 |
| `semantic-html` | `<main>`, `<article>`, `<section>`, `<nav>`, `<header>`, `<footer>` used appropriately. | 5 |
| `eeat-signals` | Author byline, about-us link, contact info, published/updated dates, citations. | 10 |
| `images-alt` | % of `<img>` with non-empty, descriptive alt text. Penalize "image", "photo", filenames. | 5 |
| `js-vs-raw` | **Critical.** Compare raw HTML text length vs rendered text length. If raw < 30% of rendered → AI bots miss most content. Score inverse to JS-dependency ratio. | 15 |
| `internal-linking` | Page is linked from elsewhere on the site, descriptive anchor text. | 5 |
| `mobile-viewport` | `<meta viewport>` set correctly. | 3 |
| `language-attr` | `<html lang="...">` set. | 2 |

### Bonus checks (implement all)

- **AI-friendly content patterns:** detect direct-answer leads, fact density, named entities (use simple NER via regex/heuristics + optional LLM pass).
- **Freshness signals:** look for `dateModified`, `datePublished` either in schema or visible.
- **Cloudflare AI block detection:** if `cf-ray` header present + GPTBot returns 403, flag explicitly.

---

## 6. Crawler Implementation Spec

```ts
// lib/crawler/index.ts
export async function crawlSite(rootUrl: string, opts: {
  maxPages?: number;          // default 50, max 200
  maxDepth?: number;          // default 4
  respectRobots?: boolean;    // default true
  industry?: Industry;
  onProgress?: (event: CrawlEvent) => void;
}): Promise<{ siteData: SiteData; pages: PageData[] }>
```

**Behavior:**

1. Normalize the input URL. Resolve redirects. Lock to that final domain.
2. Fetch `/robots.txt`, `/sitemap.xml`, `/llms.txt`, `/llms-full.txt`. Build initial URL queue from sitemap + homepage.
3. BFS crawl up to `maxPages`. Same domain only.
4. For each URL:
   - Fetch **raw HTML** via plain `fetch()` with realistic UA (no JS).
   - Fetch **rendered HTML** via Playwright Chromium headless, `waitUntil: 'networkidle'`, 15s timeout.
   - Extract internal links from rendered DOM, push new ones to queue.
   - Capture `loadTimeMs`, `statusCode`, `responseHeaders`.
5. Use `p-queue` with `concurrency: 3` to avoid hammering target site.
6. Emit progress events via callback so the UI can stream them via SSE.

**Industry detection (`industry-detector.ts`):**
Look for keyword density on homepage + schema types already present. Return one of `restaurant | travel | service | ecommerce | blog | general`. If `<= 60%` confidence, default to `general` and let user override in UI.

---

## 7. Scoring Engine

```ts
// lib/scoring/weights.ts
export const CATEGORY_WEIGHTS = {
  access: 0.25,       // robots, llms.txt — site-wide
  structure: 0.20,    // headings, semantic HTML, internal linking
  content: 0.20,      // readability, EEAT, images
  meta: 0.15,         // schema, meta tags
  security: 0.10,     // https
  performance: 0.10,  // js-vs-raw, mobile
};
```

- **Page score:** weighted sum of page-scope check_results (0–100).
- **Site score:** 60% average of page scores + 40% site-scope checks.
- **Grade:** A+ (95+), A (90+), B (80+), C (70+), D (60+), F (<60).

---

## 8. Recommendations Engine

Two layers:

### 8a. Rule-based (instant, free)

Hard-coded JSON-LD templates per industry (`schema-templates.ts`). When `schema-markup` analyzer flags missing types, return the exact template pre-filled with whatever data the crawler found (business name, address from existing markup or `<meta>`, etc.).

Example for restaurants:

```ts
export function restaurantSchemaTemplate(extracted: ExtractedFacts): object {
  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: extracted.name ?? "[Your Restaurant Name]",
    image: extracted.heroImage ?? "[URL to hero image]",
    address: {
      "@type": "PostalAddress",
      streetAddress: extracted.streetAddress ?? "[Street]",
      addressLocality: extracted.city ?? "[City]",
      // ...
    },
    servesCuisine: extracted.cuisine ?? "[e.g., Italian]",
    priceRange: extracted.priceRange ?? "$$",
    telephone: extracted.phone ?? "[+1-555-...]",
    openingHoursSpecification: [/* template */],
    menu: extracted.menuUrl ?? `${extracted.rootUrl}/menu`,
    acceptsReservations: true,
  };
}
```

### 8b. LLM-powered (on-demand, costs API calls)

`/api/recommend` endpoint accepts a `checkResultId` and uses the Claude API to:

- **Rewrite weak page titles/meta descriptions** to be entity-rich, location-specific, action-oriented.
- **Rewrite hero copy** like "Welcome to our restaurant" → "Bella Italia is a family-owned Italian restaurant in [city] serving handmade pasta since 2015, open daily 12pm–11pm."
- **Generate FAQ sections** from inferred page topic (great for AI engines).
- **Suggest internal linking opportunities.**

Use `@anthropic-ai/sdk` server-side. Model: `claude-opus-4-7`. Stream the response back to the client. **Never expose the API key client-side.** Read from `ANTHROPIC_API_KEY` env var.

---

## 8.5. The Regenerator (Major Feature)

The regenerator takes an audited site and produces an **AI-optimized clone** that preserves the original visual design while applying every fix the audit identified. Output is a deployable bundle (zip download or one-click deploy to Vercel/Netlify).

### 8.5.1 Hard Rules — Read These First

1. **Domain ownership verification is MANDATORY.** Regeneration is gated behind a verified `domain_verifications` record matching the audit's domain. No verification → no regeneration. Period. This is the legal/ethical guardrail; do not weaken it.
2. **Two methods accepted:** DNS TXT record OR `<meta name="ai-audit-verify" content="...">` tag. User picks.
3. **Verification expires after 24 hours** but a successful regen can happen any time within that window.
4. **The user-facing copy must be honest:** "AI-optimized clone of YOUR site" — never imply you can clone arbitrary sites.
5. **Never use the words "v0" or "Lovable" in user-facing UI** — internally we use Claude API only. Those products don't have the right APIs for this workflow.
6. **Visual fidelity target:** 95%+. Document this honestly — minor structural changes (e.g., wrapping main content in `<article>`) may shift layout 1-2px.

### 8.5.2 Verification Flow

**Step 1 — User clicks "Regenerate optimized version" on the audit report.**
Modal opens. Two tabs: DNS TXT / Meta Tag.

**Step 2 — Token issued via `/api/verify/start`:**

```ts
POST /api/verify/start
Body: { domain: "example.com" }
Returns: {
  verificationId: "ver_abc123",
  token: "ai-audit-verify=8f7a3e...",   // HMAC-signed
  dnsRecord: { name: "_ai-audit.example.com", type: "TXT", value: "8f7a3e..." },
  metaTag: '<meta name="ai-audit-verify" content="8f7a3e..." />',
  expiresAt: "2026-04-28T..."
}
```

Token format: `<random-12-bytes>.<hmac-sha256-of-domain-and-random>`. Signing secret in `VERIFICATION_SECRET` env var.

**Step 3 — User adds DNS record OR meta tag, then clicks "Verify":**

```ts
POST /api/verify/check
Body: { verificationId: "ver_abc123" }
Returns: { status: "verified" | "pending" | "failed", message: string }
```

DNS check: `dns.promises.resolveTxt('_ai-audit.example.com')`, look for matching value.
Meta check: fetch homepage with raw HTTP, parse with cheerio, look for `meta[name="ai-audit-verify"][content="..."]`.

**Step 4 — Once verified, "Continue to Regeneration" enables.** Verification record is reusable for any audit on the same domain within 24h.

### 8.5.3 Strategy Selection

User picks one of two strategies (UI explains tradeoffs):

#### Strategy A: Static Surgery (default, recommended for most sites)

Takes the rendered HTML of every crawled page, surgically applies fixes, outputs static HTML/CSS/JS files. Best for: marketing sites, restaurants, travel agencies, service businesses, blogs.

- ✅ Preserves design with near-perfect fidelity
- ✅ Fast (~30-60 seconds per site)
- ✅ Cheap (~$0.20-0.50 in Claude API costs)
- ⚠️ Static snapshot — dynamic features (forms, search, cart) need to be re-wired manually
- ⚠️ JS-heavy sites lose interactivity

#### Strategy B: Next.js Project (advanced)

Generates a full Next.js 16 project with the original design recreated as React components, content as MDX, and all AI optimizations baked in. Best for: sites the user wants to actively maintain going forward.

- ✅ Maintainable codebase
- ✅ Server-rendered → AI-friendly by default
- ⚠️ Slower (~3-5 minutes)
- ⚠️ More expensive (~$2-5 in API costs)
- ⚠️ Slight visual drift possible (Claude reinterprets the design)

`lib/regenerator/strategy.ts` auto-recommends based on the audit:

- High `js-vs-raw` failure rate (heavily JS-dependent site) → recommend Next.js Project
- Otherwise → recommend Static Surgery

### 8.5.4 Static Surgery — How It Works

For each crawled page, run the pipeline in `lib/regenerator/static-surgery/`:

1. **Load** the rendered HTML from the audit's stored `pages.renderedHtml` (parse with `parse5`).
2. **Inject head additions** (`injector.ts`):
   - JSON-LD `<script type="application/ld+json">` for industry-appropriate schema (use `recommendations/schema-templates.ts` filled with extracted facts).
   - Missing `<meta>` tags: description, OG, Twitter card, canonical.
   - `<html lang="...">` if missing.
   - `<meta name="viewport" content="width=device-width, initial-scale=1">` if missing.
3. **Fix heading hierarchy** (`heading-fixer.ts`): scan `h1`-`h6`, ensure exactly one `h1`, no skipped levels. When found, downgrade extra h1s to h2 or upgrade lone h3s — never delete content.
4. **Semantic wrapping** (`semantic-rewriter.ts`): **conservative.** Only wrap when the pattern is unambiguous:
   - `<div class="*nav*">` containing only `<a>` → `<nav>`
   - `<div class="*footer*">` at end of body → `<footer>`
   - `<div class="*header*">` at start of body → `<header>`
   - The largest text-containing div between header/footer → `<main>`
   - **Never** rewrite if it would break CSS selectors targeting those divs. Detect by parsing linked CSS first.
5. **Alt text** (`alt-text-generator.ts`): for every `<img>` missing alt or with low-quality alt ("image", "photo", filename), call Claude with the image URL and surrounding context. Batch up to 10 per API call. Cache by image hash.
6. **Copy rewrites** (`copy-rewriter.ts`): use Claude to rewrite (in place):
   - `<title>` if scored low
   - `<meta name="description">` if scored low
   - `<h1>` if vague (e.g., "Welcome")
   - Hero paragraph if entity-poor
   - Generate an FAQ section to append before footer (industry-relevant questions)
   - **Preserve all surrounding HTML and CSS classes verbatim** — only swap text content.
7. **Site-level files** (`files/`):
   - Generate `llms.txt` listing key pages with descriptions (markdown format per the proposed standard).
   - Generate `llms-full.txt` with the full text content of key pages.
   - Rewrite `robots.txt` to explicitly allow all AI bots.
   - Generate `sitemap.xml` from crawled URLs.
8. **Asset paths** (`asset-inliner.ts`): all `<link>`, `<script>`, `<img src>` → either rewrite to absolute original URLs (CDN-style, easy) or download and bundle (offline-capable, slower). Default: absolute URLs. User can toggle.
9. **Bundle** (`bundler.ts`): output zip:

   ```
   regenerated-site/
   ├── index.html
   ├── about/index.html
   ├── menu/index.html
   ├── ... (one per crawled page)
   ├── robots.txt
   ├── sitemap.xml
   ├── llms.txt
   ├── llms-full.txt
   ├── _ai-audit-report.html         # Embedded copy of the audit findings
   └── README.md                     # Deploy instructions
   ```

### 8.5.5 Next.js Project Strategy — How It Works

When chosen, `lib/regenerator/next-project/` runs a different pipeline:

1. **Component extraction** (`component-extractor.ts`): identify repeating DOM patterns across pages (navbar, footer, card layouts). For each, create a React component preserving the original CSS.
2. **CSS preservation:** copy all linked stylesheets verbatim into `app/globals.css` and `app/[component].module.css`. **Do not** rewrite to Tailwind — preserves fidelity.
3. **Page conversion** (`page-converter.ts`): for each crawled page, generate `app/<path>/page.tsx`. Content goes into the JSX. Schema goes into the page's `metadata` export. FAQ goes into a `<FAQ>` component.
4. **Generate**: `next.config.ts`, `package.json`, `tsconfig.json`, `app/layout.tsx`, `robots.ts`, `sitemap.ts`, `app/llms.txt/route.ts`.
5. **Bundle** as zip, ready for `pnpm install && pnpm dev`.

### 8.5.6 Regeneration API

| Route | Method | Body | Returns |
|---|---|---|---|
| `/api/verify/start` | POST | `{ domain }` | verification details |
| `/api/verify/check` | POST | `{ verificationId }` | `{ status }` |
| `/api/regenerate/start` | POST | `{ auditId, verificationId, strategy }` | `{ jobId }` |
| `/api/regenerate/[jobId]/status` | GET (SSE) | — | progress stream |
| `/api/regenerate/[jobId]/preview` | GET | — | regenerated homepage HTML (for iframe) |
| `/api/regenerate/[jobId]/diff` | GET | `?pageId=...` | `{ before, after, changes[] }` |
| `/api/regenerate/[jobId]/download` | GET | — | zip binary |

`/api/regenerate/start` validates: audit exists + completed + verification exists + verified + same domain. Otherwise 403.

### 8.5.7 UI Flow for Regeneration

**On the completed audit report**, a prominent banner above the recommendations:

> 🚀 **Want this fixed automatically?**
> We can regenerate an AI-optimized version of your site with all these fixes applied — keeping your design intact.
> [Regenerate optimized version]

Clicking opens `/audit/[auditId]/regenerate`:

**Step 1 panel — Verify Ownership.** Two-tab card (DNS / Meta Tag). Code blocks with one-click copy. "Check verification" button. Spinner → green checkmark on success.

**Step 2 panel — Choose Strategy.** Two big cards side-by-side. Recommended one is highlighted with a badge. Each card lists pros/cons and shows estimated time + estimated cost. Tooltip explains: "Cost reflects Claude API usage; we don't add markup."

**Step 3 panel — Review Fixes To Apply.** Checklist of every fix the audit found. All checked by default. User can uncheck any.

**[Start Regeneration] button.**

**Live regen page — `/audit/[auditId]/regenerate/[jobId]`:**

- Progress bar with current step ("Rewriting hero copy on /menu", "Generating alt text for 12 images", "Bundling output").
- As soon as the homepage is regenerated, show **side-by-side iframes**: original (left) vs optimized (right). Both rendered live.
- Below: a "Diff" tab showing the actual HTML changes per page (use `diff` library, color-coded).
- Once complete:
  - **[Download .zip]** button (primary)
  - **[Deploy to Vercel]** button (uses Vercel Deploy Button URL with the zip)
  - **[Deploy to Netlify]** button (Netlify Drop)
  - **Re-audit the new version** button → kicks off a fresh audit on the regenerated site (ideally hosted on a temporary URL) to prove the score went up.

### 8.5.8 Side-by-Side Preview Implementation

Two iframes with `sandbox="allow-same-origin"`. Left iframe `src` = original URL. Right iframe `srcdoc` = regenerated HTML string. Synchronized scroll (optional toggle). Viewport size selector (mobile / tablet / desktop).

### 8.5.9 Cost Controls & Safety

- Hard cap regeneration to sites with ≤ 50 pages (configurable via `MAX_REGEN_PAGES`).
- Hard cap Claude API spend per regeneration via `MAX_REGEN_TOKENS`.
- Rate limit: max 3 regenerations per verified domain per day.
- Log all regenerations (audit trail) — domain, timestamp, verification method.
- Strip any user PII from regenerated content before bundling? **No** — it's their own site, but document this in the privacy policy.

### 8.5.10 Acceptance Criteria for Regeneration (added to §16)

1. Cannot start regeneration without a verified domain ownership record.
2. Static Surgery on `https://example.com` (verified locally via meta tag) produces a downloadable zip in under 90 seconds.
3. Re-auditing the regenerated zip (served from `localhost`) produces a score at least 30 points higher than the original.
4. Side-by-side preview renders both versions correctly and scrolls in sync when toggled.
5. Vercel + Netlify deploy buttons are wired and clicking either produces a working deployment of the regenerated site.

---

## 8.6. Multi-Language Regeneration (Translate While Regenerating)

The regenerator can produce a translated version of the site (typically: non-English source → English target, but any pair is supported). This is a separate concern from the AI optimization fixes — both can run together in one regeneration job.

### 8.6.1 Hard Rules — Read These First

1. **Translation is opt-in, not default.** The default behavior is "regenerate in original language." User must explicitly enable translation.
2. **Domain ownership verification still applies.** Translating someone else's site is even more sensitive than cloning. Same verification flow, no exceptions.
3. **Business-critical fields are PRESERVED VERBATIM, never translated:**
   - Numbers (prices, phone numbers, years, quantities, statistics)
   - Addresses (street, city, postal code — though city *names* may be transliterated)
   - Email addresses, URLs, social handles
   - Proper nouns by default (business name, person names, dish names, brand names, place names) — user can override per-term in the glossary editor
   - Schema.org structured data values (the schema *keys* are already English; values matching the above categories stay)
   - Dates and times
4. **The translator does NOT invent facts.** If the source says "established in 1985," the output says "established in 1985" — never "established in the mid-1980s" or "with decades of history." If the source is ambiguous, preserve the ambiguity.
5. **Mandatory human review banner.** Before download, the UI shows a prominent warning: "Translated content has not been reviewed by a human translator. Review before publishing — especially menu items, allergy info, legal text, and pricing." User must check a confirmation box.
6. **No translation of legally-sensitive content without flagging.** Detect terms suggesting legal disclaimers, allergy info, medical claims, financial figures — flag them for mandatory human review before allowing download.

### 8.6.2 Language Detection

`lib/regenerator/i18n/detector.ts` runs at the start of every regeneration job:

1. Read `<html lang="...">` if present (most reliable signal).
2. Run `franc-min` over the longest text content from the homepage (statistical detection).
3. Detect script via Unicode block analysis (Bengali, Devanagari, Arabic, Han, Hiragana, etc.).
4. Detect direction via `rtl-detect` (Arabic, Hebrew, Persian, Urdu → RTL; default LTR).

If `<html lang>` and franc disagree with high confidence on either, surface a confirmation step in the UI: "We detected this site is in [X]. Is that correct?"

Output:

```ts
interface DetectedLanguage {
  language: string;        // ISO 639-1: 'bn', 'fr', 'ja', 'ar', etc.
  script: string;          // ISO 15924: 'Beng', 'Latn', 'Arab', etc.
  direction: 'ltr' | 'rtl';
  confidence: number;      // 0..1
  needsConfirmation: boolean;
}
```

### 8.6.3 Translation Modes

User picks one when configuring regeneration:

| Mode | What it does | When to use |
|---|---|---|
| `none` | No translation — regenerate in source language. | Default. AI fixes only. |
| `literal` | Word-for-word translation, preserving sentence structure. | Legal text, menus where exact meaning matters. |
| `transcreate` | Idiomatic rewrite for target audience — preserves meaning + voice but reads natively. | Marketing copy, hero text, descriptions. **Recommended default when translating.** |
| `bilingual` | Output BOTH source and target as separate locales with `hreflang` linking. Source stays at `/`, target at `/en/` (or chosen path). | When user wants to keep original audience while expanding to new one. **Best for SEO + AI ranking.** |

`bilingual` is the strongest option for AI/SEO and should be highlighted as recommended in the UI.

### 8.6.4 Text Classification (the trick)

Before translation, every text node in the rendered HTML is classified by `lib/regenerator/i18n/classifier.ts`:

```ts
type Classification =
  | 'preserve'      // keep verbatim — numbers, emails, addresses, URLs
  | 'preserve-pn'   // proper noun — keep unless user added to translatable list
  | 'literal'       // translate word-for-word — schema values, labels
  | 'transcreate'   // idiomatic rewrite — marketing copy, headings
  | 'flag-legal';   // potentially legal/medical/allergy — translate AND flag
```

Classification rules (in order):

1. Regex match for phone / email / URL / price / date → `preserve`.
2. Inside `<address>`, `[itemtype*="PostalAddress"]`, schema street fields → `preserve`.
3. Matches the auto-built glossary (business name + extracted proper nouns) → `preserve-pn`.
4. Inside `<button>`, `<label>`, nav `<a>`, schema `name`/`title` → `literal`.
5. Contains keywords "allergy/allergen/contains/gluten/nut", "warranty/disclaimer/liability", "medical/diagnosis/treatment", "interest rate/APR/return guaranteed" → `flag-legal`.
6. Inside `<h1>`–`<h3>`, `<p>` over 60 chars, `<meta description>`, hero sections → `transcreate`.
7. Default → `literal`.

### 8.6.5 The Glossary Editor

After classification, the UI shows the user a **glossary review step** before translation runs:

- Auto-extracted proper nouns from schema + repeated terms (business name, dish names, place names).
- Each row has: source term, suggested handling (`preserve` / `transliterate` / `translate`), editable target value.
- Common patterns:
  - Business name "ক্যাফে দার্জিলিং" → preserve as `ক্যাফে দার্জিলিং`, OR transliterate to `Cafe Darjeeling`, OR translate to `Darjeeling Cafe`. User picks.
  - Dish name "shorshe ilish" → preserve, optional inline gloss "(hilsa fish in mustard sauce)".
- The chosen glossary is applied consistently across every page in the regeneration job.

### 8.6.6 Translation Pipeline

Per page, in order:

1. **Extract** all text nodes from the page DOM (cheerio walk). Skip `<script>`, `<style>`, `<code>`, `<pre>`.
2. **Classify** each text node (above).
3. **Apply glossary** — replace `preserve-pn` terms with locked equivalents up front.
4. **Hash + cache lookup** — if any string was translated in this job before, reuse from `translation_cache`. Massive cost saving (navbars, footers repeat across every page).
5. **Batch** unique uncached strings by classification (`literal` and `transcreate` go to different prompts). Batch size ~30 strings per Claude call.
6. **Call Claude** with one of these prompt templates:
   - **Literal prompt** (constrained):
     > Translate the following strings from {source} to {target}. Preserve any tokens wrapped in `[[KEEP:...]]` exactly. Output JSON: array of `{id, translation}`. Do NOT add commentary, explanations, or alternatives.
   - **Transcreate prompt** (richer):
     > You are localizing copy from {source} to {target} for a {industry} business. Rewrite each string to read naturally to a native {target} speaker while preserving the meaning, tone, and any factual claims. Do not invent facts not in the source. Preserve `[[KEEP:...]]` tokens. Output JSON.
   - **Flag-legal prompt:**
     > Translate literally from {source} to {target}. Preserve numbers and named entities. Do NOT smooth or summarize. Output JSON. These strings will be flagged for mandatory human review.
7. **Validate** every translation:
   - Numbers in source must appear in target (preservation check).
   - Email/URL tokens must round-trip exactly.
   - Length expansion ratio recorded for the layout overflow check.
8. **Replace** text nodes in the DOM (preserving all classes, IDs, data attributes).
9. **Update `<html lang>`, `<html dir>`** to target.
10. **Swap fonts** if needed (next section).

### 8.6.7 Font Mapping (Critical for Visual Fidelity)

`lib/regenerator/i18n/font-mapper.ts` handles the case where the source font doesn't support the target script.

Strategy:

1. Parse all `font-family` declarations in linked CSS.
2. For each, infer the "tone" (serif / sans-serif / display / monospace) and "weight range" available.
3. Pick a target-script-supporting font with matching tone from a curated map. Examples:
   - Bangla site using `'Noto Sans Bengali'` + English target → keep `'Noto Sans Bengali'` for any preserved Bangla terms, add `'Inter'` or `'Source Sans 3'` as primary for English.
   - Arabic site using `'Tajawal'` + English target → swap to `'IBM Plex Sans'` (matching geometric tone).
   - Japanese site using `'Noto Sans JP'` + English target → swap to `'Noto Sans'` (same family, Latin variant).
4. Inject a CSS rule defining `font-family` cascading: target font first, then original as fallback for any preserved source-script terms.
5. Add `@font-face` imports to `<head>` from Google Fonts.

The user can override the suggested font in the UI before regeneration runs.

### 8.6.8 RTL → LTR (and vice versa) Handling

`lib/regenerator/i18n/direction-handler.ts`:

1. If source `dir="rtl"` and target is LTR (or vice versa):
   - Set `<html dir="ltr">` (or `rtl`).
   - Scan inline styles + linked CSS for **physical** properties (`margin-left`, `padding-right`, `text-align: left/right`, `float: left/right`).
   - Rewrite to **logical** properties (`margin-inline-start`, `padding-inline-end`, `text-align: start/end`, `float: inline-start`). These flip automatically with `dir`.
   - Where rewriting isn't safe (e.g., complex selectors targeting direction-specific behavior), inject a `[dir="ltr"] { ... }` override block.
2. Flag any `transform`, `background-position`, or absolute-positioned elements for manual review — these don't flip cleanly.
3. Mirror specific icons that have directional meaning (arrows, back/forward) by detecting `<svg>` elements with directional class names.

This is the trickiest part of the regenerator. Be conservative — when uncertain, leave the original CSS in place and note the issue in the diff viewer.

### 8.6.9 Layout Overflow Detection

`lib/regenerator/i18n/expansion-checker.ts`:

After translation, before bundling, render the regenerated page in headless Playwright at three viewports (mobile 390px, tablet 768px, desktop 1280px) and:

1. Detect text overflow: any element where `scrollWidth > clientWidth` or `scrollHeight > clientHeight` and contains translated text.
2. Detect text truncation: any element with `text-overflow: ellipsis` whose full text is now hidden.
3. Detect button/nav text wrapping where it didn't before.

Each detected issue becomes a warning in the regen UI: "On `/menu`, the heading 'Notre Menu Saisonnier Recommandé' may overflow on mobile (translated from 'মৌসুমী মেনু')." User can choose: leave as-is / shorten (Claude rewrites with length constraint) / open in editor for manual fix.

### 8.6.10 Multilingual Output (`bilingual` mode)

When the user picks `bilingual`:

1. Original site → output at `/` (untouched except for AI fixes — schema, llms.txt, etc.).
2. Translated site → output at `/{targetLang}/` (e.g., `/en/`).
3. Every page in both versions gets `<link rel="alternate" hreflang="...">` tags pointing to the other.
4. Add `hreflang="x-default"` pointing to source.
5. Schema.org `inLanguage` set on each page.
6. `sitemap.xml` includes both versions with `<xhtml:link>` annotations.
7. `llms.txt` lists both versions clearly so AI agents know the site is multilingual.
8. Add a discreet language switcher to header (only if one doesn't exist already — detect first).

This is the recommended path for SEO and AI visibility — never replace, always add.

### 8.6.11 UI Flow Additions

In the regeneration setup wizard, after Strategy selection:

**Step 2.5 — Language & Localization:**

Top of panel:
> Detected: **Bangla** (script: Bengali, direction: LTR)
> *We detected your site is in Bangla. Confirm or correct?* [Bangla ✓] [Change…]

Then a toggle:
> ☐ **Translate to a different language** (default: keep original)

When toggled on, expand:

- Target language picker (default `English`, full ISO list available)
- Translation mode picker (default `Transcreate`, with `Bilingual` highlighted as "Recommended for AI visibility")
- Font preview: shows side-by-side how a sample heading will look in source font vs swapped font
- Glossary preview: top 10 auto-detected proper nouns with editable handling
- "Review full glossary" button → opens full editor sheet

After completion of Step 3 (Review Fixes), a final translation review panel:

- Sample of 5 transcreated strings (source → target) so user can sanity-check tone before the full job runs
- "Looks good — start regeneration" button

### 8.6.12 Cost Implications

Translation roughly doubles the Claude API spend per page. Update cost estimates in the strategy picker:

| Strategy | No translation | With translation |
|---|---|---|
| Static Surgery | ~$0.20–0.50 | ~$0.50–1.50 |
| Next.js Project | ~$2–5 | ~$4–10 |

Cap is enforced by `MAX_REGEN_TOKENS` regardless.

### 8.6.13 Acceptance Criteria for Multi-Language (added to §16)

1. Auto-detected source language matches `<html lang>` for tested sites; falls back to franc-min when missing.
2. Bangla → English regeneration of a sample restaurant site produces a downloadable zip where:
    - Phone numbers, prices, addresses are byte-identical to source.
    - Business name handling matches the user's glossary choice.
    - `<html lang="en">` and target font are swapped.
    - Schema.org `inLanguage: "en"` is set.
3. RTL → LTR regeneration of a sample Arabic site flips layout direction without visual breakage at all three tested viewports, OR surfaces clear warnings for sections it can't auto-flip.
4. `bilingual` mode produces a zip with both `/` and `/en/` subtrees, valid `hreflang` linking, and a working language switcher in the header.
5. Layout-overflow checker catches at least one synthetic overflow case (test fixture: a card with fixed width and a deliberately long German translation).
6. The mandatory human-review banner appears on the download page and cannot be dismissed without checking the confirmation box.

---

## 9. UI / UX Requirements

### Aesthetic direction

Editorial / data-magazine. Think: Stripe Press meets Vercel dashboard. Light theme default, dark theme toggle. **Avoid generic AI-slop look** — no purple gradients on white. Pick a real type system:

- **Display font:** `Fraunces` or `Instrument Serif` (Google Fonts) for headings.
- **Body font:** `Inter Tight` or `Geist` for UI.
- **Mono:** `JetBrains Mono` for code blocks.

Color palette: warm off-white background (`#FAF8F4`), deep ink text (`#1A1A1A`), single accent (deep red `#C8102E` or forest `#1B5E20`). Status colors: green `#2E7D32`, amber `#ED6C02`, red `#C62828`.

### Pages to build

#### `/` — Landing

- Bold headline: "See your website through an AI's eyes."
- Single URL input, industry selector (with "auto-detect" default), "Run Audit" CTA.
- Below the fold: how it works, what we check (animated icons), sample report screenshot.

#### `/audit/[auditId]` — Loading state

Live SSE stream. Show:

- Crawl progress bar (X of Y pages discovered).
- Currently analyzing: `https://...`
- Live ticker of completed checks ("✓ Schema markup parsed", "⚠ llms.txt missing").
- Estimated time remaining.

#### `/audit/[auditId]` — Completed report

- **Hero:** Big radial gauge with overall score + letter grade. Site URL, industry detected, audit timestamp.
- **Quick Results panel** (replicate the user's screenshot exactly): rows with status icon, check name, short description, score `X/Y`. Click row → expand evidence + fix.
- **Category breakdown:** bar chart showing each category's score.
- **Pages table:** sortable list of all crawled pages with their individual scores. Click → per-page report.
- **Top recommendations:** ranked list of the 5 highest-impact fixes site-wide. Each has "Generate detailed fix with AI" button → calls `/api/recommend`.
- **Export PDF** button (top-right).

#### `/audit/[auditId]/pages/[pageId]` — Per-page

- Same layout as site report but scoped to one page.
- Show **raw HTML vs rendered HTML preview** side-by-side (truncated) when `js-vs-raw` flags issues.
- Inline code snippets for fixes (copy button).

### Components

Use shadcn/ui for: Button, Input, Select, Card, Tabs, Dialog, Tooltip, Progress, Badge, Accordion, Sheet. Customize the theme tokens to match the palette above — don't ship default shadcn colors.

### Animation

Use `motion` for:

- Staggered reveal of check results on report load.
- Score gauge animating from 0 → final value on mount.
- Smooth accordion expansions for evidence.

### Accessibility

- All interactive elements keyboard-navigable.
- ARIA labels on icons.
- Color is never the sole indicator of status (always paired with icon + text).
- Lighthouse a11y score ≥ 95.

---

## 10. API Design

| Route | Method | Body / Params | Returns |
|---|---|---|---|
| `/api/audit/start` | POST | `{ url, industry?, maxPages? }` | `{ auditId }` |
| `/api/audit/[id]/status` | GET (SSE) | — | stream of `CrawlEvent` |
| `/api/audit/[id]` | GET | — | full audit JSON |
| `/api/audit/[id]/export` | GET | `?format=pdf` | PDF binary |
| `/api/recommend` | POST | `{ checkResultId, type }` | streamed text (SSE) |

All routes validated with Zod. All error responses follow `{ error: string, code: string }` shape.

---

## 11. Background Job Execution

Since we're not using a separate Python backend, the audit runs in a Next.js Route Handler:

- `/api/audit/start` inserts a row, kicks off `runAudit(auditId)` **without awaiting** it (fire-and-forget), returns immediately.
- `runAudit` is a top-level async function in `lib/jobs/audit-runner.ts`. It writes progress to the DB as it goes.
- `/api/audit/[id]/status` is an SSE endpoint that polls the DB every 500ms and pushes diffs to the client.
- For production, document in README that this should be moved to a proper job queue (BullMQ + Redis) — but for v1, in-process is fine.

**Important:** Set `export const maxDuration = 300;` on the route handler so Vercel/serverless doesn't time out (5 min cap on most plans). Document self-hosting recommendation.

---

## 12. Environment Variables

```
ANTHROPIC_API_KEY=sk-ant-...
DATABASE_URL=file:./dev.db   # SQLite for dev
PLAYWRIGHT_BROWSERS_PATH=./.playwright-browsers
NEXT_PUBLIC_APP_URL=http://localhost:3000
MAX_PAGES_PER_AUDIT=50
ENABLE_LLM_RECOMMENDATIONS=true

# Regeneration feature
ENABLE_REGENERATION=true
VERIFICATION_SECRET=<random-32-byte-hex>     # for HMAC-signed tokens
MAX_REGEN_PAGES=50
MAX_REGEN_TOKENS=500000                      # cap Claude spend per job
REGEN_RATE_LIMIT_PER_DOMAIN_PER_DAY=3
REGEN_OUTPUT_DIR=./regen-outputs             # where zips are stored

# Multi-language regeneration
ENABLE_TRANSLATION=true
DEFAULT_TARGET_LANGUAGE=en
MAX_TRANSLATION_TOKENS_PER_JOB=300000        # additional cap on top of MAX_REGEN_TOKENS
```

Provide `.env.example`.

---

## 13. Setup & Run Commands

```bash
pnpm install
pnpm exec playwright install chromium --with-deps
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
pnpm dev      # http://localhost:3000
```

Production:

```bash
pnpm build
pnpm start
```

Tests:

```bash
pnpm test          # vitest unit tests for analyzers
pnpm test:e2e      # playwright tests for the UI
```

---

## 14. Testing Requirements

- **Unit tests (Vitest):** every analyzer in `lib/analyzers/` must have a test with at least 3 fixtures: `pass`, `warn`, `fail`. Fixtures live in `tests/fixtures/<analyzer>/`.
- **Integration test:** run a full audit against a known good site (e.g., `https://stripe.com`) and a known weak site (a blank single-page demo we'll spin up locally) — assert scores fall in expected ranges.
- **E2E (Playwright):** submit URL → wait for completion → assert report renders → click into a page report → assert recommendations panel works.

---

## 15. README Content

Generate a `README.md` covering:

- What this project is + a screenshot of the report.
- The full list of checks (auto-generated from the analyzers registry).
- Setup instructions (above).
- Architecture diagram (Mermaid).
- How to add a new analyzer (point at `BaseAnalyzer` interface).
- Deployment notes — call out Playwright on serverless caveats and recommend Fly.io / Railway / a VPS for self-hosting.
- License: MIT.

---

## 16. Acceptance Criteria — All of These Must Pass

1. `pnpm dev` boots cleanly on a fresh clone.
2. Submitting `https://example.com` produces a completed audit report with all analyzers run.
3. Submitting a deliberately broken site (no robots.txt, no schema, JS-only content) produces failures across the appropriate categories with non-zero scores where partial credit applies.
4. Per-page drill-down works for every crawled page.
5. PDF export downloads a multi-page document with the same content as the web report.
6. "Generate fix with AI" button streams a Claude response inline.
7. Lighthouse score (the audit tool's own UI): Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95.
8. All TypeScript is strict-mode clean; `pnpm build` produces zero warnings.
9. No `any` types except where unavoidable (with a comment explaining why).
10. Industry-specific recommendations actually differ — restaurant audit must surface Menu/OpeningHours suggestions; travel must surface TouristAttraction/Trip; service must surface Service/LocalBusiness.

---

## 17. Stretch Goals (implement if time permits)

- **AI Visibility Test:** for the audited site, call Claude/GPT with prompts like "best [industry] in [detected location]" and check whether the site appears in the response. Track over time.
- **Diff mode:** re-audit a site and show what changed since last audit (improved/regressed checks).
- **Public share links:** unguessable URL to share a report read-only.
- **Watchlist:** schedule weekly re-audits for a given URL, email summary on score change.

---

## 18. What NOT to Do

- ❌ Do not introduce a separate Python service.
- ❌ Do not use Pages Router — App Router only.
- ❌ Do not use generic shadcn defaults visually — customize the design tokens.
- ❌ Do not use Inter as the body font — pick something with character per the design direction.
- ❌ Do not skip the `js-vs-raw` analyzer; it's a key differentiator.
- ❌ Do not log any user URLs or audit content to third parties.
- ❌ Do not call the Anthropic API client-side; route through `/api/recommend` only.
- ❌ **Do not allow regeneration without verified domain ownership, ever.** No "skip verification" flag, no admin bypass, no env var override. Verification is the legal/ethical guardrail and must be unconditional.
- ❌ Do not use the words "v0" or "Lovable" in any user-facing copy. Internally we use Claude API only.
- ❌ Do not auto-deploy regenerated sites anywhere — only let the user download or click a deploy button themselves.
- ❌ Do not store regenerated bundles longer than 7 days; document the cleanup cron in the README.
- ❌ Do not translate any string classified as `preserve` (numbers, addresses, emails, URLs, glossary terms) — preserve verbatim. A failed preservation check is a regeneration job failure, not a warning.
- ❌ Do not let the translator invent facts. The spec's translation prompts must explicitly forbid adding details not in the source. If unsure, preserve ambiguity.
- ❌ Do not allow downloading a translated bundle without the user checking the human-review confirmation box — this is non-negotiable.
- ❌ Do not auto-translate `flag-legal` content silently. Flag visibly and require explicit user acknowledgment before bundling.

---

## 19. Final Output Expectations

When done, the working tree should contain a fully wired application that:

- Boots, crawls, analyzes, scores, reports, recommends.
- Looks designed, not generic.
- Has tests that pass.
- Has documentation that explains itself.

Build it all. Ship it.
