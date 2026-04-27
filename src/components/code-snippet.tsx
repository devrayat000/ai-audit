"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  code: string;
  language?: string;
  title?: string;
  className?: string;
}

export function CodeSnippet({ code, language, title, className }: Props) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return (
    <div className={cn("rounded-lg border border-border bg-[color:var(--paper)] overflow-hidden", className)}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-secondary/30">
        <div className="text-xs font-mono text-muted-foreground">
          {title ?? (language ? language : "snippet")}
        </div>
        <Button type="button" variant="ghost" size="xs" onClick={copy}>
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="p-3 text-xs overflow-x-auto font-mono leading-relaxed whitespace-pre-wrap">
        <code>{code}</code>
      </pre>
    </div>
  );
}
