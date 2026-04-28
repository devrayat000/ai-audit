"use client";

import type { TranslationWarning } from "@/lib/regenerator/types";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { StatusBadge, type StatusKind } from "./status-badge";
import { AlertTriangle } from "lucide-react";

interface Props {
  warnings: TranslationWarning[];
}

const KIND_LABEL: Record<TranslationWarning["kind"], { label: string; kind: StatusKind }> = {
  overflow: { label: "Layout overflow", kind: "warning" },
  truncation: { label: "Truncation", kind: "warning" },
  "rtl-flip": { label: "RTL/LTR review", kind: "warning" },
  "legal-flag": { label: "Legal/medical", kind: "danger" },
  "preservation-fail": { label: "Preservation fail", kind: "danger" },
};

export function TranslationWarningsView({ warnings }: Props) {
  if (warnings.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="size-5 text-warning" />
          Translation review needed ({warnings.length})
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Each item is a string that may need a human translator's review before publishing.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {warnings.slice(0, 200).map((w, i) => {
            const k = KIND_LABEL[w.kind];
            return (
              <li key={i} className="p-3 flex flex-col gap-1">
                <div className="flex items-center gap-2 text-xs">
                  <StatusBadge kind={k.kind}>{k.label}</StatusBadge>
                  <span className="font-mono truncate">{w.pageUrl}</span>
                </div>
                <div className="text-sm">{w.message}</div>
                <div className="text-xs font-mono text-muted-foreground">{w.selector}</div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
