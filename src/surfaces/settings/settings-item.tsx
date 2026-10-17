import type { ReactNode } from "react";

type ItemProps = { label: string; helper?: string; children: ReactNode };

export function Item({ label, helper, children }: ItemProps) {
  return (
    <div className="flex items-center gap-4 border-b border-border py-3 last:border-b-0">
      <div className="flex-1">
        <b className="block text-[12.5px] font-medium text-foreground">{label}</b>
        {helper && <small className="text-[12px] text-muted-foreground">{helper}</small>}
      </div>
      {children}
    </div>
  );
}
