"use client";

import { cn } from "@/lib/utils";

interface Props {
  score: number;
  grade: string;
  size?: number;
  label?: string;
  className?: string;
}

function colorFor(score: number): string {
  if (score >= 90) return "var(--success)";
  if (score >= 70) return "var(--ink)";
  if (score >= 50) return "var(--warning)";
  return "var(--danger)";
}

export function ScoreRadial({ score, grade, size = 200, label, className }: Props) {
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const offset = c - (pct / 100) * c;
  const color = colorFor(score);

  return (
    <div className={cn("flex flex-col items-center gap-1", className)} style={{ width: size }}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="var(--border)"
            strokeWidth={stroke}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 600ms ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-serif text-5xl font-medium leading-none">{score}</div>
          <div className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
            grade <span className="ml-1 font-semibold text-foreground">{grade}</span>
          </div>
        </div>
      </div>
      {label && <div className="text-sm text-muted-foreground">{label}</div>}
    </div>
  );
}
