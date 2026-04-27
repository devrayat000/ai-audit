"use client";

import { useState } from "react";
import type { AuditReport, PageReport } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { CheckResultRow } from "./check-result-row";
import { Button } from "./ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

function gradeBadgeVariant(score: number): "success" | "warning" | "danger" | "default" {
  if (score >= 90) return "success";
  if (score >= 70) return "default";
  if (score >= 50) return "warning";
  return "danger";
}

interface Props {
  report: AuditReport;
}

export function PageList({ report }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<"score" | "url">("score");
  const [asc, setAsc] = useState(false);

  const sorted = [...report.pages].sort((a, b) => {
    const cmp = sortKey === "score" ? a.pageScore - b.pageScore : a.url.localeCompare(b.url);
    return asc ? cmp : -cmp;
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Pages crawled ({report.pages.length})</CardTitle>
          <div className="flex gap-1 text-xs">
            <Button variant="ghost" size="xs" onClick={() => { setSortKey("score"); setAsc(!asc); }}>
              Score {sortKey === "score" && (asc ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />)}
            </Button>
            <Button variant="ghost" size="xs" onClick={() => { setSortKey("url"); setAsc(!asc); }}>
              URL {sortKey === "url" && (asc ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />)}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {sorted.map((p) => (
          <PageRow
            key={p.url}
            page={p}
            report={report}
            open={openId === p.url}
            onToggle={() => setOpenId(openId === p.url ? null : p.url)}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function PageRow({
  page,
  report,
  open,
  onToggle,
}: {
  page: PageReport;
  report: AuditReport;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "w-full px-5 py-3 flex items-center gap-4 text-left hover:bg-muted/40 transition-colors",
          open && "bg-muted/30"
        )}
      >
        <Badge variant={gradeBadgeVariant(page.pageScore)} className="font-mono tabular-nums">
          {page.pageGrade} · {page.pageScore}
        </Badge>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{page.title || page.url}</div>
          <div className="text-xs text-muted-foreground truncate font-mono">
            {page.url} · {page.statusCode} · JS-dep {(page.jsDependencyRatio * 100).toFixed(0)}%
          </div>
        </div>
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="border-t border-border bg-muted/10">
          {page.checks.map((c, i) => (
            <CheckResultRow key={i} check={c} report={report} />
          ))}
          {page.jsDependencyRatio > 0.5 && (
            <div className="p-4 grid md:grid-cols-2 gap-3 border-t border-border">
              <div>
                <div className="text-xs font-mono uppercase text-muted-foreground mb-1">
                  Raw HTML (what AI bots see)
                </div>
                <pre className="text-[11px] font-mono p-3 max-h-48 overflow-auto rounded-md border border-border bg-[color:var(--paper)] whitespace-pre-wrap">
                  {page.rawHtmlPreview.slice(0, 1500)}
                </pre>
              </div>
              <div>
                <div className="text-xs font-mono uppercase text-muted-foreground mb-1">
                  Rendered HTML (what humans see)
                </div>
                <pre className="text-[11px] font-mono p-3 max-h-48 overflow-auto rounded-md border border-border bg-[color:var(--paper)] whitespace-pre-wrap">
                  {page.renderedHtmlPreview.slice(0, 1500)}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
