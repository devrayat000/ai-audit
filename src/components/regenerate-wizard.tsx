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
import { DeployToVercel } from "./deploy-to-vercel";
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
  pageDiffs: Array<{
    url: string;
    changes: { type: "added" | "removed" | "context"; line: string }[];
    beforeLines: number;
    afterLines: number;
  }>;
  homepagePreview: string;
  originalHomepageScreenshot?: string;
  translationWarnings: import("@/lib/regenerator/types").TranslationWarning[];
  zip: import("@/lib/regenerator/types").RegenZipRef;
  totalSizeBytes: number;
  durationMs: number;
  notes: string[];
}

const DEV_BYPASS =
  process.env.NODE_ENV !== "production" ||
  process.env.NEXT_PUBLIC_ALLOW_REGEN_WITHOUT_VERIFICATION === "true";

export function RegenerateWizard({ report, open, onClose }: Props) {
  const [verified, setVerified] = useState<VerifiedState | null>(
    DEV_BYPASS
      ? () => ({
          proof: "dev-bypass",
          method: "meta-tag",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        })
      : null,
  );

  const [strategy, setStrategy] = useState<RegenStrategy>("static-surgery");
  const [translateEnabled, setTranslateEnabled] = useState(false);
  const [translation, setTranslation] = useState<TranslationConfig | null>(
    null,
  );
  const [glossaryOverride, setGlossaryOverride] = useState<
    GlossaryEntry[] | null
  >(null);
  const [fixes, setFixes] = useState<
    { analyzerKey: string; enabled: boolean }[]
  >(() => {
    const all = [
      ...report.siteChecks,
      ...report.pages.flatMap((p) => p.checks),
    ];
    const keys = Array.from(
      new Set(all.filter((c) => c.status !== "pass").map((c) => c.analyzerKey)),
    );
    return keys.map((k) => ({ analyzerKey: k, enabled: true }));
  });
  const [humanAck, setHumanAck] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RegenResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const domain = useMemo(
    () => getDomain(report.rootUrl).replace(/^www\./, ""),
    [report.rootUrl],
  );
  const rootUrl = useMemo(() => normalizeUrl(report.rootUrl), [report.rootUrl]);

  const finalGlossary = glossaryOverride ?? translation?.glossary ?? [];
  const translationCfg: TranslationConfig | null = translation
    ? { ...translation, glossary: finalGlossary }
    : null;

  const canRun =
    !!verified &&
    fixes.some((f) => f.enabled) &&
    (!translateEnabled ||
      (translationCfg &&
        (translationCfg.mode === "literal" ||
          translationCfg.mode === "transcreate" ||
          translationCfg.mode === "bilingual"))) &&
    !running;

  const [progress, setProgress] = useState<{
    message: string;
    pct?: number;
  } | null>(null);

  const start = async () => {
    if (!verified) return;
    setRunning(true);
    setError(null);
    setResult(null);
    setProgress({ message: "Starting workflow…" });
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
          translation:
            translateEnabled && translationCfg
              ? {
                  ...translationCfg,
                  humanReviewAcknowledged: humanAck,
                  glossary: finalGlossary,
                }
              : undefined,
          inlineAssets: false,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(j.error ?? `Regeneration failed (${r.status})`);
        setRunning(false);
        return;
      }
      if (!r.body) {
        setError("No response stream from regeneration.");
        setRunning(false);
        return;
      }
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finished = false;
      let finalResult: RegenResponse | null = null;
      let finalError: string | null = null;

      while (!finished) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx = buffer.indexOf("\n");
        while (idx >= 0) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (isDoneLine(line)) {
            finished = true;
            break;
          }
          const payload = parseStreamLine(line);
          if (payload && isRegenStreamStatus(payload)) {
            const nextMessage =
              typeof payload.message === "string" ? payload.message : undefined;
            const nextPct =
              typeof payload.progress === "number"
                ? payload.progress
                : undefined;
            if (nextMessage || typeof nextPct === "number") {
              setProgress((prev) => ({
                message: nextMessage ?? prev?.message ?? "Running",
                pct: typeof nextPct === "number" ? nextPct : prev?.pct,
              }));
            }
            if (payload.state === "completed") {
              if (payload.result) finalResult = payload.result as RegenResponse;
              finished = true;
              break;
            }
            if (payload.state === "failed") {
              finalError =
                typeof payload.error === "string"
                  ? payload.error
                  : "Workflow reported failure.";
              finished = true;
              break;
            }
          }
          idx = buffer.indexOf("\n");
        }
      }

      if (finished) await reader.cancel();

      if (finalResult) {
        setResult(finalResult);
        setRunning(false);
        return;
      }
      if (finalError) {
        setError(finalError);
        setRunning(false);
        return;
      }
      setError("Regeneration stream ended without result.");
      setRunning(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
      setRunning(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              Regenerator
            </div>
            <h2 className="font-serif text-3xl">
              AI-optimized clone of your site
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              We preserve your design and inject every fix the audit flagged.{" "}
              <span className="text-foreground">
                {DEV_BYPASS
                  ? "Dev/test mode — domain ownership verification is bypassed."
                  : "Domain ownership verification is mandatory."}
              </span>
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="size-5" />
          </Button>
        </div>

        {!result && (
          <div className="space-y-5">
            {DEV_BYPASS ? (
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <span className="inline-flex size-2 rounded-full bg-warning" />
                  <div className="text-sm">
                    <span className="font-medium">Verification bypassed</span>
                    <span className="text-muted-foreground">
                      {" "}
                      — this build is non-production (
                      <code className="font-mono">
                        NODE_ENV={process.env.NODE_ENV ?? "undefined"}
                      </code>
                      ). In production, real DNS or meta-tag verification will
                      be required.
                    </span>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <VerificationFlow
                domain={domain}
                rootUrl={rootUrl}
                onVerified={(v) => setVerified(v)}
              />
            )}

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

                <FixesChecklist
                  report={report}
                  fixes={fixes}
                  onChange={setFixes}
                />

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
                          onCheckedChange={(v) => setHumanAck(v === true)}
                          className="mt-0.5"
                        />
                        <span>
                          I acknowledge that translated content has not been
                          reviewed by a human translator. I will review the
                          output — especially menu items, allergy info, legal
                          text, and pricing — before publishing.
                        </span>
                      </label>
                    </CardContent>
                  </Card>
                )}

                <div className="flex flex-col gap-3">
                  {running && progress && (
                    <Card>
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Loader2 className="size-4 animate-spin" />
                          <span>{progress.message}</span>
                          {typeof progress.pct === "number" && (
                            <span className="ml-auto font-mono text-xs text-muted-foreground">
                              {progress.pct}%
                            </span>
                          )}
                        </div>
                        {typeof progress.pct === "number" && (
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-foreground transition-[width] duration-500"
                              style={{ width: `${Math.max(2, progress.pct)}%` }}
                            />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                  <div className="flex items-center justify-end gap-3">
                    {error && <p className="text-sm text-danger">{error}</p>}
                    <Button
                      type="button"
                      size="lg"
                      onClick={start}
                      disabled={!canRun || (translateEnabled && !humanAck)}
                    >
                      {running ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Rocket className="size-4" />
                      )}
                      {running ? "Regenerating…" : "Start regeneration"}
                    </Button>
                  </div>
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

function isDoneLine(line: string): boolean {
  return line === "[DONE]" || line === "data: [DONE]";
}

function parseStreamLine(line: string): unknown | null {
  if (!line) return null;
  if (line.startsWith(":")) return null;
  const payload = line.startsWith("data:") ? line.slice(5).trim() : line;
  if (!payload || payload === "[DONE]") return null;
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

function isRegenStreamStatus(value: unknown): value is {
  state?: string;
  message?: string;
  progress?: number;
  meta?: unknown;
  result?: unknown;
  error?: unknown;
} {
  return !!value && typeof value === "object";
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
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              Regenerated in {(result.durationMs / 1000).toFixed(1)}s
            </div>
            <div className="font-serif text-2xl mt-1">Ready to download</div>
            <div className="text-sm text-muted-foreground mt-1">
              {result.fixesApplied.length} fix(es) applied ·{" "}
              {result.pageDiffs.length} page(s) processed
              {result.translationWarnings.length > 0 &&
                ` · ${result.translationWarnings.length} translation warning(s)`}
            </div>
          </div>
          <Button variant="outline" onClick={onReset}>
            Configure another run
          </Button>
        </CardContent>
      </Card>

      {translateEnabled && (
        <Card>
          <CardContent className="p-5 flex items-start gap-3">
            <label className="flex items-start gap-2 cursor-pointer text-sm">
              <Checkbox
                checked={humanAck}
                onCheckedChange={(v) => onHumanAck(v === true)}
                className="mt-0.5"
              />
              <span>
                I confirm that translated content has not been reviewed by a
                human translator. I will review menu items, allergy info, legal
                text, and pricing before publishing.
                <strong>
                  {" "}
                  The download will not unlock until this is checked.
                </strong>
              </span>
            </label>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Download &amp; deploy</CardTitle>
        </CardHeader>
        <CardContent>
          <DeployButtons
            zip={result.zip}
            fileName={`${domain}-ai-audit-regen.zip`}
            acknowledged={!translateEnabled || humanAck}
          />
          <p className="text-xs text-muted-foreground mt-2">
            Tip: drop the unzipped folder onto Netlify Drop, or use the
            one-click Vercel deploy below.
          </p>
        </CardContent>
      </Card>

      <DeployToVercel
        zip={result.zip}
        projectNameSeed={domain}
        acknowledged={!translateEnabled || humanAck}
      />

      <SideBySidePreview
        originalUrl={originalUrl}
        originalScreenshotBase64={result.originalHomepageScreenshot}
        optimizedHtml={result.homepagePreview}
      />

      <TranslationWarningsView warnings={result.translationWarnings} />

      <DiffViewer diffs={result.pageDiffs} />

      {result.notes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pipeline notes</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-xs font-mono text-muted-foreground space-y-1">
              {result.notes.slice(0, 30).map((n, i) => (
                <li key={i}>· {n}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
