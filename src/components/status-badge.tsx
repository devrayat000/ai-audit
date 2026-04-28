import * as React from "react";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";

export type StatusKind = "success" | "warning" | "danger" | "ink" | "muted";

const KIND_CLASS: Record<StatusKind, string> = {
  success: "border-transparent bg-success/15 text-success",
  warning: "border-transparent bg-warning/15 text-warning",
  danger: "border-transparent bg-danger/15 text-danger",
  ink: "border-transparent bg-foreground text-background",
  muted: "border-transparent bg-muted text-muted-foreground",
};

interface Props extends React.ComponentProps<"span"> {
  kind: StatusKind;
}

export function StatusBadge({ kind, className, ...props }: Props) {
  return <Badge className={cn(KIND_CLASS[kind], className)} {...props} />;
}
