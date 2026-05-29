import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 px-1.5 py-px font-mono text-[10px] uppercase tracking-[0.12em] border",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--color-paper-2)] text-[var(--color-fg-muted)] border-[var(--color-rule-2)]",
        accent:
          "bg-[var(--color-lime)]/10 text-[var(--color-lime)] border-[var(--color-lime)]/40",
        success:
          "bg-[var(--color-lime)]/10 text-[var(--color-lime)] border-[var(--color-lime)]/40",
        warn:
          "bg-[var(--color-amber)]/10 text-[var(--color-amber)] border-[var(--color-amber)]/40",
        danger:
          "bg-[var(--color-rust)]/10 text-[var(--color-rust)] border-[var(--color-rust)]/40",
        ghost:
          "bg-transparent text-[var(--color-fg-dim)] border-transparent",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
