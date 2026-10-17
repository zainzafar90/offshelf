import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import type { Asset, Block, CaptureJob, SavedDocument, Section } from "../src/core/model";
import { LibraryPage } from "../src/surfaces/library/library-page";
import { PopupView } from "../src/surfaces/popup/popup-states";

// Run from the repo root after: cp publish/reel/source/tools/reel-snapshots.tsx tests/zz-reel-snapshots.test.tsx
const OUT = join(process.cwd(), "publish/reel/source/snapshots");

const data = vi.hoisted(() => ({ documents: [] as SavedDocument[], assets: new Map<string, Asset>() }));
vi.mock("../src/surfaces/shared/use-library", () => ({
  useLibrary: () => ({
    documents: data.documents, assets: data.assets, jobs: [], loading: false, error: undefined,
    settings: { theme: "light", readerFont: "serif", fontSize: 20, readerWidth: "comfortable", threadStyle: "continuous", autoScroll: true, maxPasses: 24, openReader: true },
    refresh: async () => {}, update: async () => {}, remove: async () => true, saveSettings: async () => {},
  }),
}));

const blobIds = new WeakMap<Blob, string>();
function asset(id: string, bytes: number): Asset {
  const blob = new Blob(["x"], { type: "image/jpeg" });
  blobIds.set(blob, id);
  return { id, sourceUrl: `https://images.example/${id}.jpg`, alt: "", status: "saved", blob, bytes, mime: "image/jpeg", attempts: 1, updatedAt: "2026-09-27T09:00:00.000Z" };
}
const p = (text: string): Block => ({ type: "paragraph", content: [{ text }] });
const h = (text: string, anchor: string): Block => ({ type: "heading", level: 2, anchor, content: [{ text }] });
const img = (assetId: string): Block => ({ type: "image", assetId, alt: "" });

function base(id: string, over: Partial<SavedDocument>): SavedDocument {
  return {
    schemaVersion: 1, id, sourceUrl: `https://example.com/${id}`, title: "", author: "", siteName: "", kind: "article",
    excerpt: "", capturedAt: "2026-09-27T09:00:00.000Z", updatedAt: "2026-09-27T09:00:00.000Z", sections: [], assetIds: [],
    warnings: [], completeness: "page-snapshot", wordCount: 900, readingMinutes: 6, starred: false, archived: false,
    read: false, progress: 0, tags: [], ...over,
  };
}
function article(id: string, minute: number, title: string, site: string, author: string, excerpt: string, cover: string | null, extra: Partial<SavedDocument> = {}, blocks: Block[] = []) {
  const section: Section = { id: "s", sourceUrl: `https://${site}/${id}`, relation: "selected", blocks: [...(cover ? [img(cover)] : []), p(excerpt), ...blocks] };
  return base(id, { title, siteName: site, author, excerpt, sourceUrl: `https://${site}/${id}`, capturedAt: `2026-09-27T09:${String(minute).padStart(2, "0")}:00.000Z`, sections: [section], assetIds: cover ? [cover] : [], ...extra });
}
function post(id: string, minute: number, author: string, handle: string, avatar: string, texts: string[]) {
  const sections: Section[] = texts.map((text, i) => ({ id: `${id}-${i}`, sourceUrl: `https://x.com/${handle}/status/${id}${i}`, author, handle, avatarAssetId: avatar, publishedAt: "2026-09-26T19:55:00.000Z", relation: i ? "candidate" : "selected", blocks: [p(text)] }));
  return base(id, { kind: "thread", title: texts[0]!, author, siteName: "X", sourceUrl: `https://x.com/${handle}/status/${id}`, capturedAt: `2026-09-27T09:${String(minute).padStart(2, "0")}:00.000Z`, sections, assetIds: [avatar] });
}

const QUIET_BODY: Block[] = [
  p("Keeping a copy used to mean printing it. Now it can mean one click: the words, the images, the thread in the order it was written, stored on your own device."),
  h("A small promise", "a-small-promise"),
  p("A saved page is a small promise to your future self. It will be there when the network isn't, and it will look the way you like to read."),
  p("The best reading tools get out of the way. A clear title, a comfortable line length and a way back to your library are usually enough."),
  h("A quiet shelf", "a-quiet-shelf"),
  p("No account. No sync server. Just a quiet shelf that is yours, with everything you meant to come back to."),
  p("Some things deserve more than an open tab. Save them once, and read them when you have the space."),
];

