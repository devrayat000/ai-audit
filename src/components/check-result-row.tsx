"use client";

import { useState } from "react";
import type { AuditReport, CheckResult } from "@/lib/types";
import { StatusIcon } from "./status-icon";
import { ChevronDown } from "lucide-react";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";

interface Props {
  check: CheckResult;
  report: AuditReport;
}

export function CheckResultRow({ check }: Props) {
  const [open, setOpen] = useState(false);
  const evidenceJson = JSON.stringify(check.evidence, null, 2);

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "flex w-full items-center gap-3 py-3 px-4 text-left hover:bg-muted/40 transition-colors",
          open && "bg-muted/30",
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
            <span
              className={cn(
                check.status === "pass" && "text-success",
                check.status === "warn" && "text-warning",
                check.status === "fail" && "text-danger",
              )}
            >
              {check.score}
            </span>
            <span className="text-muted-foreground">/{check.maxScore}</span>
          </div>
        </div>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 space-y-4 bg-muted/20">
          <div>
            <div className="text-xs font-mono uppercase text-muted-foreground mb-1">
              Finding
            </div>
            <p className="text-sm">{check.message}</p>
          </div>
          <div>
            <div className="text-xs font-mono uppercase text-muted-foreground mb-1">
              Suggested fix
            </div>
            <p className="text-sm">{check.fixSuggestion}</p>
          </div>
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer hover:text-foreground">
              Evidence (raw)
            </summary>
            <pre className="mt-2 p-3 rounded-md border border-border bg-paper font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">
              {evidenceJson}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
