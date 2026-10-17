import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SavedDocument } from "../../src/core/model";
import { LibraryPage } from "../../src/surfaces/library/library-page";
import { Toaster } from "../../src/surfaces/shared/toast";
import * as store from "../../src/storage/library-store";
import { db } from "../../src/storage/connection";
import { deleteDocument, getDocument, listDocuments, putDocument } from "../../src/storage/library-store";
import { putJob } from "../../src/storage/job-store";
import { sampleDocument } from "../helpers/fixtures";
import { toastCount } from "../helpers/toast-count";

async function clearStores() {
  const database = await db();
  await new Promise<void>(resolve => {
    const tx = database.transaction(["documents", "assets", "jobs", "settings"], "readwrite");
    for (const name of ["documents", "assets", "jobs", "settings"]) tx.objectStore(name).clear();
    tx.oncomplete = () => resolve();
  });
}

beforeEach(async () => {
  vi.stubGlobal("chrome", {
    storage: { onChanged: { addListener() {}, removeListener() {} } },
    runtime: { sendMessage: vi.fn(async () => ({ ok: true })), getURL: (p: string) => `chrome-extension://id/${p}` },
  });
  vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:test/1");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  localStorage.clear();
  history.replaceState(null, "", "/library.html");
  await clearStores();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const articles = () => screen.queryAllByRole("article");

test("while loading, the shell shows but no empty state, error or cards", async () => {
  let release!: (docs: SavedDocument[]) => void;
  vi.spyOn(store, "listDocuments").mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  render(<LibraryPage />);
  expect(screen.getByRole("searchbox")).toBeInTheDocument();
  expect(screen.queryByText("Keep something worth reading.")).toBeNull();
  expect(screen.queryByText("No reads found")).toBeNull();
  expect(screen.queryByText(/could not open the library/)).toBeNull();
  expect(articles()).toHaveLength(0);

  await act(async () => release([sampleDocument({ id: "late", title: "Arrived late" })]));
  expect(await screen.findByText("Arrived late")).toBeInTheDocument();
});

test("a failing load shows the error panel and a toast; Try again recovers", async () => {
  await putDocument(sampleDocument({ id: "ok", title: "Recovered read" }));
  vi.spyOn(store, "listDocuments").mockRejectedValueOnce(new Error("Disk went away"));
  render(<><LibraryPage /><Toaster /></>);
  expect(await screen.findByText("Offshelf could not open the library: Disk went away")).toBeInTheDocument();
  expect(screen.getAllByRole("alert").map(alert => alert.textContent)).toContain("Disk went away");
  expect(articles()).toHaveLength(0);
  expect(screen.queryByText("Keep something worth reading.")).toBeNull();

  await userEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText("Recovered read")).toBeInTheDocument();
  expect(screen.queryByText(/could not open the library/)).toBeNull();
});

test("an empty library shows the first-run state with both actions", async () => {
  render(<LibraryPage />);
  expect(await screen.findByText("Keep something worth reading.")).toBeInTheDocument();
  expect(screen.getByText("Your library starts here")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Save your first page" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Try the reader" })).toBeInTheDocument();
  expect(screen.getByText("0 saved")).toBeInTheDocument();
});

test("Save your first page opens the how-to-save dialog", async () => {
  render(<LibraryPage />);
  await userEvent.click(await screen.findByRole("button", { name: "Save your first page" }));
  expect(await screen.findByRole("dialog", { name: "Save a page" })).toBeInTheDocument();
});

test("the title bar's Save page button opens the how-to-save dialog", async () => {
  render(<LibraryPage />);
  await userEvent.click(await screen.findByRole("button", { name: /Save page/ }));
  expect(await screen.findByRole("dialog", { name: "Save a page" })).toBeInTheDocument();
});

test("Try the reader adds the samples, toasts, and lists them", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, blob: async () => new Blob(["png"], { type: "image/png" }) })));
  render(<><LibraryPage /><Toaster /></>);
  await userEvent.click(await screen.findByRole("button", { name: "Try the reader" }));
  expect(await screen.findByText("Added six original reading samples. All are labeled Sample.")).toBeInTheDocument();
  expect((await listDocuments()).length).toBeGreaterThanOrEqual(6);
  await waitFor(() => expect(articles().length).toBeGreaterThan(0));
  expect(screen.queryByText("Keep something worth reading.")).toBeNull();
});

test("Try the reader toasts the error when the sample cover cannot be loaded", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("Sample cover unavailable"); }));
  render(<><LibraryPage /><Toaster /></>);
  await userEvent.click(await screen.findByRole("button", { name: "Try the reader" }));
  expect(await screen.findByText("Sample cover unavailable")).toBeInTheDocument();
  expect(screen.getByText("Keep something worth reading.")).toBeInTheDocument();
});

