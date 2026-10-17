import * as React from "react";
import { cn } from "../lib/utils";

type SegmentedOption = [value: string, label: string, icon?: React.ReactNode];

type SegmentedProps = {
  value: string;
  options: SegmentedOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  fit?: "fill" | "content";
  className?: string;
};

export function Segmented({ value, options, onChange, ariaLabel, fit = "fill", className }: SegmentedProps) {
  const isFill = fit === "fill";

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(isFill ? "flex" : "inline-flex", "gap-0.5 rounded-lg bg-muted p-0.5", className)}
    >
      {options.map(([optionValue, label, icon]) => (
        <button
          key={optionValue}
          type="button"
          aria-pressed={optionValue === value}
          onClick={() => onChange(optionValue)}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-md px-2.5 text-[12px] text-muted-foreground aria-pressed:bg-card aria-pressed:font-medium aria-pressed:text-foreground",
            isFill ? "h-8 flex-1" : "h-[30px]",
          )}
        >
          {icon}
          {label}
        </button>
      ))}
    </div>
  );
}
