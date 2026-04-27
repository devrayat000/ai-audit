"use client";

import { useMemo, useState } from "react";
import type { AuditReport } from "@/lib/types";
import type {
  GlossaryEntry,
  RegenStrategy,
  TranslationConfig,
} from "@/lib/regenerator/types";
import { VerificationFlow } from "./verification-flow";
import type { VerifiedState } from "./verification-flow";
import { RegenerateStrategyPicker } from "./regenerate-strategy-picker";
import { LanguagePicker } from "./language-picker";
import { GlossaryEditor } from "./glossary-editor";
import { FixesChecklist } from "./fixes-checklist";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Loader2, Rocket, Sparkles, X } from "lucide-react";
import { SideBySidePreview } from "./side-by-side-preview";
import { DiffViewer } from "./diff-viewer";
import { TranslationWarningsView } from "./translation-warnings";
import { DeployButtons } from "./deploy-buttons";
import { getDomain, normalizeUrl } from "@/lib/utils/url";

interface Props {
  report: AuditReport;
  open: boolean;
  onClose: () => void;
}

interface RegenResponse {
  strategy: RegenStrategy;
  rootUrl: string;
  domain: string;
  fixesApplied: string[];
  pageDiffs: Array<{ url: string; changes: { type: "added" | "removed" | "context"; line: string }[]; beforeLines: number; afterLines: number }>;
  homepagePreview: string;
  translationWarnings: import("@/lib/regenerator/types").TranslationWarning[];
  zipBase64: string;
  durationMs: number;
  notes: string[];
}

