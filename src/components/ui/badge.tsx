import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "border-transparent bg-secondary text-secondary-foreground",
        success:
          "border-transparent bg-[color:var(--success)]/15 text-[color:var(--success)]",
        warning:
          "border-transparent bg-[color:var(--warning)]/15 text-[color:var(--warning)]",
        danger:
          "border-transparent bg-[color:var(--danger)]/15 text-[color:var(--danger)]",
        outline: "border-border text-foreground",
        ink: "border-transparent bg-foreground text-background",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
