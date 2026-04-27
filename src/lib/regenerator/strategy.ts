import type { AuditReport } from "../types";
import type { RegenStrategy } from "./types";

export function recommendStrategy(report?: AuditReport): { strategy: RegenStrategy; reason: string } {
  if (!report || report.pages.length === 0) {
    return { strategy: "static-surgery", reason: "Default. Best for marketing/static-style sites." };
  }
  const heavyJsPages = report.pages.filter((p) => p.jsDependencyRatio > 0.5).length;
  const ratio = heavyJsPages / report.pages.length;
  if (ratio > 0.4) {
    return {
      strategy: "next-project",
      reason: `${heavyJsPages}/${report.pages.length} pages are heavily JS-dependent. A Next.js project gives you a maintainable, server-rendered codebase.`,
    };
  }
  return { strategy: "static-surgery", reason: "Pages render well without JS. Static surgery preserves design with highest fidelity." };
}
