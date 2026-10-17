import { act, renderHook } from "@testing-library/react";
import { useReadingProgress } from "../../src/surfaces/reader/use-reading-progress";

function makeScroller(): HTMLElement {
  const scroller = document.createElement("div");
  Object.defineProperty(scroller, "scrollHeight", { value: 1000, configurable: true });
  Object.defineProperty(scroller, "clientHeight", { value: 500, configurable: true });
  Object.defineProperty(scroller, "scrollTop", { value: 0, writable: true, configurable: true });
  return scroller;
}

// Regression test for the round-2 finding: a saved progress
// flows a freshly-persisted doc.progress back in as a new `initialProgress`
// prop. If a scroll happened after the write that delivered that value but
// before it landed here, re-seeding from it would yank the reader backward
// to a position the user has already scrolled past. A real end-to-end
// reproduction needs a debounced write and an IndexedDB-backed refresh to
// race a real scroll event, which isn't reliably deterministic in a test —
// so this drives the same race directly via `rerender`, which is exactly
// what a "stale round trip lands after a further scroll" looks like from
// this hook's point of view.
test("a doc.progress that arrives after a further scroll does not reset progress or scrollTop", async () => {
  const scroller = makeScroller();
  const save = vi.fn(async () => {});

  const { result, rerender } = renderHook(
    ({ initialProgress }) => useReadingProgress("doc-1", scroller, initialProgress, save),
    { initialProps: { initialProgress: 0.2 } },
  );

  // Let the mount-time restore (0 < 0.2 < 0.98, no images to decode) settle.
  await act(async () => { await Promise.resolve(); });

  // The user scrolls to 80% — this is the position whose debounced write
  // will eventually round-trip back as a new `initialProgress` prop.
  scroller.scrollTop = 400;
  act(() => scroller.dispatchEvent(new Event("scroll")));
  expect(result.current).toBeCloseTo(0.8);

  // Before that write's refresh lands, the user keeps reading further.
  scroller.scrollTop = 475;
  act(() => scroller.dispatchEvent(new Event("scroll")));
  expect(result.current).toBeCloseTo(0.95);

  // The 80% write's refresh now delivers doc.progress back — stale relative
  // to where the user actually is.
  rerender({ initialProgress: 0.8 });

  expect(result.current).toBeCloseTo(0.95);
  expect(scroller.scrollTop).toBe(475);
});

test("switching documents (a new docId) still seeds progress and restores scroll", async () => {
  const scroller = makeScroller();
  const save = vi.fn(async () => {});

  const { result, rerender } = renderHook(
    ({ docId, initialProgress }) => useReadingProgress(docId, scroller, initialProgress, save),
    { initialProps: { docId: "doc-1", initialProgress: 0.8 } },
  );
  await act(async () => { await Promise.resolve(); });
  expect(result.current).toBeCloseTo(0.8);
  expect(scroller.scrollTop).toBe(400);

  rerender({ docId: "doc-2", initialProgress: 0.4 });
  await act(async () => { await Promise.resolve(); });

  expect(result.current).toBeCloseTo(0.4);
  expect(scroller.scrollTop).toBe(200);
});

function scrollTo(scroller: HTMLElement, top: number) {
  scroller.scrollTop = top;
  act(() => scroller.dispatchEvent(new Event("scroll")));
}

describe("saving", () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] }));
  afterEach(() => vi.useRealTimers());

  test("saves the latest value once, 300ms after scrolling stops", () => {
    const scroller = makeScroller();
    const save = vi.fn(async () => {});
    renderHook(() => useReadingProgress("doc-1", scroller, 0, save));
    scrollTo(scroller, 100);
    act(() => { vi.advanceTimersByTime(200); });
    scrollTo(scroller, 200);
    act(() => { vi.advanceTimersByTime(299); });
    expect(save).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("doc-1", { progress: 0.4 });
  });

  test("passing 97% also marks the document read", () => {
    const scroller = makeScroller();
    const save = vi.fn(async () => {});
    renderHook(() => useReadingProgress("doc-1", scroller, 0, save));
    scrollTo(scroller, 490);
    act(() => { vi.advanceTimersByTime(300); });
    expect(save).toHaveBeenCalledWith("doc-1", { progress: 0.98, read: true });
  });

  test("a pending save is flushed on unmount instead of dropped", () => {
    const scroller = makeScroller();
    const save = vi.fn(async () => {});
    const { unmount } = renderHook(() => useReadingProgress("doc-1", scroller, 0, save));
    scrollTo(scroller, 250);
    expect(save).not.toHaveBeenCalled();
    unmount();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("doc-1", { progress: 0.5 });
    act(() => { vi.advanceTimersByTime(1000); });
    expect(save).toHaveBeenCalledTimes(1);
  });

  test("unmounting after the save already ran does not save again", () => {
    const scroller = makeScroller();
    const save = vi.fn(async () => {});
    const { unmount } = renderHook(() => useReadingProgress("doc-1", scroller, 0, save));
    scrollTo(scroller, 250);
    act(() => { vi.advanceTimersByTime(300); });
    unmount();
    expect(save).toHaveBeenCalledTimes(1);
  });

  test("unmounting without scrolling saves nothing", () => {
    const save = vi.fn(async () => {});
    const { unmount } = renderHook(() => useReadingProgress("doc-1", makeScroller(), 0.3, save));
    unmount();
    expect(save).not.toHaveBeenCalled();
  });

  test("switching documents flushes the pending save to the old document", () => {
    const scroller = makeScroller();
    const save = vi.fn(async () => {});
    const { rerender } = renderHook(
      ({ docId }) => useReadingProgress(docId, scroller, 0, save),
      { initialProps: { docId: "doc-1" } },
    );
    scrollTo(scroller, 250);
    rerender({ docId: "doc-2" });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("doc-1", { progress: 0.5 });
  });
});
