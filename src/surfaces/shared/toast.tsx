import * as React from "react";

type Tone = "default" | "error";

type ToastItem = { id: number; message: string; tone: Tone };

let toasts: ToastItem[] = [];
let nextId = 0;
const listeners = new Set<() => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function emit() {
  listeners.forEach((listener) => listener());
}

function dismiss(id: number) {
  const timer = timers.get(id);

  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }

  toasts = toasts.filter((item) => item.id !== id);
  emit();
}

export function toast(message: string, tone: Tone = "default") {
  const id = nextId++;

  toasts = [...toasts, { id, message, tone }];
  emit();
  timers.set(
    id,
    setTimeout(() => dismiss(id), tone === "error" ? 7000 : 4000),
  );

  return id;
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

function getSnapshot() {
  return toasts;
}

export function Toaster() {
  const items = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
      {items.map((item) => (
        <div
          key={item.id}
          role={item.tone === "error" ? "alert" : "status"}
          className="rounded-full bg-primary px-3.5 py-2 text-[12.5px] text-primary-foreground shadow-menu"
        >
          {item.message}
        </div>
      ))}
    </div>
  );
}
