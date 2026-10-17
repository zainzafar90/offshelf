import { act, cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import { DEFAULT_SETTINGS } from "../../src/core/model";
import { Toaster } from "../../src/surfaces/shared/toast";
import { useLibrary } from "../../src/surfaces/shared/use-library";
import * as store from "../../src/storage/library-store";
import { db } from "../../src/storage/connection";
import { getDocument, getSettings, putDocument } from "../../src/storage/library-store";
import { sampleDocument } from "../helpers/fixtures";
import { toastCount } from "../helpers/toast-count";

const listeners: ((changes: object, area: string) => void)[] = [];
let sendMessage: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  listeners.length = 0;
  sendMessage = vi.fn(async () => ({ ok: true }));
  vi.stubGlobal("chrome", {
    storage: { onChanged: { addListener: (f: never) => listeners.push(f), removeListener: (f: never) => listeners.splice(listeners.indexOf(f), 1) } },
    runtime: { sendMessage },
  });
  const database = await db();
  await new Promise<void>(resolve => {
    const tx = database.transaction(["documents", "assets", "jobs", "settings"], "readwrite");
    for (const name of ["documents", "assets", "jobs", "settings"]) tx.objectStore(name).clear();
    tx.oncomplete = () => resolve();
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function loaded() {
  const hook = renderHook(() => useLibrary());
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

test("starts loading with default settings and an empty library", async () => {
  const { result } = renderHook(() => useLibrary());
  expect(result.current.loading).toBe(true);
  expect(result.current.documents).toEqual([]);
  expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toBeUndefined();
});

test("saveSettings merges the patch into the current settings, persists, and refreshes state", async () => {
  const { result } = await loaded();
  await act(() => result.current.saveSettings({ theme: "dark" }));
  expect(await getSettings()).toEqual({ ...DEFAULT_SETTINGS, theme: "dark" });
  expect(result.current.settings.theme).toBe("dark");

  await act(() => result.current.saveSettings({ fontSize: 24 }));
  expect(await getSettings()).toEqual({ ...DEFAULT_SETTINGS, theme: "dark", fontSize: 24 });
  expect(result.current.settings).toEqual({ ...DEFAULT_SETTINGS, theme: "dark", fontSize: 24 });
});

test("saveSettings loads previously stored settings as the base", async () => {
  await store.putSettings({ ...DEFAULT_SETTINGS, maxPasses: 55 });
  const { result } = await loaded();
  expect(result.current.settings.maxPasses).toBe(55);
  await act(() => result.current.saveSettings({ openReader: false }));
  expect(await getSettings()).toEqual({ ...DEFAULT_SETTINGS, maxPasses: 55, openReader: false });
});

test("a failing saveSettings after load toasts and leaves stored settings alone without an error panel", async () => {
  const { result } = await loaded();
  vi.spyOn(store, "putSettings").mockRejectedValueOnce(new Error("Quota exceeded"));
  render(<Toaster />);
  await act(() => result.current.saveSettings({ theme: "dark" }));
  expect(result.current.error).toBeUndefined();
  expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
  expect(await screen.findByText("Quota exceeded")).toBeInTheDocument();
});

test("update persists the patch, keeps id and source URL, and refreshes the documents", async () => {
  await putDocument(sampleDocument({ id: "u1", sourceUrl: "https://example.com/post" }));
  const { result } = await loaded();
  await act(() => result.current.update("u1", { tags: ["x"], read: true, id: "other", sourceUrl: "https://evil.example/" }));
  const stored = await getDocument("u1");
  expect(stored).toMatchObject({ id: "u1", sourceUrl: "https://example.com/post", tags: ["x"], read: true });
  expect(result.current.documents.find(doc => doc.id === "u1")).toMatchObject({ tags: ["x"], read: true });
});

test("update on a missing document toasts the error and resolves false, without an error panel", async () => {
  const { result } = await loaded();
  render(<Toaster />);
  const before = toastCount("This document is no longer in your library.");
  let updated!: boolean;
  await act(async () => { updated = await result.current.update("nope", { starred: true }); });
  expect(updated).toBe(false);
  expect(result.current.error).toBeUndefined();
  expect(toastCount("This document is no longer in your library.")).toBe(before + 1);
});

test("remove refreshes the library after the worker deletes", async () => {
  await putDocument(sampleDocument({ id: "r1" }));
  const { result } = await loaded();
  const list = vi.spyOn(store, "listDocuments");
  await act(async () => { await result.current.remove("r1"); });
  expect(sendMessage).toHaveBeenCalledWith({ type: "offshelf:delete", documentId: "r1" });
  expect(list).toHaveBeenCalledTimes(1);
});

test("a failed remove toasts the worker error and does not refresh", async () => {
  const { result } = await loaded();
  render(<Toaster />);
  const list = vi.spyOn(store, "listDocuments");
  sendMessage.mockResolvedValueOnce({ ok: false, error: "Delete refused" });
  let ok!: boolean;
  await act(async () => { ok = await result.current.remove("x"); });
  expect(ok).toBe(false);
  expect(list).not.toHaveBeenCalled();
  expect(await screen.findByText("Delete refused")).toBeInTheDocument();
});

test("a failing initial load sets the error, stops loading and toasts", async () => {
  vi.spyOn(store, "listDocuments").mockRejectedValueOnce(new Error("Library unreadable"));
  const { result } = renderHook(() => useLibrary());
  render(<Toaster />);
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toBe("Library unreadable");
  expect(await screen.findByText("Library unreadable")).toBeInTheDocument();
});

test("a later successful refresh clears the error", async () => {
  vi.spyOn(store, "listDocuments").mockRejectedValueOnce(new Error("Flaky read"));
  const { result } = renderHook(() => useLibrary());
  await waitFor(() => expect(result.current.error).toBe("Flaky read"));
  await act(() => result.current.refresh());
  expect(result.current.error).toBeUndefined();
  expect(result.current.loading).toBe(false);
});

test("storage changes outside the local area do not refresh", async () => {
  const { result } = await loaded();
  await putDocument(sampleDocument({ id: "late" }));
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  try {
    act(() => listeners.forEach(listener => listener({}, "sync")));
    act(() => { vi.advanceTimersByTime(500); });
  } finally {
    vi.useRealTimers();
  }
  expect(result.current.documents.map(doc => doc.id)).not.toContain("late");
});

test("a burst of local storage changes refreshes once after 100ms", async () => {
  const { result } = await loaded();
  const list = vi.spyOn(store, "listDocuments");
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  try {
    act(() => { listeners.forEach(listener => listener({}, "local")); listeners.forEach(listener => listener({}, "local")); });
    act(() => { vi.advanceTimersByTime(99); });
    expect(list).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
  } finally {
    vi.useRealTimers();
  }
  await waitFor(() => expect(list).toHaveBeenCalledTimes(1));
  expect(result.current.loading).toBe(false);
});

test("update resolves true after persisting", async () => {
  await putDocument(sampleDocument({ id: "ok1" }));
  const { result } = await loaded();
  let updated!: boolean;
  await act(async () => { updated = await result.current.update("ok1", { starred: true }); });
  expect(updated).toBe(true);
});

test("two saveSettings calls without awaiting between persist both fields", async () => {
  const { result } = await loaded();
  await act(async () => {
    const first = result.current.saveSettings({ theme: "dark" });
    const second = result.current.saveSettings({ fontSize: 24 });
    await Promise.all([first, second]);
  });
  expect(await getSettings()).toEqual({ ...DEFAULT_SETTINGS, theme: "dark", fontSize: 24 });
  expect(result.current.settings).toEqual({ ...DEFAULT_SETTINGS, theme: "dark", fontSize: 24 });
});

test("a failed saveSettings does not block the next one", async () => {
  const { result } = await loaded();
  vi.spyOn(store, "putSettings").mockRejectedValueOnce(new Error("Quota exceeded"));
  await act(async () => {
    const first = result.current.saveSettings({ theme: "dark" });
    const second = result.current.saveSettings({ fontSize: 24 });
    await Promise.all([first, second]);
  });
  expect(await getSettings()).toEqual({ ...DEFAULT_SETTINGS, fontSize: 24 });
});

test("saveProgress patches that one document in state without reloading the library", async () => {
  await putDocument(sampleDocument({ id: "p1", progress: 0 }));
  await putDocument(sampleDocument({ id: "p2", progress: 0.1 }));
  const { result } = await loaded();
  const assets = vi.spyOn(store, "listAssets");
  const documents = vi.spyOn(store, "listDocuments");

  await act(() => result.current.saveProgress("p1", { progress: 0.99, read: true }));

  expect(await getDocument("p1")).toMatchObject({ progress: 0.99, read: true });
  expect(result.current.documents.find(doc => doc.id === "p1")).toMatchObject({ progress: 0.99, read: true });
  expect(result.current.documents.find(doc => doc.id === "p2")?.progress).toBe(0.1);
  expect(assets).not.toHaveBeenCalled();
  expect(documents).not.toHaveBeenCalled();
});

test("saveProgress for a document no longer in the library is skipped quietly", async () => {
  const { result } = await loaded();
  render(<Toaster />);
  const before = toastCount("This document is no longer in your library.");
  await act(() => result.current.saveProgress("gone", { progress: 0.5 }));
  expect(toastCount("This document is no longer in your library.")).toBe(before);
  expect(await getDocument("gone")).toBeUndefined();
});

test("a failing saveProgress toasts without turning the library into an error view", async () => {
  await putDocument(sampleDocument({ id: "pf" }));
  const { result } = await loaded();
  render(<Toaster />);
  vi.spyOn(store, "updateDocument").mockRejectedValueOnce(new Error("Progress not saved"));
  await act(() => result.current.saveProgress("pf", { progress: 0.4 }));
  expect(await screen.findByText("Progress not saved")).toBeInTheDocument();
  expect(result.current.error).toBeUndefined();
  expect(result.current.documents.map(doc => doc.id)).toEqual(["pf"]);
});

test("a refresh that fails after data loaded keeps the documents and only toasts", async () => {
  await putDocument(sampleDocument({ id: "keep" }));
  const { result } = await loaded();
  render(<Toaster />);
  vi.spyOn(store, "listDocuments").mockRejectedValueOnce(new Error("Refresh broke"));
  await act(() => result.current.refresh());
  expect(result.current.error).toBeUndefined();
  expect(result.current.loading).toBe(false);
  expect(result.current.documents.map(doc => doc.id)).toEqual(["keep"]);
  expect(await screen.findByText("Refresh broke")).toBeInTheDocument();
});
