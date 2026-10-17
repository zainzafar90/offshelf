import { act, render } from "@testing-library/react";
import { AnimatedHeight } from "../../src/ui/animated-height";

test("follows its content's height so the change can animate", () => {
  let notify = () => {};
  const original = globalThis.ResizeObserver;
  globalThis.ResizeObserver = class { constructor(callback: () => void) { notify = callback; } observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  try {
    const { container } = render(<AnimatedHeight><p>content</p></AnimatedHeight>);
    const outer = container.firstElementChild as HTMLElement;
    Object.defineProperty(outer.firstElementChild, "offsetHeight", { configurable: true, value: 123 });
    act(() => notify());
    expect(outer.style.height).toBe("123px");
  } finally {
    globalThis.ResizeObserver = original;
  }
});
