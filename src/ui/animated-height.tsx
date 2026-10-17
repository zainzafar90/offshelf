import * as React from "react";
import { cn } from "../lib/utils";

export function AnimatedHeight({ className, children }: { className?: string; children: React.ReactNode }) {
  const inner = React.useRef<HTMLDivElement>(null);
  const [height, setHeight] = React.useState<number>();

  React.useLayoutEffect(() => {
    const element = inner.current;

    if (!element) return;

    const observer = new ResizeObserver(() => setHeight(element.offsetHeight));

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return (
    <div style={{ height }} className="overflow-hidden transition-[height] duration-200 ease-out motion-reduce:transition-none">
      <div ref={inner} className={className}>{children}</div>
    </div>
  );
}
