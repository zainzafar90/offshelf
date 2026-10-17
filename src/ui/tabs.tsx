import * as React from "react";
import { Tabs as TabsPrimitive } from "radix-ui";
import { cn } from "../lib/utils";
import { focusRing } from "./focus-ring";

export const Tabs = TabsPrimitive.Root;

export const TabsContent = TabsPrimitive.Content;

export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn("flex gap-0.5 border-b border-border px-[18px]", className)} {...props} />;
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "-mb-px h-[34px] border-b-2 border-transparent px-2.5 text-[12.5px] text-muted-foreground data-[state=active]:border-foreground data-[state=active]:font-medium data-[state=active]:text-foreground",
        focusRing,
        className,
      )}
      {...props}
    />
  );
}
