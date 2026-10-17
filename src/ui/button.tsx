import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { cn } from "../lib/utils";
import { Tooltip } from "./tooltip";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[7px] text-[12px] font-medium transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-[15px] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:opacity-90",
        outline: "border border-border bg-card text-secondary hover:border-border-strong hover:text-foreground",
        ghost: "text-muted-foreground hover:bg-muted-hover hover:text-foreground",
        accent: "bg-accent-soft text-accent-soft-foreground hover:bg-accent-soft-hover",
      },
      size: { sm: "h-8 px-3", md: "h-10 px-4 text-[13px]", icon: "size-8" },
    },
    defaultVariants: { variant: "outline", size: "sm" },
  },
);

export type ButtonProps = React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild = false, type = "button", ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  const button = <Comp type={asChild ? undefined : type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
  const label = props["aria-label"];

  return size === "icon" && label ? <Tooltip label={label}>{button}</Tooltip> : button;
}
