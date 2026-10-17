import { cn } from "../lib/utils";

export function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return <kbd className={cn("rounded border border-border bg-card px-1.5 font-sans text-[10.5px] font-medium text-muted-foreground", className)} {...props} />;
}
