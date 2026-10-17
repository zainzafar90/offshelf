// Store screenshots 1, 2, 4 and 5, taken from the built extension with seeded showcase data.
// Run: pnpm build && cp publish/chrome-web-store/tools/store-screenshots.pw.ts e2e/zz-store.spec.ts
//      && npx playwright test e2e/zz-store.spec.ts --retries=0 && rm e2e/zz-store.spec.ts
import { fileURLToPath } from "node:url";
import { test } from "./fixtures";

const OUT = fileURLToPath(new URL("../publish/chrome-web-store/assets", import.meta.url));

async function seed(page: import("@playwright/test").Page, theme: "light" | "dark") {
  await page.evaluate(async theme => {
    const db: IDBDatabase = await new Promise((resolve, reject) => { const r = indexedDB.open("offshelf-library", 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const grad = (x: OffscreenCanvasRenderingContext2D, w: number, h: number, stops: [number, string][], vertical = false) => { const g = vertical ? x.createLinearGradient(0, 0, 0, h) : x.createLinearGradient(0, 0, w, h); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; };
    const COVERS: Record<string, (x: OffscreenCanvasRenderingContext2D, w: number, h: number) => void> = {
      own: (x, w, h) => { x.fillStyle = grad(x, w, h, [[0, "#FFD1B0"], [.45, "#FF8A3D"], [1, "#B24A1F"]], true); x.fillRect(0, 0, w, h); x.fillStyle = "#15171F"; x.fillRect(0, h * .72, w, h * .28); x.fillStyle = "#FFF3EA"; x.beginPath(); x.arc(w * .68, h * .5, h * .2, 0, 7); x.fill(); x.fillStyle = "#F2F2EE"; [0, 1, 2].forEach(i => x.fillRect(w * .1, h * (.2 + i * .09), w * (.26 - i * .06), h * .028)); },
      quiet: (x, w, h) => { x.fillStyle = grad(x, w, h, [[0, "#DCE3EA"], [1, "#8C9AAB"]], true); x.fillRect(0, 0, w, h); x.fillStyle = "#5E6B7C"; x.beginPath(); x.moveTo(0, h * .78); x.lineTo(w * .3, h * .56); x.lineTo(w * .52, h * .7); x.lineTo(w * .78, h * .5); x.lineTo(w, h * .66); x.lineTo(w, h); x.lineTo(0, h); x.fill(); x.fillStyle = "#3E4958"; x.beginPath(); x.moveTo(0, h * .9); x.lineTo(w * .4, h * .72); x.lineTo(w * .7, h * .84); x.lineTo(w, h * .76); x.lineTo(w, h); x.lineTo(0, h); x.fill(); x.fillStyle = "#F6F7F8"; x.beginPath(); x.arc(w * .24, h * .3, h * .09, 0, 7); x.fill(); },
      local: (x, w, h) => { x.fillStyle = grad(x, w, h, [[0, "#EFE7DA"], [1, "#C8B79C"]]); x.fillRect(0, 0, w, h); ["#8E7B5E", "#A8946F", "#6F604A", "#B9A57F", "#5A4E3C"].forEach((c, i) => { x.fillStyle = c; x.fillRect(w * (.18 + i * .1), h * (.3 + (i % 2) * .06), w * .075, h * (.5 - (i % 2) * .06)); }); x.fillStyle = "#4A3F31"; x.fillRect(w * .12, h * .8, w * .76, h * .035); },
      calm: (x, w, h) => { x.fillStyle = grad(x, w, h, [[0, "#E4ECE4"], [1, "#9DB3A2"]], true); x.fillRect(0, 0, w, h); x.strokeStyle = "#5F7D68"; x.lineWidth = h * .02; for (let i = 0; i < 4; i++) { x.beginPath(); x.arc(w * .5, h * 1.05, h * (.3 + i * .16), Math.PI, 0); x.stroke(); } x.fillStyle = "#2F4236"; x.beginPath(); x.arc(w * .5, h * .38, h * .07, 0, 7); x.fill(); },
      shotA: (x, w, h) => { x.fillStyle = "#EEF1F4"; x.fillRect(0, 0, w, h); x.fillStyle = "#fff"; x.fillRect(w * .06, h * .08, w * .88, h * .84); x.fillStyle = "#15171F"; x.fillRect(w * .1, h * .14, w * .34, h * .05); x.fillStyle = "#C9CFD6"; for (let i = 0; i < 6; i++) x.fillRect(w * .1, h * (.26 + i * .08), w * (.62 - (i % 3) * .12), h * .025); x.fillStyle = "#FF8A3D"; x.fillRect(w * .1, h * .78, w * .2, h * .07); },
      shotB: (x, w, h) => { x.fillStyle = "#1B1D26"; x.fillRect(0, 0, w, h); x.fillStyle = "#2A2D38"; for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) x.fillRect(w * (.08 + c * .29), h * (.1 + r * .28), w * .26, h * .24); x.fillStyle = "#FF8A3D"; x.fillRect(w * .08, h * .1, w * .26, h * .24); },
    };
    const AVATARS: Record<string, [string, string]> = { nz: ["#3B4252", "#C9CED8"], mc: ["#C2532A", "#FFD1B0"], ap: ["#27313A", "#9FB0C0"], lr: ["#5E513F", "#E4D6BF"], rk: ["#2F4236", "#BFD1C4"] };
    const assets: object[] = [];
    async function add(id: string, draw: (x: OffscreenCanvasRenderingContext2D, w: number, h: number) => void, w: number, h: number) {
      const c = new OffscreenCanvas(w, h); draw(c.getContext("2d")!, w, h);
      const blob = await c.convertToBlob({ type: "image/png" });
      assets.push({ id, sourceUrl: `https://images.example/${id}.png`, alt: "", status: "saved", blob, bytes: blob.size, mime: "image/png", attempts: 1, updatedAt: new Date().toISOString() });
    }
    for (const [id, draw] of Object.entries(COVERS)) await add(`c-${id}`, draw, 1280, 720);
    for (const [id, [bg, fg]] of Object.entries(AVATARS)) await add(`a-${id}`, (x, w, h) => { x.fillStyle = bg; x.fillRect(0, 0, w, h); x.fillStyle = fg; x.beginPath(); x.arc(w / 2, h * .4, w * .19, 0, 7); x.fill(); x.beginPath(); x.ellipse(w / 2, h * .94, w * .35, h * .28, 0, Math.PI, 0); x.fill(); }, 160, 160);
    const p = (text: string) => ({ type: "paragraph", content: [{ text }] });
    const h2 = (text: string, anchor: string) => ({ type: "heading", level: 2, anchor, content: [{ text }] });
    const img = (assetId: string) => ({ type: "image", assetId, alt: "" });
    const now = Date.now(), at = (i: number) => new Date(now - i * 7 * 60000).toISOString();
    const docs: object[] = [];
    function article(i: number, id: string, title: string, site: string, author: string, excerpt: string, cover: string | null, extra: object = {}, body: object[] = []) {
      docs.push({ schemaVersion: 1, id, sourceUrl: `https://${site}/${id}`, title, author, siteName: site, kind: "article", excerpt, capturedAt: at(i), updatedAt: at(i), sections: [{ id: "s", sourceUrl: `https://${site}/${id}`, relation: "selected", blocks: [...(cover ? [img(cover)] : []), p(excerpt), ...body] }], assetIds: cover ? [cover] : [], warnings: [], completeness: "page-snapshot", wordCount: 1400, readingMinutes: 6, starred: false, archived: false, read: false, progress: 0, tags: [], ...extra });
    }
    function thread(i: number, id: string, author: string, handle: string, avatar: string, posts: object[][], extra: object = {}) {
      const sections = posts.map((blocks, n) => ({ id: `${id}${n}`, sourceUrl: `https://x.com/${handle}/status/${id}${n}`, author, handle, avatarAssetId: avatar, publishedAt: at(i + 30), relation: n ? "candidate" : "selected", blocks }));
      const ids = [...new Set([avatar, ...posts.flat().flatMap((b: { assetId?: string; cite?: { avatarAssetId?: string } }) => [b.assetId, b.cite?.avatarAssetId].filter(Boolean) as string[])])];
      docs.push({ schemaVersion: 1, id, sourceUrl: `https://x.com/${handle}/status/${id}0`, title: author, author, siteName: "X", kind: "thread", excerpt: "", capturedAt: at(i), updatedAt: at(i), sections, assetIds: ids, warnings: [], completeness: "page-snapshot", wordCount: 300, readingMinutes: 2, starred: false, archived: false, read: false, progress: 0, tags: [], ...extra });
    }
    article(0, "own", "Software you actually own", "quietweb.blog", "Mira Halden", "The best tools feel like paper: there when you open them, working when the network is not.", "c-own", { tags: ["Local-first"] });
    thread(1, "nz", "Nicolas Zullo", "NicolasZu", "a-nz", [
      [p("Huge fan of local tools. Nothing beats opening a file that's just… there.")],
      [p("The best part is what you don't see: no spinner, no sign-in, no \"something went wrong\". The words are simply on the page.")],
      [{ type: "quote", cite: { author: "Ren Kato", handle: "renkato", avatarAssetId: "a-rk" }, blocks: [p("Software should work on a plane. Everything else is a feature.")] }, p("This, basically.")],
      [p("Your library should outlive the link. That's the whole idea.")],
    ], { starred: true });
    article(2, "quiet", "The quiet web", "slowreads.net", "Slow Reads", "Small sites, long essays and the pleasure of reading one thing at a time.", "c-quiet", { progress: 0.62, readingMinutes: 9, starred: true, tags: ["Reading"] }, [
      p("For a long time we treated the web like a library that would always be open. Then pages moved, posts vanished, and the tab you meant to come back to quietly closed itself."),
      p("Keeping a copy used to mean printing it. Now it can mean one click: the words, the images, the thread in the order it was written, stored on your own device."),
      h2("A small promise", "a-small-promise"),
      p("A saved page is a small promise to your future self. It will be there when the network isn't, and it will look the way you like to read."),
      h2("A quiet shelf", "a-quiet-shelf"),
      p("No account. No sync server. Just a quiet shelf that is yours."),
    ]);
    thread(3, "mc", "Maya Chen", "mayachen", "a-mc", [[p("Two screens from the redesign. Saved this so I can actually read the thread later, not just bookmark it and forget."), img("c-shotA"), img("c-shotB")]]);
    article(4, "screens", "Notes on reading on screens", "fieldnotes.dev", "Field Notes", "Line length, contrast and why a good serif still wins for long reads.", null, { progress: 0.3, readingMinutes: 7, tags: ["Reading"] });
    article(5, "local", "Local-first, a year later", "fieldnotes.dev", "Field Notes", "What changed after twelve months of keeping everything on my own device.", "c-local", { readingMinutes: 8, tags: ["Local-first"] });
    thread(6, "ap", "Ada Park", "adapark", "a-ap", [[p("Offline is a feature. Treat it like one.")], [p("It changes how you read.")]]);
    article(7, "calm", "Designing for calm", "calm.design", "Ren Ito", "Interfaces that leave room to think, and get out of the way when you read.", "c-calm", { readingMinutes: 5, read: true, tags: ["Design"] });
    thread(8, "lr", "Leo Rossi", "leorossi", "a-lr", [[p("Every tab I keep open is a small anxiety. Save it, close it, read it tonight.")]]);
    const tx = db.transaction(["documents", "assets", "settings"], "readwrite");
    docs.forEach(d => tx.objectStore("documents").put(d));
    assets.forEach(a => tx.objectStore("assets").put(a));
    tx.objectStore("settings").put({ theme, readerFont: "serif", fontSize: 20, readerWidth: "comfortable", threadStyle: "continuous", autoScroll: true, maxPasses: 24, openReader: true }, "reader");
    await new Promise(resolve => { tx.oncomplete = resolve; });
  }, theme);
}

test("store screenshots", async ({ context, extensionId }) => {
  test.setTimeout(120_000);
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  const lib = `chrome-extension://${extensionId}/library.html`;
  const settle = async () => { await page.waitForTimeout(700); await page.evaluate(() => document.fonts.ready); };
  await page.goto(lib);
  await page.getByRole("searchbox").waitFor();
  await seed(page, "light");
  await page.reload();
  await page.getByRole("article").first().waitFor();
  await settle();
  await page.screenshot({ path: `${OUT}/screenshot-1-library.png` });
  await page.goto(`${lib}?id=quiet`);
  await page.getByRole("heading", { level: 1, name: "The quiet web" }).waitFor();
  await settle();
  await page.locator("[data-reader-scroller]").evaluate(el => { el.scrollTop = 0; });
  await settle();
  await page.screenshot({ path: `${OUT}/screenshot-2-reader.png` });
  await seed(page, "dark");
  await page.goto(`${lib}?id=nz`);
  await page.locator("[data-thread-post]").first().waitFor();
  await settle();
  await page.screenshot({ path: `${OUT}/screenshot-4-thread-dark.png` });
  await page.goto(lib);
  await page.getByRole("article").first().waitFor();
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("dialog").waitFor();
  await settle();
  await page.screenshot({ path: `${OUT}/screenshot-5-settings.png` });
});
