import * as React from "react";
import { Select as SelectPrimitive } from "radix-ui";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "../lib/utils";
import { focusRing } from "./focus-ring";

type SelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: [string, string][];
  ariaLabel: string;
};

export function Select({ value, onValueChange, options, ariaLabel }: SelectProps) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
      <SelectPrimitive.Trigger
        aria-label={ariaLabel}
        className={cn("flex h-[34px] items-center gap-2 whitespace-nowrap rounded-[7px] border border-border bg-card px-2.5 text-[12.5px] text-foreground", focusRing)}
      >
        <SelectPrimitive.Value />
        <SelectPrimitive.Icon className="ml-auto text-muted-foreground">
          <ChevronDown className="size-3" aria-hidden />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content className="z-50 overflow-hidden rounded-lg border border-border bg-card shadow-menu">
          <SelectPrimitive.Viewport className="p-1">
            {options.map(([optionValue, label]) => (
              <SelectPrimitive.Item
                key={optionValue}
                value={optionValue}
                className="flex h-[34px] cursor-default items-center gap-2 rounded-md px-2.5 text-[12.5px] text-foreground outline-none data-[highlighted]:bg-muted-hover"
              >
                <SelectPrimitive.ItemText>{label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="ml-auto">
                  <Check className="size-3.5" aria-hidden />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
