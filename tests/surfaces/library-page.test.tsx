import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LibraryPage } from "../../src/surfaces/library/library-page";
import { deleteDocument, listDocuments, putDocument } from "../../src/storage/library-store";
import { sampleDocument } from "../helpers/fixtures";

beforeEach(async () => {
  globalThis.chrome = {
    storage: { onChanged: { addListener() {}, removeListener() {} } },
    runtime: { sendMessage: vi.fn(async () => ({ ok: true })), getURL: (p: string) => `chrome-extension://id/${p}` },
  } as unknown as typeof chrome;
  history.replaceState(null, "", "/library.html");
  // Tests share one fake-indexeddb instance for this file; start each test with an empty library.
  await Promise.all((await listDocuments()).map(doc => deleteDocument(doc.id)));
});

test("filters by kind and search", async () => {
  await putDocument(sampleDocument({ id: "a1", title: "Slow software", kind: "article" }));
  await putDocument(sampleDocument({ id: "t1", title: "Thread one", kind: "thread", author: "Ada" }));
  render(<LibraryPage />);
  await screen.findByText("Slow software");
  await userEvent.click(screen.getByRole("button", { name: "Posts" }));
  expect(screen.queryByText("Slow software")).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "All" }));
  await userEvent.type(screen.getByRole("searchbox"), "slow");
  expect(screen.getByText("Slow software")).toBeInTheDocument();
  expect(screen.getByText("1 saved")).toBeInTheDocument();
});

test("slash focuses search", async () => {
  render(<LibraryPage />);
  await userEvent.keyboard("/");
  expect(screen.getByRole("searchbox")).toHaveFocus();
});

test("paginates at 60 with Load more", async () => {
  for (let i = 0; i < 61; i++) await putDocument(sampleDocument({ id: `p${i}`, title: `Doc ${i}`, capturedAt: new Date(2026, 0, 1, 0, i).toISOString() }));
  render(<LibraryPage />);
  await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(60));
  await userEvent.click(screen.getByRole("button", { name: "Load more" }));
  expect(screen.getAllByRole("article")).toHaveLength(61);
});

test("sidebar counts reflect views", async () => {
  await putDocument(sampleDocument({ id: "s1", starred: true }));
  render(<LibraryPage />);
  const nav = await screen.findByRole("navigation", { name: "Library views" });
  await waitFor(() => expect(within(nav).getByRole("button", { name: /Starred/ })).toHaveTextContent("1"));
});

test("With images hides a document with no saved assets", async () => {
  const withImage = sampleDocument({ id: "img1", title: "Has image", assetIds: ["x"] });
  withImage.sections[0].blocks.push({ type: "image", assetId: "x", alt: "" });
  await putDocument(withImage);
  await putDocument(sampleDocument({ id: "noimg1", title: "No image", assetIds: [] }));
  render(<LibraryPage />);
  await screen.findByText("No image");
  await userEvent.click(screen.getByRole("button", { name: "With images" }));
  expect(screen.queryByText("No image")).toBeNull();
  expect(screen.getByText("Has image")).toBeInTheDocument();
});

test("Title A–Z reorders cards", async () => {
  await putDocument(sampleDocument({ id: "z1", title: "Zebra", capturedAt: "2026-09-03T00:00:00.000Z" }));
  await putDocument(sampleDocument({ id: "a1", title: "Apple", capturedAt: "2026-09-02T00:00:00.000Z" }));
  await putDocument(sampleDocument({ id: "m1", title: "Mango", capturedAt: "2026-09-01T00:00:00.000Z" }));
  render(<LibraryPage />);
  await screen.findByText("Zebra");
  const titles = () => screen.getAllByRole("article").map(article => article.getAttribute("aria-label"));
  expect(titles()).toEqual(["Zebra", "Apple", "Mango"]);
  await userEvent.click(screen.getByRole("combobox", { name: "Sort library" }));
  await userEvent.click(screen.getByRole("option", { name: "Title A–Z" }));
  expect(titles()).toEqual(["Apple", "Mango", "Zebra"]);
});

test("does not flash the first-run empty state before data has loaded", async () => {
  render(<LibraryPage />);
  expect(screen.queryByText("Keep something worth reading.")).toBeNull();
  await screen.findByText("Keep something worth reading.");
});

test("?settings=reading opens the settings dialog on the Reading tab and strips the param", async () => {
  history.replaceState(null, "", "/library.html?settings=reading");
  render(<LibraryPage />);
  await screen.findByRole("dialog", { name: "Settings" });
  expect(screen.getByRole("combobox", { name: "Typeface" })).toBeInTheDocument();
  expect(location.search).toBe("");
});

test("clicking a sidebar view while the reader is open closes it", async () => {
  await putDocument(sampleDocument({ id: "sc1", title: "Sidebar close test", starred: true }));
  history.replaceState(null, "", "/library.html?id=sc1");
  render(<LibraryPage />);
  await screen.findByRole("heading", { level: 1, name: "Sidebar close test" });
  const nav = screen.getByRole("navigation", { name: "Library views" });
  await userEvent.click(within(nav).getByRole("button", { name: /Starred/ }));
  expect(await screen.findByRole("searchbox")).toBeInTheDocument();
  expect(screen.queryByRole("heading", { level: 1, name: "Sidebar close test" })).toBeNull();
  expect(screen.getByText("Sidebar close test")).toBeInTheDocument();
});
