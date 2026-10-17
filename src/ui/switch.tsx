import { Switch as SwitchPrimitive } from "radix-ui";
import { cn } from "../lib/utils";
import { focusRing } from "./focus-ring";

type SwitchProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  ariaLabel: string;
};

export function Switch({ checked, onCheckedChange, ariaLabel }: SwitchProps) {
  return (
    <SwitchPrimitive.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      aria-label={ariaLabel}
      className={cn("relative h-[18px] w-[32px] shrink-0 rounded-full bg-border-strong transition-colors data-[state=checked]:bg-accent", focusRing)}
    >
      <SwitchPrimitive.Thumb className="absolute top-[2px] left-[2px] block size-[14px] rounded-full bg-switch-thumb shadow-thumb transition-transform data-[state=checked]:translate-x-[14px]" />
    </SwitchPrimitive.Root>
  );
}
