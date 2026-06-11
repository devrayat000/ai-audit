"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuditReport } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, HelpCircle } from "lucide-react";
import Link from "next/link";

interface CustomQuestion {
  key: string;
  label: string;
  question: string;
  placeholder?: string;
  type: "text" | "tel" | "textarea" | "checkbox-group";
  options?: string[];
}

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

interface PageProps {
  params: Promise<{ auditId: string }>;
}

export default function CustomizePage(props: PageProps) {
  const params = use(props.params);
  const auditId = params.auditId;
  const router = useRouter();

  const [report, setReport] = useState<AuditReport | null>(null);
  const [subdomain, setSubdomain] = useState("");
  const [subdomainStep, setSubdomainStep] = useState(true);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ message: string; pct?: number } | null>(null);
  const [questions, setQuestions] = useState<CustomQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [runId, setRunId] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/audit/${auditId}`)
      .then((r) => r.json())
      .then((data) => {
        setReport(data);
        setSubdomain(defaultSubdomain(data.rootUrl));
      })
      .catch(() => setError("Failed to load audit report."));
  }, [auditId]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted/20 text-foreground">
        <p className="text-danger font-semibold">{error}</p>
        <Link href="/" className="mt-4 text-accent-brand underline">Back to home</Link>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const startPublish = async () => {
    setSubdomainStep(false);
    setRunning(true);
    setProgress({ message: "Starting publish and crawl..." });

    try {
      const r = await fetch("/api/publish/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceUrl: report.rootUrl,
          subdomain,
          industry: report.industry === "ecommerce" || report.industry === "blog" ? "general" : report.industry,
          audit: report,
        }),
      });

      const headerRunId = r.headers.get("X-Run-Id") || "";
      setRunId(headerRunId);

      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(j.error ?? "Failed to publish.");
        setRunning(false);
        return;
      }

      if (!r.body) {
        setError("Empty stream returned from publish server.");
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
      const { done, value } = await reader.read();
      if (done) break;
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
          error?: string;
          meta?: { questions?: CustomQuestion[] };
        };

        try {
          ev = JSON.parse(payload);
        } catch {
          continue;
        }

        if (ev.state === "waiting_for_input") {
          const qs = ev.meta?.questions;
          if (Array.isArray(qs) && qs.length > 0) {
            setQuestions(qs);
            setRunning(false);
            setProgress(null);
            return; // Pause streaming client side
          }
          // Malformed/empty questions: the workflow skips the customization
          // hook and keeps running, so keep consuming the stream instead of
          // stranding the user on a dead screen.
          continue;
        }

        if (ev.message || typeof ev.progress === "number") {
          setProgress({
            message: ev.message ?? "Running...",
            pct: ev.progress,
          });
        }

        if (ev.state === "completed") {
          router.push(`/templates/${auditId}?subdomain=${subdomain}`);
          return;
        }

        if (ev.state === "failed") {
          setError(ev.error ?? "Publish failed");
          setRunning(false);
          return;
        }
      }
    }
  };

  const handleQuestionnaireSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRunning(true);
    setProgress({ message: "Customizing your storefront..." });

    try {
      const r = await fetch("/api/publish/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId,
          answers,
        }),
      });

      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(j.error ?? "Failed to save details.");
        setRunning(false);
        return;
      }

      // The hook resumption continues the workflow in the background.
      router.push(`/templates/${auditId}?subdomain=${subdomain}&runId=${runId}`);
    } catch {
      setError("Failed to submit answers.");
      setRunning(false);
    }
  };

  return (
    <div className="bg-muted/30 min-h-screen text-foreground font-sans">
      <header className="bg-background border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-1.5 font-bold text-xl">
            <span className="text-danger">●</span> AIVIBLE
          </Link>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Step 1 of 3 — Onboarding
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-12">
        {/* PROGRESS STEPPER */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-accent-brand uppercase tracking-widest">
              Step 1 of 3 — Customize Business Info
            </span>
            <span className="text-xs text-muted-foreground">33%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-accent-brand transition-[width] duration-300" style={{ width: "33%" }} />
          </div>
        </div>

        {/* SUBDOMAIN INPUT STEP */}
        {subdomainStep && (
          <Card className="border border-border shadow-sm p-6">
            <CardHeader className="p-0 pb-4">
              <CardTitle className="text-2xl font-serif">Choose your subdomain</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Enter the name you want to use for your AI-optimized site.
              </p>
            </CardHeader>
            <CardContent className="p-0 space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Subdomain name</label>
                <div className="flex items-center gap-2">
                  <Input
                    value={subdomain}
                    onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-"))}
                    placeholder="my-business"
                    className="font-mono text-base py-5"
                  />
                  <span className="font-mono text-sm text-muted-foreground">.shorobik.com</span>
                </div>
              </div>

              <Button onClick={startPublish} className="w-full bg-accent-brand text-white py-5 rounded-xl font-semibold hover:bg-accent-brand/90 mt-2">
                Generate AI Storefront
              </Button>
            </CardContent>
          </Card>
        )}

        {/* PROGRESS LOADING BAR SCREEN */}
        {running && progress && (
          <Card className="border border-border shadow-sm p-6 text-center">
            <CardContent className="p-0 space-y-4">
              <div className="flex justify-center">
                <Loader2 className="size-8 animate-spin text-accent-brand" />
              </div>
              <div>
                <p className="font-semibold text-lg">{progress.message}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  We are parsing your sitemap and calling Claude to extract facts.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* DYNAMIC FORM SCREEN */}
        {questions.length > 0 && !running && (
          <Card className="border border-border shadow-sm p-6">
            <CardHeader className="p-0 pb-4">
              <div className="inline-flex items-center gap-1.5 text-xs text-warning bg-warning/5 border border-warning/15 px-3 py-1 rounded-full font-semibold mb-3">
                <HelpCircle className="size-3.5" />
                Claude found some missing details
              </div>
              <CardTitle className="text-2xl font-serif">Tell AI about your business</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                To maximize your AI recommendations, please provide the missing info that wasn&apos;t found during web scraping.
              </p>
            </CardHeader>
            <CardContent className="p-0 pt-4">
              <form onSubmit={handleQuestionnaireSubmit} className="space-y-5">
                {questions.map((q) => (
                  <div key={q.key} className="space-y-1.5">
                    <label className="block text-sm font-semibold">{q.label}</label>
                    <p className="text-xs text-muted-foreground mb-2">{q.question}</p>

                    {q.type === "textarea" ? (
                      <Textarea
                        value={answers[q.key] || ""}
                        onChange={(e) => setAnswers({ ...answers, [q.key]: e.target.value })}
                        placeholder={q.placeholder || "Enter details..."}
                        className="w-full rounded-xl"
                        rows={3}
                      />
                    ) : (
                      <Input
                        type={q.type}
                        value={answers[q.key] || ""}
                        onChange={(e) => setAnswers({ ...answers, [q.key]: e.target.value })}
                        placeholder={q.placeholder || "Enter value..."}
                        className="w-full rounded-xl"
                      />
                    )}
                  </div>
                ))}

                <Button type="submit" className="w-full bg-accent-brand text-white py-5 rounded-xl font-semibold hover:bg-accent-brand/90 mt-4">
                  Save &amp; Continue
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
