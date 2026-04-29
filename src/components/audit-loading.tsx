"use client";

import { Loader2 } from "lucide-react";

interface Props {
  url: string;
  progress?: {
    stepIndex: number;
    message: string;
    detail?: string;
  };
}

const STEPS = [
  "Resolving robots.txt and llms.txt",
  "Pinging AI bot user-agents",
  "Discovering URLs from sitemap + crawl",
  "Rendering pages with headless Chromium",
  "Comparing raw vs JS-rendered HTML",
  "Parsing JSON-LD and meta tags",
  "Scoring and assembling the report",
];

export function AuditLoading({ url, progress }: Props) {
  const currentStep = Math.max(0, progress?.stepIndex ?? 0);
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-6">
      <Loader2 className="size-10 animate-spin text-accent-brand" />
      <div className="space-y-1">
        <h2 className="font-serif text-2xl">Auditing {url}</h2>
        <p className="text-sm text-muted-foreground">
          This usually takes 30–90 seconds. We&apos;re being polite to your
          origin.
        </p>
        {progress?.message && (
          <div className="text-xs font-mono text-muted-foreground">
            {progress.message}
            {progress.detail ? ` · ${progress.detail}` : ""}
          </div>
        )}
      </div>
      <ul className="text-sm text-muted-foreground space-y-1.5 text-left">
        {STEPS.map((s, i) => {
          const isActive = i === currentStep;
          const isDone = i < currentStep;
          const color = isActive
            ? "rgba(var(--accent-brand), 1)"
            : isDone
              ? "rgba(var(--accent-brand), 0.6)"
              : "rgba(var(--muted-foreground), 0.4)";
          const textClass = isActive
            ? "text-foreground"
            : isDone
              ? "text-muted-foreground"
              : "text-muted-foreground/60";
          return (
            <li key={s} className={`flex items-start gap-2 ${textClass}`}>
              <span
                className="mt-1.5 size-1.5 rounded-full"
                style={{ backgroundColor: color }}
              />
              {s}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
