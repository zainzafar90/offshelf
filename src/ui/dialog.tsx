import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "../lib/utils";
import { focusRing } from "./focus-ring";

export const Dialog = DialogPrimitive.Root;


type DialogContentProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
};

export function DialogContent({ title, description, children, className }: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-overlay" />
      <DialogPrimitive.Content
        className={cn(
          "fixed top-1/2 left-1/2 z-50 w-[560px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[14px] border border-border bg-card shadow-dialog",
          className,
        )}
      >
        <div className="flex items-center px-[18px] pt-4 pb-3">
          <div>
            <DialogPrimitive.Title className="m-0 text-[15px] font-semibold text-foreground">{title}</DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-0.5 text-[12.5px] text-muted-foreground">
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>
          <DialogPrimitive.Close
            aria-label="Close"
            className={cn("ml-auto grid size-7 shrink-0 place-items-center rounded-[7px] text-muted-foreground hover:bg-muted-hover hover:text-foreground", focusRing)}
          >
            <X className="size-[15px]" aria-hidden />
          </DialogPrimitive.Close>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
