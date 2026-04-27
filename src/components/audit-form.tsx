"use client";

import { useState } from "react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { IndustrySelector } from "./industry-selector";
import type { Industry } from "@/lib/types";
import { ArrowRight } from "lucide-react";

interface Props {
  onSubmit: (input: { url: string; industry?: Industry }) => void;
  busy?: boolean;
  initialUrl?: string;
}

export function AuditForm({ onSubmit, busy, initialUrl = "" }: Props) {
  const [url, setUrl] = useState(initialUrl);
  const [industry, setIndustry] = useState<Industry | "auto">("auto");

  return (
    <form
      className="flex flex-col gap-3 w-full"
      onSubmit={(e) => {
        e.preventDefault();
        if (!url.trim() || busy) return;
        onSubmit({ url: url.trim(), industry: industry === "auto" ? undefined : industry });
      }}
    >
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          placeholder="example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          className="flex-1 h-12 text-base"
          required
        />
        <IndustrySelector value={industry} onChange={setIndustry} className="sm:w-56 h-12" />
        <Button type="submit" size="lg" disabled={busy} className="h-12 px-6">
          {busy ? "Auditing…" : (
            <>
              Run audit
              <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        We crawl up to 12 pages, fetch with multiple AI bot user-agents, and run 20+ analyzers.
        Typical run: 30–90s.
      </p>
    </form>
  );
}
