import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Asset, SavedDocument } from "../../src/core/model";
import { DEFAULT_SETTINGS } from "../../src/core/model";
import { ReaderView } from "../../src/surfaces/reader/reader-view";
import { Toaster } from "../../src/surfaces/shared/toast";
import { sampleDocument } from "../helpers/fixtures";

const capturedAt = "2026-09-01T12:00:00.000Z";

function asset(id: string, status: Asset["status"], sourceUrl = `https://img.example/${id}.png`): Asset {
  return { id, sourceUrl, alt: id, status, blob: status === "saved" ? new Blob(["x"], { type: "image/png" }) : undefined, bytes: 1, attempts: 0, updatedAt: "" };
}

function withImages(ids: string[], overrides: Partial<SavedDocument> = {}): SavedDocument {
  return sampleDocument({
    capturedAt,
    sections: [{ id: "s1", sourceUrl: "https://example.com/post", relation: "selected", excluded: false, blocks: ids.map(id => ({ type: "image" as const, assetId: id, alt: id })) }],
    ...overrides,
  });
}

function props(doc: SavedDocument, over: Partial<React.ComponentProps<typeof ReaderView>> = {}): React.ComponentProps<typeof ReaderView> {
  return {
    doc, assets: new Map(), settings: DEFAULT_SETTINGS, crumb: "Library",
    onBack: vi.fn(), onChanged: vi.fn(async () => {}), onUpdate: vi.fn(async () => true), onSaveProgress: vi.fn(async () => {}),
    onRemove: vi.fn(async () => true), onDeleted: vi.fn(), onOpenAppearance: vi.fn(), ...over,
  };
}

beforeEach(() => {
  localStorage.clear();
  let n = 0;
  URL.createObjectURL = vi.fn(() => `blob:test/${++n}`);
  URL.revokeObjectURL = vi.fn();
});

test("an article header shows title, author, site, reading time and saved date", () => {
  render(<ReaderView {...props(sampleDocument({ title: "Slow software", author: "Ada", siteName: "Example", capturedAt, readingMinutes: 4 }))} />);
  expect(screen.getByRole("heading", { level: 1, name: "Slow software" })).toBeInTheDocument();
  expect(screen.getByText("Ada")).toBeInTheDocument();
  expect(screen.getByText("Example")).toBeInTheDocument();
  expect(screen.getByText("4 min read · Saved Sep 1, 2026")).toBeInTheDocument();
  expect(screen.getByText("Article")).toBeInTheDocument();
});

test("the breadcrumb shows the crumb and goes back; the back button goes back", async () => {
  const p = props(sampleDocument({ title: "Slow software" }), { crumb: "Starred" });
  render(<ReaderView {...p} />);
  await userEvent.click(screen.getByRole("button", { name: "Starred" }));
  await userEvent.click(screen.getByRole("button", { name: "Offshelf" }));
  await userEvent.click(screen.getByRole("button", { name: "Back to library" }));
  expect(p.onBack).toHaveBeenCalledTimes(3);
});

test("a thread header uses the post author and handle, has no title heading, and counts posts", () => {
  const doc = sampleDocument({
    kind: "thread", title: "Thread title", author: "Ada", capturedAt,
    sections: [
      { id: "1", sourceUrl: "https://x.com/ada/status/1", author: "Ada Lovelace", handle: "ada", relation: "selected", excluded: false, blocks: [{ type: "paragraph", content: [{ text: "first" }] }] },
      { id: "2", sourceUrl: "https://x.com/ada/status/2", relation: "candidate", excluded: true, blocks: [{ type: "paragraph", content: [{ text: "hidden" }] }] },
    ],
  });
  render(<ReaderView {...props(doc)} />);
  expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
  expect(screen.getByText("@ada")).toBeInTheDocument();
  expect(screen.getByText("Post by Ada")).toBeInTheDocument();
  expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  expect(screen.getByText("Saved Sep 1, 2026")).toBeInTheDocument();
  expect(screen.getByText("1 posts · completeness unverified")).toBeInTheDocument();
  expect(screen.queryByText("hidden")).toBeNull();
  expect(screen.getByRole("button", { name: /Review posts/ })).toBeInTheDocument();
});