export function RegenerateWizard({ report, open, onClose }: Props) {
  const domain = useMemo(() => getDomain(report.rootUrl).replace(/^www\./, ""), [report.rootUrl]);
  const rootUrl = useMemo(() => normalizeUrl(report.rootUrl), [report.rootUrl]);

  const [verified, setVerified] = useState<VerifiedState | null>(null);
  const [strategy, setStrategy] = useState<RegenStrategy>("static-surgery");
  const [translateEnabled, setTranslateEnabled] = useState(false);
  const [translation, setTranslation] = useState<TranslationConfig | null>(null);
  const [glossaryOverride, setGlossaryOverride] = useState<GlossaryEntry[] | null>(null);
  const [fixes, setFixes] = useState<{ analyzerKey: string; enabled: boolean }[]>(
    () => {
      const all = [
        ...report.siteChecks,
        ...report.pages.flatMap((p) => p.checks),
      ];
      const keys = Array.from(new Set(all.filter((c) => c.status !== "pass").map((c) => c.analyzerKey)));
      return keys.map((k) => ({ analyzerKey: k, enabled: true }));
    }
  );
  const [humanAck, setHumanAck] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RegenResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const finalGlossary = glossaryOverride ?? translation?.glossary ?? [];
  const translationCfg: TranslationConfig | null = translation
    ? { ...translation, glossary: finalGlossary }
    : null;

  const canRun =
    !!verified &&
    fixes.some((f) => f.enabled) &&
    (!translateEnabled || (translationCfg && (translationCfg.mode === "literal" || translationCfg.mode === "transcreate" || translationCfg.mode === "bilingual"))) &&
    !running;

  const start = async () => {
    if (!verified) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const r = await fetch("/api/regenerate/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rootUrl,
          industry: report.industry,
          strategy,
          proof: verified.proof,
          fixes,
          translation: translateEnabled && translationCfg
            ? {
                ...translationCfg,
                humanReviewAcknowledged: humanAck,
                glossary: finalGlossary,
              }
            : undefined,
          inlineAssets: false,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error ?? `Regeneration failed (${r.status})`);
      } else {
        setResult(j as RegenResponse);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Regenerator</div>
            <h2 className="font-serif text-3xl">AI-optimized clone of your site</h2>
            <p className="text-sm text-muted-foreground mt-1">
              We preserve your design and inject every fix the audit flagged.{" "}
              <span className="text-foreground">Domain ownership verification is mandatory.</span>
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="size-5" />
          </Button>
        </div>

        {!result && (
          <div className="space-y-5">
            <VerificationFlow
              domain={domain}
              rootUrl={rootUrl}
              onVerified={(v) => setVerified(v)}
            />

            {verified && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Choose strategy</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <RegenerateStrategyPicker
                      report={report}
                      value={strategy}
                      onChange={setStrategy}
                    />
                  </CardContent>
                </Card>

                <LanguagePicker
                  rootUrl={rootUrl}
                  industry={report.industry}
                  enabled={translateEnabled}
                  onEnabledChange={(v) => {
                    setTranslateEnabled(v);
                    if (!v) {
                      setTranslation(null);
                      setHumanAck(false);
                    }
                  }}
                  config={translation}
                  onConfigChange={setTranslation}
                />

                {translateEnabled && translation && (
                  <GlossaryEditor
                    rootUrl={rootUrl}
                    enabled={translateEnabled}
                    glossary={glossaryOverride ?? translation.glossary}
                    onChange={setGlossaryOverride}
                  />
                )}

                <FixesChecklist report={report} fixes={fixes} onChange={setFixes} />

                {translateEnabled && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Sparkles className="size-5" />
                        Human review confirmation
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <label className="flex items-start gap-2 cursor-pointer text-sm">
                        <Checkbox
                          checked={humanAck}
                          onCheckedChange={setHumanAck}
                          className="mt-0.5"
                        />
                        <span>
                          I acknowledge that translated content has not been reviewed by a human translator.
                          I will review the output — especially menu items, allergy info, legal text, and pricing —
                          before publishing.
                        </span>
                      </label>
                    </CardContent>
                  </Card>
                )}

                <div className="flex items-center justify-end gap-3">
                  {error && <p className="text-sm text-[color:var(--danger)]">{error}</p>}
                  <Button
                    type="button"
                    size="lg"
                    onClick={start}
                    disabled={!canRun || (translateEnabled && !humanAck)}
                  >
                    {running ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
                    {running ? "Regenerating…" : "Start regeneration"}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {result && (
          <ResultView
            result={result}
            originalUrl={rootUrl}
            translateEnabled={translateEnabled}
            humanAck={humanAck}
            onHumanAck={setHumanAck}
            onReset={() => {
              setResult(null);
              setHumanAck(false);
            }}
            domain={domain}
          />
        )}
      </div>
    </div>
  );
}

function ResultView({
  result,
  originalUrl,
  translateEnabled,
  humanAck,
  onHumanAck,
  onReset,
  domain,
}: {
  result: RegenResponse;
  originalUrl: string;
  translateEnabled: boolean;
  humanAck: boolean;
  onHumanAck: (v: boolean) => void;
  onReset: () => void;
  domain: string;
}) {
  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Regenerated in {(result.durationMs / 1000).toFixed(1)}s</div>
            <div className="font-serif text-2xl mt-1">Ready to download</div>
            <div className="text-sm text-muted-foreground mt-1">
              {result.fixesApplied.length} fix(es) applied · {result.pageDiffs.length} page(s) processed
              {result.translationWarnings.length > 0 && ` · ${result.translationWarnings.length} translation warning(s)`}
            </div>
          </div>
          <Button variant="outline" onClick={onReset}>Configure another run</Button>
        </CardContent>
      </Card>

      {translateEnabled && (
        <Card>
          <CardContent className="p-5 flex items-start gap-3">
            <label className="flex items-start gap-2 cursor-pointer text-sm">
              <Checkbox checked={humanAck} onCheckedChange={onHumanAck} className="mt-0.5" />
              <span>
                I confirm that translated content has not been reviewed by a human translator.
                I will review menu items, allergy info, legal text, and pricing before publishing.
                <strong> The download will not unlock until this is checked.</strong>
              </span>
            </label>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Download &amp; deploy</CardTitle></CardHeader>
        <CardContent>
          <DeployButtons
            zipBase64={result.zipBase64}
            fileName={`${domain}-ai-audit-regen.zip`}
            acknowledged={!translateEnabled || humanAck}
          />
          <p className="text-xs text-muted-foreground mt-2">
            Tip: drop the unzipped folder onto Netlify Drop, or run <code className="font-mono">vercel</code> in the unzipped directory.
          </p>
        </CardContent>
      </Card>

      <SideBySidePreview originalUrl={originalUrl} optimizedHtml={result.homepagePreview} />

      <TranslationWarningsView warnings={result.translationWarnings} />

      <DiffViewer diffs={result.pageDiffs} />

      {result.notes.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Pipeline notes</CardTitle></CardHeader>
          <CardContent>
            <ul className="text-xs font-mono text-muted-foreground space-y-1">
              {result.notes.slice(0, 30).map((n, i) => <li key={i}>· {n}</li>)}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
