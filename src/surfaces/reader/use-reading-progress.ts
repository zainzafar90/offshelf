import { useEffect, useRef, useState } from "react";
import type { ProgressPatch } from "../shared/use-library";

type SaveProgress = (id: string, patch: ProgressPatch) => Promise<void>;

const SAVE_DELAY_MS = 300;
const READ_THRESHOLD = 0.97;
const RESTORE_MAX = 0.98;

function patchFor(value: number): ProgressPatch {
  return value > READ_THRESHOLD ? { progress: value, read: true } : { progress: value };
}

/* initialProgress and save stay in refs; seeds once per docId. */
export function useReadingProgress(docId: string, scroller: HTMLElement | null, initialProgress: number, save: SaveProgress): number {
  const [progress, setProgress] = useState(initialProgress);
  const initialProgressRef = useRef(initialProgress);
  const saveRef = useRef(save);

  saveRef.current = save;

  useEffect(() => {
    initialProgressRef.current = initialProgress;
    setProgress(initialProgress);
    /* Only docId re-arms this. */
  }, [docId]);

  useEffect(() => {
    if (!scroller) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pending: number | undefined;
    const seed = initialProgressRef.current;

    if (seed > 0 && seed < RESTORE_MAX) {
      const images = [...scroller.querySelectorAll("img")];

      void Promise.all(images.map(image => image.decode().catch(() => {}))).then(() => {
        if (cancelled) return;

        const max = scroller.scrollHeight - scroller.clientHeight;

        if (max > 0) scroller.scrollTop = max * seed;
      });
    }

    const flush = () => {
      clearTimeout(timer);

      if (pending === undefined) return;

      const value = pending;

      pending = undefined;
      void saveRef.current(docId, patchFor(value));
    };

    const onScroll = () => {
      const max = scroller.scrollHeight - scroller.clientHeight;
      const value = max > 0 ? Math.min(1, Math.max(0, scroller.scrollTop / max)) : 0;

      setProgress(value);
      pending = value;
      clearTimeout(timer);
      timer = setTimeout(flush, SAVE_DELAY_MS);
    };

    scroller.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      cancelled = true;
      scroller.removeEventListener("scroll", onScroll);
      flush();
    };
    /* Only docId/scroller re-arm this. */
  }, [docId, scroller]);

  return progress;
}
