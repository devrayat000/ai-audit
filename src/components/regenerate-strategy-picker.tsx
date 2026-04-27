"use client";

import { useEffect, useState } from "react";
import type { AuditReport } from "@/lib/types";
import type { RegenStrategy } from "@/lib/regenerator/types";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";
import { Layers, Wand2 } from "lucide-react";

interface Props {
  report?: AuditReport;
  value: RegenStrategy;
  onChange: (s: RegenStrategy) => void;
}

export function RegenerateStrategyPicker({ report, value, onChange }: Props) {
  const [recommended, setRecommended] = useState<RegenStrategy>("static-surgery");
  const [reason, setReason] = useState<string>("");

  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        const r = await fetch("/api/regenerate/strategy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audit: report }),
        });
        const j = await r.json();
        if (!aborted) {
          setRecommended(j.strategy);
          setReason(j.reason);
        }
      } catch {}
    })();
    return () => {
      aborted = true;
    };
  }, [report]);

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <StrategyCard
        title="Static Surgery"
        time="~30–60s"
        cost="~$0.20–0.50"
        icon={<Wand2 className="size-5" />}
        pros={[
          "Preserves design with near-perfect fidelity",
          "Cheap, fast",
          "Drop-in deployable",
        ]}
        cons={[
          "Static snapshot — dynamic features need rewiring",
          "JS-heavy sites lose interactivity",
        ]}
        selected={value === "static-surgery"}
        recommended={recommended === "static-surgery"}
        onSelect={() => onChange("static-surgery")}
      />
      <StrategyCard
        title="Next.js Project"
        time="~3–5 min"
        cost="~$2–5"
        icon={<Layers className="size-5" />}
        pros={[
          "Maintainable codebase",
          "Server-rendered → AI-friendly by default",
          "Components extracted from repeating patterns",
        ]}
        cons={[
          "Slower and more expensive",
          "Slight visual drift possible",
        ]}
        selected={value === "next-project"}
        recommended={recommended === "next-project"}
        onSelect={() => onChange("next-project")}
      />
      {reason && (
        <p className="md:col-span-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Recommended for your site:</span> {reason}
        </p>
      )}
    </div>
  );
}

function StrategyCard({
  title,
  time,
  cost,
  icon,
  pros,
  cons,
  selected,
  recommended,
  onSelect,
}: {
  title: string;
  time: string;
  cost: string;
  icon: React.ReactNode;
  pros: string[];
  cons: string[];
  selected: boolean;
  recommended: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "rounded-xl border text-left transition-colors",
        selected ? "border-foreground bg-card" : "border-border bg-card hover:border-foreground/40"
      )}
    >
      <Card className="border-0 shadow-none bg-transparent">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-md bg-foreground text-background flex items-center justify-center">{icon}</div>
              <div className="font-serif text-xl">{title}</div>
            </div>
            {recommended && <Badge variant="ink" className="uppercase text-[10px]">Recommended</Badge>}
          </div>
          <div className="text-xs font-mono text-muted-foreground">
            ⏱ {time} · 💸 {cost}
          </div>
          <ul className="text-sm space-y-1">
            {pros.map((p) => (
              <li key={p} className="flex gap-2"><span className="text-[color:var(--success)]">✓</span>{p}</li>
            ))}
            {cons.map((c) => (
              <li key={c} className="flex gap-2 text-muted-foreground"><span className="text-[color:var(--warning)]">!</span>{c}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </button>
  );
}