beforeAll(() => {
  URL.createObjectURL = ((blob: Blob) => `reel-asset:${blobIds.get(blob)}`) as typeof URL.createObjectURL;
  URL.revokeObjectURL = () => {};
  HTMLImageElement.prototype.decode = () => Promise.resolve();
  globalThis.chrome = {
    storage: { onChanged: { addListener() {}, removeListener() {} } },
    runtime: { sendMessage: async () => ({ ok: true }), getURL: (path: string) => `chrome-extension://id/${path}` },
  } as unknown as typeof chrome;
  const assets = [asset("c-own", 412_000), asset("c-quiet", 388_000), asset("c-local", 356_000), asset("c-calm", 402_000), asset("a-nz", 18_000), asset("a-mc", 17_000), asset("a-ap", 16_000), asset("a-lr", 17_000), asset("c-shotA", 90_000), asset("c-shotB", 90_000)];
  assets.forEach(a => data.assets.set(a.id, a));
  data.documents = [
    article("own", 59, "Software you actually own", "quietweb.blog", "Mira Halden", "The best tools feel like paper: there when you open them, working when the network is not.", "c-own"),
    post("nz", 58, "Nicolas Zullo", "NicolasZu", "a-nz", ["Huge fan of local tools. Nothing beats opening a file that's just… there.", "Offline first, sync later.", "Your library should outlive the link.", "That's the whole idea."]),
    article("quiet", 57, "The quiet web", "slowreads.net", "Slow Reads", "Small sites, long essays and the pleasure of reading one thing at a time.", "c-quiet", { progress: 0.62, readingMinutes: 9 }, [p("For a long time we treated the web like a library that would always be open. Then pages moved, posts vanished, and the tab you meant to come back to quietly closed itself."), ...QUIET_BODY]),
    { ...post("mc", 56, "Maya Chen", "mayachen", "a-mc", ["Two screens from the redesign. Saved so I can read the thread later."]), assetIds: ["a-mc", "c-shotA", "c-shotB"], sections: [{ id: "mc-0", sourceUrl: "https://x.com/mayachen/status/mc0", author: "Maya Chen", handle: "mayachen", avatarAssetId: "a-mc", publishedAt: "2026-09-26T19:55:00.000Z", relation: "selected", blocks: [p("Two screens from the redesign. Saved so I can read the thread later."), img("c-shotA"), img("c-shotB")] }] },
    article("screens", 55, "Notes on reading on screens", "fieldnotes.dev", "Field Notes", "Line length, contrast and why a good serif still wins for long reads.", null, { progress: 0.3, readingMinutes: 7 }),
    article("local", 54, "Local-first, a year later", "fieldnotes.dev", "Field Notes", "What changed after twelve months of keeping everything on my own device.", "c-local", { readingMinutes: 8 }),
    post("ap", 53, "Ada Park", "adapark", "a-ap", ["Offline is a feature. Treat it like one.", "It changes how you read."]),
    article("calm", 52, "Designing for calm", "calm.design", "Ren Ito", "Interfaces that leave room to think, and get out of the way when you read.", "c-calm", { readingMinutes: 5 }),
    post("lr", 51, "Leo Rossi", "leorossi", "a-lr", ["Every tab I keep open is a small anxiety. Save it, close it, read it tonight."]),
  ];
});

test("library grid", async () => {
  history.replaceState(null, "", "/library.html");
  const { container } = render(<LibraryPage />);
  await screen.findByText("Software you actually own");
  writeFileSync(`${OUT}/library.html`, container.innerHTML);
});

test("reader", async () => {
  history.replaceState(null, "", "/library.html?id=quiet");
  const { container } = render(<LibraryPage />);
  await screen.findByRole("heading", { level: 1, name: "The quiet web" });
  writeFileSync(`${OUT}/reader.html`, container.innerHTML);
});

test("popup states", () => {
  const tab = { id: 7, title: "Software you actually own", url: "https://quietweb.blog/software-you-own" } as chrome.tabs.Tab;
  const job = (status: CaptureJob["status"], savedImages: number, message: string): CaptureJob => ({ id: "j", tabId: 7, sourceUrl: tab.url!, documentId: "own", title: tab.title!, status, message, createdAt: "", updatedAt: "", posts: 1, images: 3, savedImages, options: { mode: "auto", autoScroll: true, maxPasses: 24 } });
  const noop = () => {};
  const props = { tab, mode: "auto" as const, onMode: noop, onSave: noop, onCancel: noop, onRead: noop, onOpenLibrary: noop, onSettings: noop, starting: false };
  const states: [string, CaptureJob | undefined, number][] = [["ready", undefined, 41], ["saving", job("downloading", 2, "Saving images"), 41], ["saved", job("done", 3, "Saved"), 42]];
  for (const [name, state, count] of states) {
    const { container, unmount } = render(<PopupView {...props} job={state} savedCount={count} />);
    writeFileSync(`${OUT}/popup-${name}.html`, container.innerHTML);
    unmount();
  }
});
