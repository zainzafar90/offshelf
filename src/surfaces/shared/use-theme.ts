import { useEffect } from "react";
import type { Settings } from "../../core/model";

export function useTheme(theme: Settings["theme"]): void {
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && media.matches);

      document.documentElement.dataset.theme = dark ? "dark" : "light";
    };

    apply();

    if (theme !== "system") return;

    media.addEventListener("change", apply);

    return () => media.removeEventListener("change", apply);
  }, [theme]);
}
