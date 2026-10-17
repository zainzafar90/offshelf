import { renderHook, waitFor, act } from "@testing-library/react";
import { useLibrary } from "../../src/surfaces/shared/use-library";
import * as store from "../../src/storage/library-store";
import { putDocument, getDocument } from "../../src/storage/library-store";
import { sampleDocument } from "../helpers/fixtures";

const listeners: ((changes: object, area: string) => void)[] = [];
beforeEach(() => {
  listeners.length = 0;
  globalThis.chrome = {
    storage: { onChanged: { addListener: (f: never) => listeners.push(f), removeListener: (f: never) => listeners.splice(listeners.indexOf(f), 1) } },
    runtime: { sendMessage: vi.fn(async () => ({ ok: true })) },
  } as unknown as typeof chrome;
});

test("loads documents and settings, updates a document, and reloads on storage change", async () => {
  await putDocument(sampleDocument({ id: "one" }));
  const { result, unmount } = renderHook(() => useLibrary());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.documents.map(d => d.id)).toContain("one");
  expect(result.current.settings.fontSize).toBe(20);

  await act(() => result.current.update("one", { starred: true }));
  expect((await getDocument("one"))?.starred).toBe(true);
  expect(result.current.documents.find(d => d.id === "one")?.starred).toBe(true);

  await putDocument(sampleDocument({ id: "two" }));
  act(() => listeners.forEach(f => f({}, "local")));
  await waitFor(() => expect(result.current.documents.map(d => d.id)).toContain("two"));

  unmount();
  expect(listeners).toHaveLength(0);
});

test("a slow refresh that resolves after a newer one does not overwrite it with stale data", async () => {
  await putDocument(sampleDocument({ id: "old" }));
  const { result } = renderHook(() => useLibrary());
  await waitFor(() => expect(result.current.loading).toBe(false));

  let resolveStale!: (docs: ReturnType<typeof sampleDocument>[]) => void;
  const stale = new Promise<ReturnType<typeof sampleDocument>[]>(resolve => { resolveStale = resolve; });
  const spy = vi.spyOn(store, "listDocuments")
    .mockImplementationOnce(() => stale)
    .mockImplementationOnce(async () => [sampleDocument({ id: "new" })]);

  let staleRefresh!: Promise<void>;
  await act(async () => {
    staleRefresh = result.current.refresh();
    await result.current.refresh();
  });
  expect(result.current.documents.map(d => d.id)).toEqual(["new"]);

  await act(async () => {
    resolveStale([sampleDocument({ id: "old" })]);
    await staleRefresh;
  });

  expect(result.current.documents.map(d => d.id)).toEqual(["new"]);
  spy.mockRestore();
});

test("remove asks the worker to delete and reports success", async () => {
  const { result } = renderHook(() => useLibrary());
  await waitFor(() => expect(result.current.loading).toBe(false));
  let succeeded!: boolean;
  await act(async () => { succeeded = await result.current.remove("gone"); });
  expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: "offshelf:delete", documentId: "gone" });
  expect(succeeded).toBe(true);
  expect(result.current.error).toBeUndefined();
});

test("a failed remove reports false without turning the library into an error view", async () => {
  const { result } = renderHook(() => useLibrary());
  await waitFor(() => expect(result.current.loading).toBe(false));
  (chrome.runtime.sendMessage as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, error: "Storage is full." });
  let succeeded!: boolean;
  await act(async () => { succeeded = await result.current.remove("gone"); });
  expect(succeeded).toBe(false);
  expect(result.current.error).toBeUndefined();
});
