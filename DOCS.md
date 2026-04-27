# AI Audit Analyzer — Build Spec for Claude Code

> **Mission:** Build a complete, production-ready Next.js 16 web application that audits any website for AI / LLM compatibility (GEO — Generative Engine Optimization), produces per-page and site-wide reports, and delivers actionable, industry-specific recommendations.

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
│   │   │   └── pages/
│   │   │       └── [pageId]/page.tsx     # Per-page report
│   │   └── new/route.ts                  # POST starts an audit
│   ├── api/
│   │   ├── audit/
│   │   │   ├── start/route.ts            # POST: kick off audit
│   │   │   ├── [auditId]/status/route.ts # GET: SSE stream of progress
│   │   │   ├── [auditId]/route.ts        # GET: full results JSON
│   │   │   └── [auditId]/export/route.ts # GET: PDF export
│   │   └── recommend/route.ts            # POST: LLM-generated fix for a finding
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
│   └── pdf-report.tsx
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

---

## 19. Final Output Expectations

When done, the working tree should contain a fully wired application that:
- Boots, crawls, analyzes, scores, reports, recommends.
- Looks designed, not generic.
- Has tests that pass.
- Has documentation that explains itself.

Build it all. Ship it.