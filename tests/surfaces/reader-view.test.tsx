import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LibraryPage } from "../../src/surfaces/library/library-page";
import { Toaster } from "../../src/surfaces/shared/toast";
import { putDocument, getDocument } from "../../src/storage/library-store";
import { sampleDocument } from "../helpers/fixtures";

beforeEach(() => {
  globalThis.chrome = {
    storage: { onChanged: { addListener() {}, removeListener() {} } },
    runtime: { sendMessage: vi.fn(async () => ({ ok: true })), getURL: (p: string) => `chrome-extension://id/${p}` },
  } as unknown as typeof chrome;
});

test("opens a document from the URL, stars it and goes back with Esc", async () => {
  await putDocument(sampleDocument({ id: "r1", title: "Reader test" }));
  history.replaceState(null, "", "/library.html?id=r1");
  render(<LibraryPage />);
  expect(await screen.findByRole("heading", { level: 1, name: "Reader test" })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Star this document" }));
  await waitFor(async () => expect((await getDocument("r1"))?.starred).toBe(true));
  await userEvent.keyboard("{Escape}");
  expect(await screen.findByRole("searchbox")).toBeInTheDocument();
  expect(location.search).toBe("");
});

test("threads render one continuous read with post markers", async () => {
  await putDocument(sampleDocument({ id: "th", kind: "thread", title: "T", sections: [
    { id: "1", sourceUrl: "https://example.com/post", relation: "selected", excluded: false, blocks: [{ type: "paragraph", content: [{ text: "first" }] }] },
    { id: "2", sourceUrl: "https://example.com/post", relation: "candidate", excluded: false, blocks: [{ type: "paragraph", content: [{ text: "second" }] }] },
  ] }));
  history.replaceState(null, "", "/library.html?id=th");
  render(<LibraryPage />);
  expect(await screen.findByText("1 / 2")).toBeInTheDocument();
  expect(screen.getByText("2 / 2")).toBeInTheDocument();
});

test("missing document returns to library", async () => {
  history.replaceState(null, "", "/library.html?id=nope");
  render(<><LibraryPage /><Toaster /></>);
  expect(await screen.findByText("This document is no longer in your library.")).toBeInTheDocument();
  expect(await screen.findByRole("searchbox")).toBeInTheDocument();
});

test("opening a document does not overwrite its saved progress", async () => {
  await putDocument(sampleDocument({ id: "p1", progress: 0.5 }));
  history.replaceState(null, "", "/library.html?id=p1");
  render(<LibraryPage />);
  await screen.findByRole("heading", { level: 1, name: "A title" });
  await new Promise(resolve => setTimeout(resolve, 400));
  expect((await getDocument("p1"))?.progress).toBe(0.5);
});

test("Escape inside the Export menu closes the menu, not the reader", async () => {
  await putDocument(sampleDocument({ id: "r2", title: "Reader test 2" }));
  history.replaceState(null, "", "/library.html?id=r2");
  render(<LibraryPage />);
  await screen.findByRole("heading", { level: 1, name: "Reader test 2" });
  await userEvent.click(screen.getByRole("button", { name: "Export" }));
  expect(await screen.findByRole("menuitem", { name: /HTML/ })).toBeInTheDocument();
  await userEvent.keyboard("{Escape}");
  expect(screen.getByRole("heading", { level: 1, name: "Reader test 2" })).toBeInTheDocument();
  expect(screen.queryByRole("searchbox")).toBeNull();
});

test("continuing to scroll during an autosave round trip is not reverted", async () => {
  await putDocument(sampleDocument({ id: "p2", progress: 0.2 }));
  history.replaceState(null, "", "/library.html?id=p2");
  render(<LibraryPage />);
  await screen.findByRole("heading", { level: 1, name: "A title" });

  const scroller = document.querySelector<HTMLElement>("[data-reader-scroller]");
  if (!scroller) throw new Error("reader scroller not found");
  Object.defineProperty(scroller, "scrollHeight", { value: 1000, configurable: true });
  Object.defineProperty(scroller, "clientHeight", { value: 500, configurable: true });
  Object.defineProperty(scroller, "scrollTop", { value: 400, configurable: true, writable: true });
  scroller.dispatchEvent(new Event("scroll"));

  // Past the 300ms debounce: the write (and the refresh it triggers) must not
  // re-seed state or re-run the mount-time scroll restore with the
  // now-stale doc.progress it flows back as.
  await new Promise(resolve => setTimeout(resolve, 400));

  expect(scroller.scrollTop).toBe(400);
  expect((await getDocument("p2"))?.progress).toBeCloseTo(0.8);
});

test("an unfinished save shows a clear alert in the reader", async () => {
  const message = "Capture stopped before completion: The selected post was not found in the rendered page.";
  await putDocument(sampleDocument({ id: "broken", title: "Broken save", warnings: [{ code: "interrupted", message }] }));
  history.replaceState(null, "", "/library.html?id=broken");
  render(<LibraryPage />);
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("This save didn't finish");
  expect(alert).toHaveTextContent(message);
});