test("a search with no match shows the filtered empty state with a search hint", async () => {
  await putDocument(sampleDocument({ id: "a", title: "Slow software" }));
  render(<LibraryPage />);
  await screen.findByText("Slow software");
  await userEvent.type(screen.getByRole("searchbox"), "zzzz");
  expect(screen.getByText("No reads found")).toBeInTheDocument();
  expect(screen.getByText("Try a different title, author, or phrase.")).toBeInTheDocument();
  expect(screen.queryByText("Keep something worth reading.")).toBeNull();
  expect(screen.getByText("0 saved")).toBeInTheDocument();
});

test("a view with no matches shows the filtered empty state with a view hint", async () => {
  await putDocument(sampleDocument({ id: "a", title: "Slow software", starred: false }));
  render(<LibraryPage />);
  await screen.findByText("Slow software");
  const nav = screen.getByRole("navigation", { name: "Library views" });
  await userEvent.click(within(nav).getByRole("button", { name: /Starred/ }));
  expect(await screen.findByText("No reads found")).toBeInTheDocument();
  expect(screen.getByText("Saved pages matching this view will appear here.")).toBeInTheDocument();
});

test("populated library lists every document with the saved count", async () => {
  await putDocument(sampleDocument({ id: "a", title: "First read" }));
  await putDocument(sampleDocument({ id: "b", title: "Second read", kind: "thread" }));
  render(<LibraryPage />);
  expect(await screen.findByText("First read")).toBeInTheDocument();
  expect(screen.getByRole("article", { name: "Second read" })).toBeInTheDocument();
  expect(articles()).toHaveLength(2);
  expect(screen.getByText("2 saved")).toBeInTheDocument();
  expect(screen.queryByText("No reads found")).toBeNull();
});

test("clicking a card opens the reader and pushes ?id=; Back to library closes it", async () => {
  await putDocument(sampleDocument({ id: "open1", title: "Open me" }));
  render(<LibraryPage />);
  await userEvent.click(await screen.findByRole("link", { name: "Open me" }));
  expect(await screen.findByRole("heading", { level: 1, name: "Open me" })).toBeInTheDocument();
  expect(location.search).toBe("?id=open1");
  expect(screen.queryByRole("searchbox")).toBeNull();

  await userEvent.click(screen.getByRole("button", { name: "Back to library" }));
  expect(await screen.findByRole("searchbox")).toBeInTheDocument();
  expect(location.search).toBe("");
});

test("the browser Back button (popstate) closes the reader", async () => {
  await putDocument(sampleDocument({ id: "pop1", title: "Pop me" }));
  render(<LibraryPage />);
  await userEvent.click(await screen.findByRole("link", { name: "Pop me" }));
  await screen.findByRole("heading", { level: 1, name: "Pop me" });

  act(() => history.back());
  expect(await screen.findByRole("searchbox")).toBeInTheDocument();
  expect(screen.queryByRole("heading", { level: 1, name: "Pop me" })).toBeNull();
});

test("popstate to a ?id= URL opens that document", async () => {
  await putDocument(sampleDocument({ id: "fwd1", title: "Forward read" }));
  render(<LibraryPage />);
  await screen.findByText("Forward read");
  act(() => {
    history.replaceState(null, "", "/library.html?id=fwd1");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  expect(await screen.findByRole("heading", { level: 1, name: "Forward read" })).toBeInTheDocument();
});

test("a deep link ?id= opens the reader without flashing the library", async () => {
  await putDocument(sampleDocument({ id: "deep1", title: "Deep read" }));
  history.replaceState(null, "", "/library.html?id=deep1");
  render(<LibraryPage />);
  expect(screen.queryByRole("searchbox")).toBeNull();
  expect(await screen.findByRole("heading", { level: 1, name: "Deep read" })).toBeInTheDocument();
  expect(location.search).toBe("?id=deep1");
});

test("a stale ?id= toasts, drops the param and shows the library", async () => {
  await putDocument(sampleDocument({ id: "real", title: "Still here" }));
  history.replaceState(null, "", "/library.html?id=ghost");
  render(<><LibraryPage /><Toaster /></>);
  expect(await screen.findByText("This document is no longer in your library.")).toBeInTheDocument();
  expect(screen.getAllByRole("alert").map(alert => alert.textContent)).toContain("This document is no longer in your library.");
  expect(await screen.findByText("Still here")).toBeInTheDocument();
  expect(location.search).toBe("");
});

test("?settings=reading opens settings once; other ?settings values do not", async () => {
  history.replaceState(null, "", "/library.html?settings=other");
  render(<LibraryPage />);
  await screen.findByRole("searchbox");
  expect(screen.queryByRole("dialog", { name: "Settings" })).toBeNull();
  expect(location.search).toBe("?settings=other");
});

test("?settings=reading keeps other query params", async () => {
  history.replaceState(null, "", "/library.html?settings=reading&id=nope");
  render(<><LibraryPage /><Toaster /></>);
  await screen.findByRole("dialog", { name: "Settings" });
  expect(location.search).not.toContain("settings");
});

test("the sidebar Settings button opens settings on the Reading tab", async () => {
  render(<LibraryPage />);
  await userEvent.click(await screen.findByRole("button", { name: "Settings" }));
  expect(await screen.findByRole("dialog", { name: "Settings" })).toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: "Typeface" })).toBeInTheDocument();
});

