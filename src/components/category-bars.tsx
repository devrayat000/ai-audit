"use client";

import type { Category } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/scoring/weights";
import { cn } from "@/lib/utils";

interface Props {
  scores: Record<Category, { score: number; max: number }>;
}

function colorFor(score: number): string {
  if (score >= 90) return "var(--success)";
  if (score >= 70) return "var(--ink)";
  if (score >= 50) return "var(--warning)";
  return "var(--danger)";
}

export function CategoryBars({ scores }: Props) {
  const entries = Object.entries(scores) as [Category, { score: number; max: number }][];
  return (
    <div className="space-y-3">
      {entries.map(([cat, v]) => (
        <div key={cat}>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="font-medium">{CATEGORY_LABELS[cat]}</span>
            <span className="font-mono tabular-nums text-xs text-muted-foreground">
              {v.score}<span className="opacity-60">/100</span>
            </span>
          </div>
          <div className={cn("h-2 w-full overflow-hidden rounded-full bg-muted")}>
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${Math.max(2, v.score)}%`, background: colorFor(v.score) }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