test("an article with no images says the text is saved offline", () => {
  render(<ReaderView {...props(sampleDocument())} />);
  expect(screen.getByText("Text saved offline")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Fix missing images" })).toBeNull();
});

test("all images saved reports them offline without a fix button", () => {
  const assets = new Map([["a", asset("a", "saved")], ["b", asset("b", "saved")]]);
  render(<ReaderView {...props(withImages(["a", "b"]), { assets })} />);
  expect(screen.getByText("2 of 2 images offline")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Fix missing images" })).toBeNull();
});

test("missing images are counted and Fix missing images opens the media dialog", async () => {
  const assets = new Map([["a", asset("a", "saved")], ["b", asset("b", "failed")], ["c", asset("c", "permission")]]);
  render(<ReaderView {...props(withImages(["a", "b", "c"]), { assets })} />);
  expect(screen.getByText("1 of 3 images offline")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Fix missing images" }));
  expect(await screen.findByRole("dialog", { name: "Keep the images, too." })).toBeInTheDocument();
});

test("an image the library has no record of counts as not offline", () => {
  render(<ReaderView {...props(withImages(["ghost"]))} />);
  expect(screen.getByText("0 of 1 images offline")).toBeInTheDocument();
});

test("capture warnings are summarized and pluralized", () => {
  const one = sampleDocument({ warnings: [{ code: "note", message: "Lazy images skipped" }] });
  const { unmount } = render(<ReaderView {...props(one)} />);
  expect(screen.getByText("1 capture note")).toBeInTheDocument();
  expect(screen.getByText("Lazy images skipped")).toBeInTheDocument();
  unmount();
  render(<ReaderView {...props(sampleDocument({ warnings: [{ code: "a", message: "First" }, { code: "b", message: "Second" }] }))} />);
  expect(screen.getByText("2 capture notes")).toBeInTheDocument();
  expect(screen.getByText("Second")).toBeInTheDocument();
});

test("no capture-notes summary when there are no warnings", () => {
  render(<ReaderView {...props(sampleDocument())} />);
  expect(screen.queryByText(/capture note/)).toBeNull();
});

test("focus mode starts off, toggles, persists in storage and survives a remount", async () => {
  const doc = sampleDocument();
  const { unmount } = render(<ReaderView {...props(doc)} />);
  const toggle = () => screen.getByRole("button", { name: "Focus mode" });
  expect(toggle()).toHaveAttribute("aria-pressed", "false");
  expect(screen.getByRole("navigation", { name: "On this page" })).toBeInTheDocument();

  await userEvent.click(toggle());
  expect(toggle()).toHaveAttribute("aria-pressed", "true");
  expect(screen.queryByRole("navigation", { name: "On this page" })).toBeNull();
  expect(localStorage.getItem("offshelf-focus")).toBe("true");
  unmount();

  render(<ReaderView {...props(doc)} />);
  expect(screen.getByRole("button", { name: "Focus mode" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.queryByRole("navigation", { name: "On this page" })).toBeNull();

  await userEvent.click(screen.getByRole("button", { name: "Focus mode" }));
  expect(screen.getByRole("button", { name: "Focus mode" })).toHaveAttribute("aria-pressed", "false");
  expect(localStorage.getItem("offshelf-focus")).toBe("false");
});

test("any stored value other than 'true' leaves focus mode off", () => {
  localStorage.setItem("offshelf-focus", "yes");
  render(<ReaderView {...props(sampleDocument())} />);
  expect(screen.getByRole("button", { name: "Focus mode" })).toHaveAttribute("aria-pressed", "false");
});

test("the outline lists article headings; thread outlines list numbered posts", () => {
  const { unmount } = render(<ReaderView {...props(sampleDocument())} />);
  const nav = screen.getByRole("navigation", { name: "On this page" });
  expect(within(nav).getAllByRole("link").map(link => link.textContent)).toEqual(["Introduction", "Intro"]);
  unmount();

  const thread = sampleDocument({
    kind: "thread",
    sections: ["1", "2"].map(id => ({ id, sourceUrl: "https://x.com/a/status/1", relation: "selected" as const, excluded: false, blocks: [{ type: "paragraph" as const, content: [{ text: `post ${id}` }] }] })),
  });
  render(<ReaderView {...props(thread)} />);
  const threadNav = screen.getByRole("navigation", { name: "Thread posts" });
  expect(within(threadNav).getAllByRole("link").map(link => link.textContent)).toEqual(["Overview", "Post 01", "Post 02"]);
});

test("Escape goes back; Escape in an open dialog closes the dialog instead", async () => {
  const q = props(sampleDocument());
  render(<ReaderView {...q} />);
  await userEvent.keyboard("{Escape}");
  expect(q.onBack).toHaveBeenCalledTimes(1);

  await userEvent.click(screen.getAllByRole("button", { name: "Edit tags" })[0]!);
  expect(await screen.findByRole("dialog", { name: "Edit tags" })).toBeInTheDocument();
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(q.onBack).toHaveBeenCalledTimes(1);
});

test.each([
  ["Star this document", { starred: true }, { starred: false }, "Remove from starred", "starred"],
  ["Mark as read", { read: true }, { read: false }, "Mark unread", "read"],
  ["Archive", { archived: true }, { archived: false }, "Unarchive", "archived"],
] as const)("%s toggles the flag through onUpdate", async (label, onPatch, offPatch, activeLabel, key) => {
  const q = props(sampleDocument({ id: "doc-9" }));
  const { unmount } = render(<ReaderView {...q} />);
  await userEvent.click(screen.getByRole("button", { name: label }));
  expect(q.onUpdate).toHaveBeenCalledWith("doc-9", onPatch);
  unmount();

  const active = props(sampleDocument({ id: "doc-9", [key]: true }));
  render(<ReaderView {...active} />);
  const button = screen.getByRole("button", { name: activeLabel });
  if (key !== "archived") expect(button).toHaveAttribute("aria-pressed", "true");
  await userEvent.click(button);
  expect(active.onUpdate).toHaveBeenCalledWith("doc-9", offPatch);
});

test("Reading appearance asks the page to open settings", async () => {
  const q = props(sampleDocument());
  render(<ReaderView {...q} />);
  await userEvent.click(screen.getByRole("button", { name: "Reading appearance" }));
  expect(q.onOpenAppearance).toHaveBeenCalledTimes(1);
});

test("Open original links to the safe source URL", () => {
  render(<ReaderView {...props(sampleDocument({ sourceUrl: "https://example.com/post" }))} />);
  const link = screen.getByRole("link", { name: "Open original ↗" });
  expect(link).toHaveAttribute("href", "https://example.com/post");
  expect(link).toHaveAttribute("rel", "noopener noreferrer");
});

test("Open original is hidden for an unsafe source URL", () => {
  render(<ReaderView {...props(sampleDocument({ sourceUrl: "javascript:alert(1)" }))} />);
  expect(screen.queryByRole("link", { name: "Open original ↗" })).toBeNull();
});

test("delete asks first, then removes, toasts, and reports the deletion", async () => {
  const q = props(sampleDocument({ id: "gone", title: "Doomed read" }));
  render(<><ReaderView {...q} /><Toaster /></>);
  await userEvent.click(screen.getByRole("button", { name: "Delete saved copy" }));
  const dialog = await screen.findByRole("dialog", { name: "Delete this saved read?" });
  expect(within(dialog).getByText("Doomed read")).toBeInTheDocument();
  expect(q.onRemove).not.toHaveBeenCalled();

  await userEvent.click(within(dialog).getByRole("button", { name: "Delete saved copy" }));
  expect(q.onRemove).toHaveBeenCalledWith("gone");
  await waitFor(() => expect(q.onDeleted).toHaveBeenCalledTimes(1));
  expect(await screen.findByText("Saved copy deleted.")).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

test("a failed delete keeps the dialog open and does not report a deletion", async () => {
  const q = props(sampleDocument({ id: "stay" }));
  (q.onRemove as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);
  render(<ReaderView {...q} />);
  await userEvent.click(screen.getByRole("button", { name: "Delete saved copy" }));
  const dialog = await screen.findByRole("dialog", { name: "Delete this saved read?" });
  await userEvent.click(within(dialog).getByRole("button", { name: "Delete saved copy" }));
  await waitFor(() => expect(q.onRemove).toHaveBeenCalledTimes(1));
  expect(q.onDeleted).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog", { name: "Delete this saved read?" })).toBeInTheDocument();
});

test("Keep it closes the delete dialog without removing", async () => {
  const q = props(sampleDocument());
  render(<ReaderView {...q} />);
  await userEvent.click(screen.getByRole("button", { name: "Delete saved copy" }));
  await userEvent.click(await screen.findByRole("button", { name: "Keep it" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(q.onRemove).not.toHaveBeenCalled();
});

test("tags are listed with an Add/Edit button that opens the tag dialog", async () => {
  const { unmount } = render(<ReaderView {...props(sampleDocument({ tags: [] }))} />);
  await userEvent.click(screen.getByRole("button", { name: "Add tags" }));
  expect(await screen.findByRole("dialog", { name: "Edit tags" })).toBeInTheDocument();
  unmount();

  render(<ReaderView {...props(sampleDocument({ tags: ["Design", "Slow"] }))} />);
  expect(screen.getByText("Design")).toBeInTheDocument();
  expect(screen.getByText("Slow")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Add tags" })).toBeNull();
  expect(screen.getAllByRole("button", { name: "Edit tags" })).toHaveLength(2);
});

test("saving tags from the reader calls onUpdate with the parsed list", async () => {
  const q = props(sampleDocument({ id: "t1", tags: [] }));
  render(<ReaderView {...q} />);
  await userEvent.click(screen.getByRole("button", { name: "Add tags" }));
  await userEvent.type(await screen.findByRole("textbox", { name: "Document tags" }), "x, y");
  await userEvent.click(screen.getByRole("button", { name: "Save tags" }));
  expect(q.onUpdate).toHaveBeenCalledWith("t1", { tags: ["x", "y"] });
});

test("the reader text size follows settings", () => {
  const { container } = render(<ReaderView {...props(sampleDocument(), { settings: { ...DEFAULT_SETTINGS, readerFont: "sans", fontSize: 18 } })} />);
  const prose = container.querySelector<HTMLElement>("[data-reader-prose]")!;
  expect(prose.style.fontSize).toBe("18px");
});