test("Import in the title bar opens settings on the Library tab", async () => {
  render(<LibraryPage />);
  await userEvent.click(await screen.findByRole("button", { name: /Import/ }));
  const dialog = await screen.findByRole("dialog", { name: "Settings" });
  expect(within(dialog).getByRole("button", { name: /Export backup/ })).toBeInTheDocument();
});

test("the reader's appearance button opens settings on the Reading tab", async () => {
  await putDocument(sampleDocument({ id: "ap1", title: "Appearance read" }));
  history.replaceState(null, "", "/library.html?id=ap1");
  render(<LibraryPage />);
  await userEvent.click(await screen.findByRole("button", { name: "Reading appearance" }));
  const dialog = await screen.findByRole("dialog", { name: "Settings" });
  expect(within(dialog).getByRole("combobox", { name: "Typeface" })).toBeInTheDocument();
});

test("starring a card updates the document and the card's label", async () => {
  await putDocument(sampleDocument({ id: "st1", title: "Star me" }));
  render(<LibraryPage />);
  await userEvent.click(await screen.findByRole("button", { name: "Star" }));
  await waitFor(async () => expect((await getDocument("st1"))?.starred).toBe(true));
  expect(await screen.findByRole("button", { name: "Unstar" })).toHaveAttribute("aria-pressed", "true");
});

test("layout choice switches to rows and persists in storage", async () => {
  await putDocument(sampleDocument({ id: "l1", title: "Layout read" }));
  const { unmount } = render(<LibraryPage />);
  await screen.findByText("Layout read");
  const layout = screen.getByRole("group", { name: "Layout" });
  expect(within(layout).getByRole("button", { name: "Grid" })).toHaveAttribute("aria-pressed", "true");
  await userEvent.click(within(layout).getByRole("button", { name: "List" }));
  expect(localStorage.getItem("offshelf-layout-v3")).toBe("list");
  unmount();

  render(<LibraryPage />);
  await screen.findByText("Layout read");
  expect(within(screen.getByRole("group", { name: "Layout" })).getByRole("button", { name: "List" })).toHaveAttribute("aria-pressed", "true");
});

test("an unrecognized stored layout falls back to grid", async () => {
  localStorage.setItem("offshelf-layout-v3", "masonry");
  render(<LibraryPage />);
  expect(within(await screen.findByRole("group", { name: "Layout" })).getByRole("button", { name: "Grid" })).toHaveAttribute("aria-pressed", "true");
});

test("running jobs show above the library and a failed job without a document shows its error", async () => {
  await putJob({
    id: "jr", tabId: 1, sourceUrl: "https://example.com", documentId: "none", title: "Broken capture", status: "failed",
    message: "Capture failed", error: "The page changed", createdAt: "2026-09-01T10:00:00.000Z", updatedAt: "", posts: 0, images: 0, savedImages: 0,
    options: { mode: "auto", autoScroll: true, maxPasses: 24 },
  });
  render(<LibraryPage />);
  expect(await screen.findByText("Broken capture")).toBeInTheDocument();
  expect(screen.getByText("The page changed")).toBeInTheDocument();
});

