"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
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
          <Select value={active} onValueChange={(v) => v && setActive(v)}>
            <SelectTrigger className="max-w-[60%] text-xs">
              <SelectValue placeholder="Pick a page" />
            </SelectTrigger>
            <SelectContent>
              {diffs.map((d) => (
                <SelectItem key={d.url} value={d.url}>
                  {d.url}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {stats && (
          <p className="text-xs font-mono text-muted-foreground mt-1">
            <span className="text-success">+{stats.added}</span>{" "}
            <span className="text-danger">-{stats.removed}</span>{" "}
            <span>· {current?.beforeLines} → {current?.afterLines} lines</span>
          </p>
        )}
      </CardHeader>
      <CardContent>
        {!current ? (
          <p className="text-sm text-muted-foreground">No diff available.</p>
        ) : (
          <pre className="text-[11px] font-mono leading-relaxed max-h-[60vh] overflow-auto rounded-md border border-border bg-paper p-3">
            {current.changes.map((c, i) => (
              <div
                key={i}
                className={cn(
                  c.type === "added" && "bg-(--success)/10 text-foreground",
                  c.type === "removed" && "bg-(--danger)/10 text-foreground line-through",
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
