import { Slider as SliderPrimitive } from "radix-ui";
import { cn } from "../lib/utils";
import { focusRing } from "./focus-ring";

type SliderProps = {
  value: number;
  min: number;
  max: number;
  onValueChange: (value: number) => void;
  onValueCommit?: (value: number) => void;
  ariaLabel: string;
};

export function Slider({ value, min, max, onValueChange, onValueCommit, ariaLabel }: SliderProps) {
  return (
    <SliderPrimitive.Root
      value={[value]}
      min={min}
      max={max}
      onValueChange={([next]) => onValueChange(next)}
      onValueCommit={onValueCommit && (([next]) => onValueCommit(next))}
      aria-label={ariaLabel}
      className="relative flex h-3.5 w-[180px] shrink-0 items-center"
    >
      <SliderPrimitive.Track className="relative h-1 w-full grow rounded-full bg-muted">
        <SliderPrimitive.Range className="absolute h-full rounded-full bg-accent" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className={cn("block size-3.5 rounded-full bg-accent", focusRing)} />
    </SliderPrimitive.Root>
  );
}
