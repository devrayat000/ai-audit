import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import type { CheckStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StatusIcon({ status, className }: { status: CheckStatus; className?: string }) {
  if (status === "pass")
    return <CheckCircle2 className={cn("text-[color:var(--success)]", className)} aria-label="Pass" />;
  if (status === "warn")
    return <AlertTriangle className={cn("text-[color:var(--warning)]", className)} aria-label="Warn" />;
  return <XCircle className={cn("text-[color:var(--danger)]", className)} aria-label="Fail" />;
}
