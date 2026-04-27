"use client";

import { useState } from "react";
import type { AuditReport, Industry } from "@/lib/types";
import { AuditForm } from "./audit-form";
import { AuditLoading } from "./audit-loading";
import { AuditReportView } from "./audit-report";
import { Button } from "./ui/button";
import { ArrowLeft, Bot, FileSearch, Gauge, Sparkles } from "lucide-react";

type Phase = { name: "idle" } | { name: "loading"; url: string } | { name: "done"; report: AuditReport } | { name: "error"; message: string };

export function LandingContent() {
  const [phase, setPhase] = useState<Phase>({ name: "idle" });

  const start = async ({ url, industry }: { url: string; industry?: Industry }) => {
    setPhase({ name: "loading", url });
    try {
      const r = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, industry }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setPhase({ name: "error", message: j.error ?? `Audit failed: ${r.status}` });
        return;
      }
      const report = (await r.json()) as AuditReport;
      setPhase({ name: "done", report });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setPhase({ name: "error", message: e instanceof Error ? e.message : "Network error." });
    }
  };

  if (phase.name === "loading") {
    return (
      <div className="max-w-4xl mx-auto w-full px-6 py-16">
        <AuditLoading url={phase.url} />
      </div>
    );
  }

  if (phase.name === "done") {
    return (
      <div className="max-w-6xl mx-auto w-full px-6 py-10">
        <div className="mb-6 flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setPhase({ name: "idle" })}>
            <ArrowLeft className="size-4" />
            New audit
          </Button>
        </div>
        <AuditReportView report={phase.report} />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <section className="px-6 pt-20 pb-16 md:pt-32 md:pb-24">
        <div className="max-w-4xl mx-auto flex flex-col items-start gap-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-card text-xs font-mono uppercase tracking-widest text-muted-foreground">
            <span className="size-1.5 rounded-full bg-[color:var(--accent-brand)] animate-pulse" />
            Generative Engine Optimization
          </div>
          <h1 className="font-serif text-5xl md:text-7xl leading-[0.95] tracking-tight">
            See your website
            <br />
            through an{" "}
            <span className="italic text-[color:var(--accent-brand)]">AI's</span>{" "}
            eyes.
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground leading-relaxed">
            We audit any URL for AI / LLM compatibility, fetch with Claude, GPT,
            Perplexity, and Gemini bot user-agents, and produce per-page reports with
            actionable, industry-specific fixes.
          </p>
          <div className="w-full max-w-2xl mt-2">
            <AuditForm onSubmit={start} />
            {phase.name === "error" && (
              <div className="mt-3 text-sm text-[color:var(--danger)]">{phase.message}</div>
            )}
          </div>
        </div>
      </section>

      <section className="px-6 py-16 border-t border-border bg-card/40">
        <div className="max-w-5xl mx-auto">
          <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-6">
            How it works
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            <Step
              icon={<Bot className="size-5" />}
              title="Crawl"
              body="Fetch with both human and AI bot UAs. Compare what each sees."
            />
            <Step
              icon={<FileSearch className="size-5" />}
              title="Analyze"
              body="Parse JSON-LD, headings, meta, robots, llms.txt, JS-rendering gap."
            />
            <Step
              icon={<Gauge className="size-5" />}
              title="Score"
              body="Weighted by category. Page-level + site-wide. Letter grade A+ → F."
            />
            <Step
              icon={<Sparkles className="size-5" />}
              title="Fix"
              body="Industry-specific JSON-LD templates plus on-demand AI rewrites."
            />
          </div>
        </div>
      </section>

      <section className="px-6 py-16 border-t border-border">
        <div className="max-w-5xl mx-auto">
          <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-6">
            What we check
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
            {CHECK_LIST.map((c) => (
              <div
                key={c.title}
                className="rounded-lg border border-border bg-card p-4 hover:border-foreground/30 transition-colors"
              >
                <div className="font-medium">{c.title}</div>
                <div className="text-xs text-muted-foreground mt-1">{c.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="px-6 py-10 border-t border-border text-xs text-muted-foreground">
        <div className="max-w-5xl mx-auto flex justify-between flex-wrap gap-2">
          <div className="font-mono">AI Audit · Generative Engine Optimization tool</div>
          <div>Powered by Claude · MIT licensed</div>
        </div>
      </footer>
    </div>
  );
}

function Step({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="size-9 rounded-md bg-foreground text-background flex items-center justify-center">
        {icon}
      </div>
      <div className="font-medium">{title}</div>
      <div className="text-sm text-muted-foreground leading-relaxed">{body}</div>
    </div>
  );
}

const CHECK_LIST = [
  { title: "AI Bot Access", body: "robots.txt + live fetch with GPTBot, ClaudeBot, PerplexityBot, Google-Extended, etc." },
  { title: "llms.txt", body: "/llms.txt + /llms-full.txt presence and structure." },
  { title: "Schema Markup", body: "Industry-aware JSON-LD: Restaurant, Travel, LocalBusiness, Product, Article." },
  { title: "JS vs Raw HTML", body: "Compare what AI bots see (no JS) to the rendered DOM." },
  { title: "Meta Tags", body: "Title, description, OG, Twitter, canonical." },
  { title: "Content Structure", body: "Headings, lists, FAQ, paragraph length." },
  { title: "Readability", body: "Flesch reading ease, sentence length." },
  { title: "Semantic HTML", body: "main, article, section, nav, header, footer." },
  { title: "E-E-A-T", body: "Author, About, Contact, citations, dates." },
  { title: "Image Alt Text", body: "Coverage and quality. Penalize 'image', 'photo', filenames." },
  { title: "Internal Linking", body: "Descriptive anchors, internal link graph health." },
  { title: "HTTPS & Security", body: "Cert, HSTS, mixed content." },
  { title: "Canonical Domain", body: "www vs apex; HTTP→HTTPS redirects." },
  { title: "Performance", body: "Page weight, blocking resources, load time." },
  { title: "Freshness", body: "datePublished / dateModified signals." },
  { title: "AI Content Patterns", body: "Direct-answer leads, fact density, named entities." },
  { title: "Mobile Viewport", body: "Responsive meta viewport." },
  { title: "Language", body: "html[lang]." },
];
