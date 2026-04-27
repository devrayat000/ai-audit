"use client";

import type { AuditReport } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Checkbox } from "./ui/checkbox";

interface Fix { analyzerKey: string; enabled: boolean }

interface Props {
  report?: AuditReport;
  fixes: Fix[];
  onChange: (f: Fix[]) => void;
}

export function FixesChecklist({ report, fixes, onChange }: Props) {
  const allChecks = report
    ? [...report.siteChecks, ...report.pages.flatMap((p) => p.checks)]
    : [];
  const fixable = fixes.length > 0
    ? fixes
    : Array.from(new Set(allChecks.filter((c) => c.status !== "pass").map((c) => c.analyzerKey))).map((k) => ({ analyzerKey: k, enabled: true }));

  const toggle = (key: string) => {
    onChange(fixable.map((f) => (f.analyzerKey === key ? { ...f, enabled: !f.enabled } : f)));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fixes to apply</CardTitle>
        <p className="text-sm text-muted-foreground">All checked by default. Uncheck anything you want to skip.</p>
      </CardHeader>
      <CardContent>
        {fixable.length === 0 ? (
          <p className="text-sm text-muted-foreground">No issues to fix — your audit looks clean.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-2">
            {fixable.map((f) => (
              <label key={f.analyzerKey} className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/40 cursor-pointer">
                <Checkbox checked={f.enabled} onCheckedChange={() => toggle(f.analyzerKey)} />
                <div className="text-sm font-mono">{f.analyzerKey}</div>
              </label>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
