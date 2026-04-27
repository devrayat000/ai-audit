"use client";

import { useState } from "react";
import type { AuditReport, CheckResult } from "@/lib/types";
import { StatusIcon } from "./status-icon";
import { ChevronDown, Sparkles } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { CodeSnippet } from "./code-snippet";
import { cn } from "@/lib/utils";

interface Props {
  check: CheckResult;
  report: AuditReport;
}

interface RuleRec {
  type: string;
  title: string;
  body: string;
  language?: string;
}

export function CheckResultRow({ check, report }: Props) {
  const [open, setOpen] = useState(false);
  const [ruleRecs, setRuleRecs] = useState<RuleRec[] | null>(null);
  const [llmText, setLlmText] = useState<string>("");
  const [llmBusy, setLlmBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRule = async () => {
    if (ruleRecs) return;
    try {
      const r = await fetch("/api/recommend/rule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          industry: report.industry,
          rootUrl: report.rootUrl,
          domain: report.domain,
          check,
        }),
      });
      const j = await r.json();
      setRuleRecs(j.recommendations ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load fixes.");
    }
  };

  const fetchLlm = async () => {
    setLlmBusy(true);
    setLlmText("");
    setError(null);
    try {
      const page = report.pages.find((p) => p.url === check.pageUrl);
      const titleCheck = page?.checks.find((c) => c.analyzerKey === "meta-tags");
      const ev = (titleCheck?.evidence ?? {}) as Record<string, unknown>;
      const r = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          industry: report.industry,
          pageUrl: check.pageUrl,
          pageTitle: typeof ev.title === "string" ? ev.title : undefined,
          pageDescription: typeof ev.description === "string" ? ev.description : undefined,
          pageTextSnippet: undefined,
          check: {
            analyzerKey: check.analyzerKey,
            category: check.category,
            name: check.name,
            status: check.status,
            message: check.message,
            evidence: check.evidence,
            fixSuggestion: check.fixSuggestion,
          },
        }),
      });
      if (!r.ok || !r.body) {
        const j = await r.json().catch(() => ({}));
        setError(j.error ?? `Request failed: ${r.status}`);
        setLlmBusy(false);
        return;
      }
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setLlmText((s) => s + dec.decode(value, { stream: true }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Streaming failed.");
    } finally {
      setLlmBusy(false);
    }
  };

  const expand = () => {
    setOpen(!open);
    if (!open) fetchRule();
  };

  const evidenceJson = JSON.stringify(check.evidence, null, 2);

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={expand}
        className={cn(
          "flex w-full items-center gap-3 py-3 px-4 text-left hover:bg-muted/40 transition-colors",
          open && "bg-muted/30"
        )}
        aria-expanded={open}
      >
        <StatusIcon status={check.status} className="size-5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{check.name}</span>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
              {check.category}
            </Badge>
            {check.scope === "page" && check.pageUrl && (
              <span className="text-xs text-muted-foreground truncate">
                {new URL(check.pageUrl).pathname || "/"}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 truncate">
            {check.shortDescription}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-mono text-sm tabular-nums">
            <span className={cn(
              check.status === "pass" && "text-[color:var(--success)]",
              check.status === "warn" && "text-[color:var(--warning)]",
              check.status === "fail" && "text-[color:var(--danger)]"
            )}>
              {check.score}
            </span>
            <span className="text-muted-foreground">/{check.maxScore}</span>
          </div>
        </div>
        <ChevronDown
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 space-y-4 bg-muted/20">
          <div>
            <div className="text-xs font-mono uppercase text-muted-foreground mb-1">Finding</div>
            <p className="text-sm">{check.message}</p>
          </div>
          <div>
            <div className="text-xs font-mono uppercase text-muted-foreground mb-1">Suggested fix</div>
            <p className="text-sm">{check.fixSuggestion}</p>
          </div>

          {ruleRecs && ruleRecs.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-mono uppercase text-muted-foreground">Templates</div>
              {ruleRecs.map((r, i) => (
                <CodeSnippet key={i} title={r.title} code={r.body} language={r.language} />
              ))}
            </div>
          )}

          {check.llmFixAvailable && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" variant="outline" onClick={fetchLlm} disabled={llmBusy}>
                  <Sparkles className="size-3.5" />
                  {llmBusy ? "Generating…" : "Generate fix with AI"}
                </Button>
              </div>
              {llmText && (
                <div className="rounded-lg border border-border bg-card p-3 text-sm whitespace-pre-wrap font-mono leading-relaxed">
                  {llmText}
                </div>
              )}
            </div>
          )}

          {error && <div className="text-xs text-[color:var(--danger)]">{error}</div>}

          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer hover:text-foreground">Evidence (raw)</summary>
            <pre className="mt-2 p-3 rounded-md border border-border bg-[color:var(--paper)] font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">
              {evidenceJson}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
