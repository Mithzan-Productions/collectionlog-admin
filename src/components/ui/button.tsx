import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-mono text-xs uppercase tracking-[0.12em] transition-all focus-visible:outline-none focus-visible:outline-2 focus-visible:outline-[var(--color-lime)] focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--color-lime)] text-[var(--color-ink)] border border-[var(--color-lime)] hover:bg-[var(--color-lime-dim)] hover:border-[var(--color-lime-dim)]",
        secondary:
          "bg-[var(--color-paper-2)] text-[var(--color-fg)] border border-[var(--color-rule-2)] hover:bg-[var(--color-paper)] hover:border-[var(--color-fg-dim)]",
        ghost:
          "text-[var(--color-fg-muted)] hover:text-[var(--color-lime)] hover:bg-[var(--color-paper)] border border-transparent",
        outline:
          "bg-transparent text-[var(--color-fg)] border border-[var(--color-rule-2)] hover:border-[var(--color-lime)] hover:text-[var(--color-lime)]",
        danger:
          "bg-transparent text-[var(--color-rust)] border border-[var(--color-rust)]/60 hover:bg-[var(--color-rust)]/10 hover:border-[var(--color-rust)]",
        success:
          "bg-transparent text-[var(--color-lime)] border border-[var(--color-lime)]/60 hover:bg-[var(--color-lime)]/10 hover:border-[var(--color-lime)]",
      },
      size: {
        default: "h-9 px-4",
        sm: "h-7 px-2.5 text-[10px]",
        lg: "h-11 px-6 text-[13px]",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />;
  },
);
Button.displayName = "Button";

export { buttonVariants };
