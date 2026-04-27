"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Select } from "./ui/select";
import { cn } from "@/lib/utils";

interface DiffChange { type: "added" | "removed" | "context"; line: string }
interface PageDiff {
  url: string;
  changes: DiffChange[];
  beforeLines: number;
  afterLines: number;
}

interface Props {
  diffs: PageDiff[];
}

export function DiffViewer({ diffs }: Props) {
  const [active, setActive] = useState<string>(diffs[0]?.url ?? "");
  const current = diffs.find((d) => d.url === active);
  const stats = current ? summarize(current.changes) : null;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle>HTML diff</CardTitle>
          <Select value={active} onChange={(e) => setActive(e.target.value)} className="max-w-[60%] h-9 text-xs">
            {diffs.map((d) => (
              <option key={d.url} value={d.url}>
                {d.url}
              </option>
            ))}
          </Select>
        </div>
        {stats && (
          <p className="text-xs font-mono text-muted-foreground">
            <span className="text-[color:var(--success)]">+{stats.added}</span>{" "}
            <span className="text-[color:var(--danger)]">-{stats.removed}</span>{" "}
            <span>· {current?.beforeLines} → {current?.afterLines} lines</span>
          </p>
        )}
      </CardHeader>
      <CardContent>
        {!current ? (
          <p className="text-sm text-muted-foreground">No diff available.</p>
        ) : (
          <pre className="text-[11px] font-mono leading-relaxed max-h-[60vh] overflow-auto rounded-md border border-border bg-[color:var(--paper)] p-3">
            {current.changes.map((c, i) => (
              <div
                key={i}
                className={cn(
                  c.type === "added" && "bg-[color:var(--success)]/10 text-foreground",
                  c.type === "removed" && "bg-[color:var(--danger)]/10 text-foreground line-through",
                  c.type === "context" && "text-muted-foreground"
                )}
              >
                {c.type === "added" ? "+ " : c.type === "removed" ? "- " : "  "}
                {c.line}
              </div>
            ))}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}

function summarize(changes: DiffChange[]) {
  let added = 0, removed = 0;
  for (const c of changes) {
    if (c.type === "added") added++;
    if (c.type === "removed") removed++;
  }
  return { added, removed };
}