test("the sidebar shows the document count and tag filters", async () => {
  await putDocument(sampleDocument({ id: "tg1", title: "Tagged", tags: ["Design"] }));
  await putDocument(sampleDocument({ id: "tg2", title: "Plain", tags: [] }));
  render(<LibraryPage />);
  await screen.findByText("Tagged");
  expect(screen.getByText(/2 saved ·/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Design" }));
  expect(screen.queryByText("Plain")).toBeNull();
  expect(screen.getByText("Tagged")).toBeInTheDocument();
});

const STALE_LINK = "This document is no longer in your library.";

function stubWorker(handler: (message: { type: string; documentId?: string }, notify: () => void) => Promise<unknown>) {
  const listeners: ((changes: object, area: string) => void)[] = [];
  const notify = () => listeners.forEach(listener => listener({}, "local"));
  vi.stubGlobal("chrome", {
    storage: { onChanged: { addListener: (f: never) => listeners.push(f), removeListener() {} } },
    runtime: { sendMessage: vi.fn((message: never) => handler(message, notify)), getURL: (p: string) => `chrome-extension://id/${p}` },
  });
}

async function deleteOpenDocument() {
  await userEvent.click(await screen.findByRole("button", { name: "Delete saved copy" }));
  const dialog = await screen.findByRole("dialog", { name: "Delete this saved read?" });
  await userEvent.click(within(dialog).getByRole("button", { name: "Delete saved copy" }));
}

test("a successful delete shows only the deleted toast, never the stale-link error", async () => {
  await putDocument(sampleDocument({ id: "del1", title: "Delete me" }));
  await putDocument(sampleDocument({ id: "keep1", title: "Keep me" }));
  /* the worker announces the change, then replies late */
  stubWorker(async (message, notify) => {
    await deleteDocument(message.documentId!);
    notify();
    await new Promise(resolve => setTimeout(resolve, 250));
    return { ok: true };
  });
  history.replaceState(null, "", "/library.html?id=del1");
  render(<><LibraryPage /><Toaster /></>);
  const staleBefore = toastCount(STALE_LINK);
  const deletedBefore = toastCount("Saved copy deleted.");

  await deleteOpenDocument();

  expect(await screen.findByText("Keep me")).toBeInTheDocument();
  expect(screen.queryByText("Delete me")).toBeNull();
  expect(location.search).toBe("");
  expect(toastCount("Saved copy deleted.")).toBe(deletedBefore + 1);
  expect(toastCount(STALE_LINK)).toBe(staleBefore);
});

test("a failed delete keeps the reader open and shows no stale-link error", async () => {
  await putDocument(sampleDocument({ id: "del2", title: "Stubborn read" }));
  stubWorker(async () => ({ ok: false, error: "Delete refused" }));
  history.replaceState(null, "", "/library.html?id=del2");
  render(<><LibraryPage /><Toaster /></>);
  const staleBefore = toastCount(STALE_LINK);

  await deleteOpenDocument();

  expect(await screen.findByText("Delete refused")).toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 1, name: "Stubborn read", hidden: true })).toBeInTheDocument();
  expect(location.search).toBe("?id=del2");
  expect(toastCount(STALE_LINK)).toBe(staleBefore);
});

test("a document deleted elsewhere while open is still reported as a stale link", async () => {
  await putDocument(sampleDocument({ id: "gone1", title: "Vanishing read" }));
  await putDocument(sampleDocument({ id: "other1", title: "Other read" }));
  const listeners: ((changes: object, area: string) => void)[] = [];
  vi.stubGlobal("chrome", {
    storage: { onChanged: { addListener: (f: never) => listeners.push(f), removeListener() {} } },
    runtime: { sendMessage: vi.fn(async () => ({ ok: true })), getURL: (p: string) => `chrome-extension://id/${p}` },
  });
  history.replaceState(null, "", "/library.html?id=gone1");
  render(<><LibraryPage /><Toaster /></>);
  await screen.findByRole("heading", { level: 1, name: "Vanishing read" });
  const before = toastCount(STALE_LINK);

  await deleteDocument("gone1");
  act(() => listeners.forEach(listener => listener({}, "local")));

  expect(await screen.findByText("Other read")).toBeInTheDocument();
  expect(toastCount(STALE_LINK)).toBe(before + 1);
});

test("a refresh that fails after the library loaded keeps the cards and toasts instead of the error panel", async () => {
  await putDocument(sampleDocument({ id: "stay1", title: "Stays visible" }));
  const listeners: ((changes: object, area: string) => void)[] = [];
  vi.stubGlobal("chrome", {
    storage: { onChanged: { addListener: (f: never) => listeners.push(f), removeListener() {} } },
    runtime: { sendMessage: vi.fn(async () => ({ ok: true })), getURL: (p: string) => `chrome-extension://id/${p}` },
  });
  render(<><LibraryPage /><Toaster /></>);
  await screen.findByText("Stays visible");

  vi.spyOn(store, "listDocuments").mockRejectedValueOnce(new Error("Background refresh failed"));
  act(() => listeners.forEach(listener => listener({}, "local")));

  expect(await screen.findByText("Background refresh failed")).toBeInTheDocument();
  expect(screen.getByText("Stays visible")).toBeInTheDocument();
  expect(screen.queryByText(/could not open the library/)).toBeNull();
  expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
});
