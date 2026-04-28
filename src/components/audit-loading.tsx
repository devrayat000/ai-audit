"use client";

import { Loader2 } from "lucide-react";

interface Props {
  url: string;
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

export function AuditLoading({ url }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-6">
      <Loader2 className="size-10 animate-spin text-accent-brand" />
      <div className="space-y-1">
        <h2 className="font-serif text-2xl">Auditing {url}</h2>
        <p className="text-sm text-muted-foreground">
          This usually takes 30–90 seconds. We're being polite to your origin.
        </p>
      </div>
      <ul className="text-sm text-muted-foreground space-y-1.5 text-left">
        {STEPS.map((s) => (
          <li key={s} className="flex items-start gap-2">
            <span className="mt-1.5 size-1.5 rounded-full bg-(--accent-brand)/60" />
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}
