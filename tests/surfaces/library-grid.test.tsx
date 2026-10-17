import { act, render } from "@testing-library/react";
import { LibraryGrid } from "../../src/surfaces/library/library-grid";
import { sampleDocument } from "../helpers/fixtures";

test("each card spans grid rows by its measured height so columns pack like masonry", () => {
  const callbacks: (() => void)[] = [];
  const original = globalThis.ResizeObserver;
  globalThis.ResizeObserver = class { constructor(callback: () => void) { callbacks.push(callback); } observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  try {
    const docs = [sampleDocument({ id: "a" }), sampleDocument({ id: "b" })];
    const { container } = render(<LibraryGrid documents={docs} assets={new Map()} layout="grid" page={1} onLoadMore={() => {}} onOpen={() => {}} onStar={() => {}} />);
    const cells = [...container.firstElementChild!.children] as HTMLElement[];
    (cells[0]!.firstElementChild as HTMLElement).getBoundingClientRect = () => ({ height: 388 }) as DOMRect;
    act(() => callbacks.forEach(callback => callback()));
    expect(cells[0]!.style.gridRowEnd).toBe("span 100");
  } finally {
    globalThis.ResizeObserver = original;
  }
});
