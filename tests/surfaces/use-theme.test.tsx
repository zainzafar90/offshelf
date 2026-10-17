import { renderHook } from "@testing-library/react";
import { useTheme } from "../../src/surfaces/shared/use-theme";

test("follows prefers-color-scheme changes", () => {
  let listener: ((e: { matches: boolean }) => void) | undefined;
  let dark = false;
  globalThis.matchMedia = ((q: string) => ({ get matches() { return dark; }, media: q, addEventListener: (_: string, f: typeof listener) => { listener = f; }, removeEventListener: () => { listener = undefined; } })) as unknown as typeof matchMedia;
  const { rerender, unmount } = renderHook(({ t }) => useTheme(t), { initialProps: { t: "system" as const } });
  expect(document.documentElement.dataset.theme).toBe("light");
  dark = true; listener?.({ matches: true });
  expect(document.documentElement.dataset.theme).toBe("dark");
  rerender({ t: "light" as never });
  expect(document.documentElement.dataset.theme).toBe("light");
  unmount();
});
