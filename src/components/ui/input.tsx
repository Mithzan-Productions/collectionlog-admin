import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-10 w-full border border-[var(--color-rule-2)] bg-[var(--color-paper)] px-3 py-1 font-mono text-sm text-[var(--color-fg)] placeholder:text-[var(--color-fg-dim)] focus-visible:outline-none focus-visible:border-[var(--color-lime)] focus-visible:bg-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
