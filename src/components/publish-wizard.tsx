"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { CheckCircle2, ExternalLink, Loader2, X, XCircle } from "lucide-react";
import type { AuditReport } from "@/lib/types";

interface Props {
  report: AuditReport;
  open: boolean;
  onClose: () => void;
}

type SiteIndustry = "restaurant" | "travel" | "service" | "general";

const APEX = process.env.NEXT_PUBLIC_SITE_APEX ?? "aivible.tokyo";

function defaultSubdomain(rootUrl: string): string {
  try {
    const host = new URL(rootUrl).hostname.replace(/^www\./, "");
    return host
      .replace(/\..*$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "site";
  } catch {
    return "site";
  }
}

function defaultIndustry(report: AuditReport): SiteIndustry {
  const ind = report.industry;
  if (ind === "restaurant" || ind === "travel" || ind === "service") return ind;
  return "general";
}

export function PublishWizard({ report, open, onClose }: Props) {
  const initialSub = useMemo(() => defaultSubdomain(report.rootUrl), [report.rootUrl]);
  const initialInd = useMemo(() => defaultIndustry(report), [report]);
  const [subdomain, setSubdomain] = useState(initialSub);
  const [industry, setIndustry] = useState<SiteIndustry>(initialInd);
  const [check, setCheck] = useState<{ ok: boolean; reason?: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ message: string; pct?: number } | null>(null);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!subdomain) {
      setCheck(null);
      return;
    }
    const handle = setTimeout(async () => {
      setChecking(true);
      try {
        const r = await fetch("/api/publish/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subdomain }),
        });
        const j = await r.json();
        setCheck({ ok: !!j.ok, reason: j.reason });
      } catch {
        setCheck(null);
      } finally {
        setChecking(false);
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [subdomain]);

  if (!open) return null;

  const startPublish = async () => {
    setRunning(true);
    setError(null);
    setPublishedUrl(null);
    setDone(false);
    setProgress({ message: "Starting publish…" });
    try {
      const r = await fetch("/api/publish/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceUrl: report.rootUrl,
          subdomain,
          industry,
          overwrite: check?.reason?.startsWith("Already published") ? true : undefined,
          audit: report,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(j.error ?? `Publish failed (${r.status})`);
        setRunning(false);
        return;
      }
      if (!r.body) {
        setError("Server returned no stream.");
        setRunning(false);
        return;
      }
      await consumePublishStream(r.body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
      setRunning(false);
    }
  };

  const consumePublishStream = async (body: ReadableStream<Uint8Array>) => {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { done: streamDone, value } = await reader.read();
      if (streamDone) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split("\n\n");
      buf = parts.pop() ?? "";
      for (const part of parts) {
        const line = part.split("\n").find((l) => l.startsWith("data: "));
        if (!line) continue;
        const payload = line.slice(6).trim();
        if (payload === "[DONE]") continue;
        let ev: {
          state?: string;
          message?: string;
          progress?: number;
          plannedUrl?: string;
          error?: string;
        };
        try {
          ev = JSON.parse(payload);
        } catch {
          continue;
        }
        if (typeof ev.message === "string" || typeof ev.progress === "number") {
          setProgress({
            message: ev.message ?? (ev.state ?? "running"),
            pct: typeof ev.progress === "number" ? ev.progress : undefined,
          });
        }
        if (ev.state === "completed") {
          if (ev.plannedUrl) setPublishedUrl(ev.plannedUrl);
          setDone(true);
        }
        if (ev.state === "failed") {
          setError(ev.error ?? ev.message ?? "Publish failed.");
        }
      }
    }
    setRunning(false);
  };

  const canStart =
    !!subdomain &&
    !running &&
    (check?.ok || check?.reason?.startsWith("Already published"));

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              Publish
            </div>
            <h2 className="font-heading text-3xl">Scrape &amp; host on subdomain</h2>
            <p className="text-sm text-muted-foreground mt-1">
              We&rsquo;ll crawl <span className="font-mono">{report.rootUrl}</span>, drop the
              data into a clean template, and serve it AI-readable at your chosen subdomain.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="size-5" />
          </Button>
        </div>

        {!done && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Subdomain &amp; template</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-xs uppercase tracking-widest text-muted-foreground">
                    Subdomain
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <Input
                      value={subdomain}
                      onChange={(e) =>
                        setSubdomain(
                          e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
                        )
                      }
                      placeholder="business-name"
                      className="font-mono"
                    />
                    <span className="font-mono text-sm text-muted-foreground whitespace-nowrap">
                      .{APEX}
                    </span>
                  </div>
                  <div className="mt-1 text-xs h-4">
                    {checking && (
                      <span className="text-muted-foreground">Checking availability…</span>
                    )}
                    {!checking && check?.ok && (
                      <span className="text-success inline-flex items-center gap-1">
                        <CheckCircle2 className="size-3" /> Available
                      </span>
                    )}
                    {!checking && check && !check.ok && (
                      <span className="text-danger inline-flex items-center gap-1">
                        <XCircle className="size-3" /> {check.reason}
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-xs uppercase tracking-widest text-muted-foreground">
                    Template
                  </label>
                  <Select
                    value={industry}
                    onValueChange={(v) => v && setIndustry(v as SiteIndustry)}
                  >
                    <SelectTrigger className="mt-1 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="restaurant">Restaurant</SelectItem>
                      <SelectItem value="travel">Travel (uses general template for now)</SelectItem>
                      <SelectItem value="service">Service (uses general template for now)</SelectItem>
                      <SelectItem value="general">General</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

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
              <Button size="lg" onClick={startPublish} disabled={!canStart}>
                {running ? <Loader2 className="size-4 animate-spin" /> : null}
                {check?.reason?.startsWith("Already published") ? "Re-publish" : "Publish"}
              </Button>
            </div>
          </>
        )}

        {done && publishedUrl && (
          <Card>
            <CardContent className="p-6 space-y-3">
              <div className="flex items-center gap-2 text-success">
                <CheckCircle2 className="size-5" />
                <span className="font-medium">Live</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Your site is hosted at:
              </p>
              <a
                href={publishedUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 font-mono text-lg break-all hover:underline"
              >
                {publishedUrl} <ExternalLink className="size-4" />
              </a>
              <div className="flex gap-2 pt-2">
                <Button onClick={onClose} variant="outline">
                  Close
                </Button>
                <a
                  href={publishedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-foreground text-background px-4 text-sm font-medium hover:bg-foreground/85 transition-colors"
                >
                  Visit site <ExternalLink className="size-3.5" />
                </a>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
