import * as React from "react";
import { Tooltip as TooltipPrimitive } from "radix-ui";

type TooltipProps = {
  label: string;
  children: React.ReactElement;
};

export function Tooltip({ label, children }: TooltipProps) {
  return (
    <TooltipPrimitive.Provider delayDuration={300}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content sideOffset={6} className="z-50 rounded-md bg-primary px-2 py-1 text-[11.5px] text-primary-foreground">
            {label}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
