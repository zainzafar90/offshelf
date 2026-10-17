import { useEffect } from "react";

/* Radix preventDefaults Escape it consumed; skip those. */
export function useEscapeBack(onBack: () => void) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !event.defaultPrevented) onBack();
    }

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onBack]);
}
