import type { RefObject } from "react";
import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import type { SavedDocument } from "../../core/model";
import { cn } from "../../lib/utils";

type OutlineTarget = { id: string; label: string };

type ReaderOutlineProps = {
  doc: SavedDocument;
  contentRef: RefObject<HTMLElement | null>;
  scroller: HTMLElement | null;
};

function collectTargets(doc: SavedDocument, content: HTMLElement): OutlineTarget[] {
  if (doc.kind === "thread") {
    return [...content.querySelectorAll<HTMLElement>("[data-thread-post]")].map((element, index) => ({
      id: element.id, label: `Post ${String(index + 1).padStart(2, "0")}`,
    }));
  }

  return [...content.querySelectorAll<HTMLElement>("[data-reader-prose] h2, [data-reader-prose] h3")].map(element => ({
    id: element.id, label: element.textContent || "Section",
  }));
}

// Highlights the target whose top has scrolled within 180px of the scroller's
// own top edge — the same threshold the vanilla reader used against the window.
export function ReaderOutline({ doc, contentRef, scroller }: ReaderOutlineProps) {
  const [targets, setTargets] = useState<OutlineTarget[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (contentRef.current) setTargets(collectTargets(doc, contentRef.current));
  }, [doc, contentRef]);

  useEffect(() => {
    if (!scroller) return;

    const onScroll = () => {
      const scrollerTop = scroller.getBoundingClientRect().top;
      let active: string | null = null;

      for (const target of targets) {
        const element = document.getElementById(target.id);

        if (element && element.getBoundingClientRect().top - scrollerTop <= 180) active = target.id;
      }

      setActiveId(active);
    };

    onScroll();
    scroller.addEventListener("scroll", onScroll, { passive: true });

    return () => scroller.removeEventListener("scroll", onScroll);
  }, [scroller, targets]);

  const scrollTo = (id: string | null) => {
    const element = id ? document.getElementById(id) : contentRef.current;

    element?.scrollIntoView({ behavior: "auto", block: "start" });
  };

  const linkClass = (active: boolean) => cn("truncate rounded-[6px] px-2 py-1 text-[12px]", active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground");

  return (
    <aside className="hidden w-[220px] shrink-0 overflow-auto border-l border-border px-4 py-6 min-[1200px]:block">
      <nav aria-label={doc.kind === "thread" ? "Thread posts" : "On this page"} className="flex flex-col gap-0.5">
        <p className="mb-2 text-[11px] font-medium tracking-wide text-muted-foreground">{doc.kind === "thread" ? "IN THIS THREAD" : "ON THIS PAGE"}</p>
        <a href={`#${targets[0]?.id ?? ""}`} aria-current={activeId === null ? "location" : undefined} onClick={event => { event.preventDefault(); scrollTo(null); }} className={linkClass(activeId === null)}>
          {doc.kind === "thread" ? "Overview" : "Introduction"}
        </a>
        {targets.map(target => (
          <a key={target.id} href={`#${target.id}`} aria-current={activeId === target.id ? "location" : undefined} onClick={event => { event.preventDefault(); scrollTo(target.id); }} className={linkClass(activeId === target.id)}>
            {target.label}
          </a>
        ))}
      </nav>
      <div className="mt-6 flex flex-col gap-1 border-t border-border pt-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><Lock className="size-3" aria-hidden />Saved on this device</span>
        <span className="tabular-nums">{doc.wordCount.toLocaleString()} words · {doc.readingMinutes} min read</span>
      </div>
    </aside>
  );
}
