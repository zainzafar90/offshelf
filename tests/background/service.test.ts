import { installBackground } from "../../src/background/service";
import { notifyChanged } from "../../src/background/notify";
import { openLibrary } from "../../src/background/library-tab";
import { recoverJobs } from "../../src/background/job-recovery";
import { startCapture } from "../../src/background/capture-jobs";
import type { CaptureJob, SavedDocument, Settings } from "../../src/core/model";
import { canonicalUrl } from "../../src/core/url";
import { stableId } from "../../src/core/identity";
import { db } from "../../src/storage/connection";
import { getAsset, getDocument, putAsset, putDocument, putSettings, getSettings } from "../../src/storage/library-store";
import { getJob, listJobs, putJob } from "../../src/storage/job-store";
import { EXTENSION_ORIGIN, extensionSender, installChrome, tabSender, uninstallChrome } from "../helpers/chrome";
import type { ChromeHarness } from "../helpers/chrome";
import { IMAGE_URL, PAGE_URL, agoIso, makeAsset, makeDoc, makeJob, makeSnapshot, pngResponse } from "../helpers/jobs";
import { resetDatabase } from "../helpers/reset-db";

let harness: ChromeHarness;
const DOC_ID = stableId(PAGE_URL);
type Reply = { ok: boolean; error?: string; job?: CaptureJob };
const send = async (message: unknown, sender = extensionSender()) => (await harness.sendWorkerMessage(message, sender)) as Reply;
const statusOf = async (id: string) => (await getJob(id))?.status;
const waitForStatus = (id: string, status: string) => vi.waitFor(async () => expect(await statusOf(id)).toBe(status));
const pageTab = (id = 7, url = PAGE_URL) => harness.addTab({ id, url, title: "Page title" });

beforeEach(async () => {
  await resetDatabase();
  harness = installChrome();
  vi.stubGlobal("fetch", vi.fn(async () => pngResponse()));
  installBackground();
});
afterEach(async () => {
  /* let fire-and-forget downloads settle before the next reset */
  await vi.waitFor(async () => expect((await listJobs()).some(job => job.status === "downloading")).toBe(false));
  uninstallChrome();
});

describe("message dispatcher", () => {
  test("ignores messages from other extensions and malformed messages", async () => {
    expect(await harness.sendWorkerMessage({ type: "offshelf:changed" }, { id: "someone-else", url: EXTENSION_ORIGIN })).toBeUndefined();
    expect(await harness.sendWorkerMessage(undefined)).toBeUndefined();
    expect(await harness.sendWorkerMessage({ type: 5 })).toBeUndefined();
  });
  test("rejects an unknown type from an extension page", async () => {
    expect(await send({ type: "offshelf:nope" })).toEqual({ ok: false, error: "Unknown Offshelf action." });
  });
  test("rejects page actions from a non-extension sender", async () => {
    const web = { id: "test-extension-id", url: "https://evil.example/", tab: { id: 1 }, frameId: 0 };
    expect(await send({ type: "offshelf:open-library" }, web)).toEqual({ ok: false, error: "This action is only available from Offshelf." });
    expect(await send({ type: "offshelf:delete", documentId: DOC_ID }, web)).toMatchObject({ ok: false });
  });
  test("offshelf:changed bumps the revision key", async () => {
    expect(await send({ type: "offshelf:changed" })).toEqual({ ok: true });
    expect(harness.chrome.storage.local.set).toHaveBeenCalledWith({ offshelfRevision: expect.any(String) });
  });
  test("offshelf:open-library opens library.html", async () => {
    expect(await send({ type: "offshelf:open-library" })).toEqual({ ok: true });
    expect(harness.chrome.tabs.create).toHaveBeenCalledWith({ url: `${EXTENSION_ORIGIN}library.html` });
  });
  test("exported helpers behave like their messages", async () => {
    await openLibrary();
    await notifyChanged();
    expect(harness.chrome.tabs.create).toHaveBeenCalledTimes(1);
    expect(harness.chrome.storage.local.set).toHaveBeenCalledTimes(1);
  });
});

describe("offshelf:start", () => {
  test("creates a capturing job and injects the capture script", async () => {
    pageTab(7, `${PAGE_URL}?utm_source=x&keep=1#frag`);
    const reply = await send({ type: "offshelf:start", tabId: 7 });
    const sourceUrl = canonicalUrl(`${PAGE_URL}?keep=1`);
    expect(reply.ok).toBe(true);
    expect(reply.job).toMatchObject({
      tabId: 7, sourceUrl, documentId: stableId(sourceUrl), title: "Page title", status: "capturing", message: "Reading the page…",
      posts: 0, images: 0, savedImages: 0, options: { mode: "auto", autoScroll: true, maxPasses: 24 },
    });
    expect(sourceUrl).toBe("https://example.com/post?keep=1");
    expect(await getJob(reply.job!.id)).toEqual(reply.job);
    expect(harness.chrome.scripting.executeScript).toHaveBeenCalledWith({ target: { tabId: 7 }, files: ["capture.js"] });
    expect(harness.chrome.tabs.sendMessage).toHaveBeenCalledWith(7, { type: "offshelf:run", job: reply.job });
    expect(harness.chrome.action.setBadgeText).toHaveBeenCalledWith({ tabId: 7, text: "…" });
    expect(harness.chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: "#3c6451" });
  });
  test("area mode asks the user to pick an area", async () => {
    pageTab();
    const reply = await send({ type: "offshelf:start", tabId: 7, mode: "area" });
    expect(reply.job).toMatchObject({ message: "Choose an area on the source page", options: { mode: "area" } });
  });
  test("takes autoScroll from settings and clamps maxPasses to 1..80", async () => {
    pageTab();
    await putSettings({ ...(await getSettings()), autoScroll: false, maxPasses: 500 });
    expect((await send({ type: "offshelf:start", tabId: 7 })).job?.options).toEqual({ mode: "auto", autoScroll: false, maxPasses: 80 });
    await resetDatabase();
    await putSettings({ ...(await getSettings()), maxPasses: -4 });
    expect((await send({ type: "offshelf:start", tabId: 7 })).job?.options.maxPasses).toBe(1);
  });
  test("startCapture defaults to auto mode and falls back to a generic title", async () => {
    harness.addTab({ id: 3, url: PAGE_URL });
    const job = await startCapture(3);
    expect(job).toMatchObject({ title: "Current page", options: { mode: "auto" } });
  });
  test.each([
    ["a non-integer tab id", { tabId: "7" }],
    ["a missing tab id", {}],
    ["an unknown mode", { tabId: 7, mode: "everything" }],
  ])("rejects %s", async (_label, extra) => {
    expect(await send({ type: "offshelf:start", ...extra })).toEqual({ ok: false, error: "Invalid capture request." });
  });
  test.each(["chrome://extensions/", "about:blank", "file:///tmp/a.html", "https://user:pw@example.com/"])("rejects the non-http page %s", async url => {
    pageTab(7, url);
    const reply = await send({ type: "offshelf:start", tabId: 7 });
    expect(reply.error).toMatch(/^Open an http or https article first\./);
    expect(await listJobs()).toEqual([]);
  });
  test("rejects a tab without a URL", async () => {
    harness.addTab({ id: 7 });
    expect((await send({ type: "offshelf:start", tabId: 7 })).error).toMatch(/^Open an http or https article first/);
  });
  test.each(["https://chromewebstore.google.com/detail/x", "https://chrome.google.com/webstore/detail/x"])("rejects the Chrome Web Store %s", async url => {
    pageTab(7, url);
    expect(await send({ type: "offshelf:start", tabId: 7 })).toEqual({ ok: false, error: "Chrome does not allow capture on its extension store." });
  });
  test.each(["capturing", "downloading"] as const)("rejects a tab with a %s job but allows other tabs", async status => {
    pageTab(7);
    pageTab(8);
    await putJob(makeJob({ id: "busy", tabId: 7, status }));
    expect(await send({ type: "offshelf:start", tabId: 7 })).toEqual({ ok: false, error: "This tab already has a capture in progress." });
    expect((await send({ type: "offshelf:start", tabId: 8 })).ok).toBe(true);
    await putJob(makeJob({ id: "busy", tabId: 7, status: "done" }));
    expect((await send({ type: "offshelf:start", tabId: 7 })).ok).toBe(true);
  });
  test("marks the job failed when the page cannot be scripted", async () => {
    pageTab();
    harness.chrome.scripting.executeScript.mockRejectedValueOnce(new Error("Cannot access contents of url"));
    const reply = await send({ type: "offshelf:start", tabId: 7 });
    expect(reply.error).toBe("Cannot access this page. Click the Offshelf toolbar icon on the source tab and try again. Cannot access contents of url");
    const [job] = await listJobs();
    expect(job).toMatchObject({ status: "failed", message: "Capture could not start", error: reply.error });
  });
  test("marks the job failed when the content script does not answer", async () => {
    pageTab();
    harness.chrome.tabs.sendMessage.mockRejectedValueOnce(new Error("Receiving end does not exist."));
    expect((await send({ type: "offshelf:start", tabId: 7 })).error).toContain("Receiving end does not exist.");
    expect((await listJobs())[0]?.status).toBe("failed");
  });
  test("an unknown tab id surfaces the tabs.get error", async () => {
    expect(await send({ type: "offshelf:start", tabId: 99 })).toEqual({ ok: false, error: "No tab with id: 99." });
  });
});

describe("capture messages from the source tab", () => {
  const source = tabSender(7, PAGE_URL);
  beforeEach(() => putJob(makeJob()));

  test("checkpoint stores the document, pending assets and progress", async () => {
    const snapshot = makeSnapshot([IMAGE_URL]);
    const reply = await send({ type: "offshelf:checkpoint", jobId: "job-1", snapshot, message: "Collected 2 posts" }, source);
    expect(reply).toEqual({ ok: true });
    expect((await getDocument(DOC_ID))?.title).toBe("A title");
    expect(await getAsset(stableId(IMAGE_URL))).toMatchObject({ sourceUrl: IMAGE_URL, status: "pending", bytes: 0, attempts: 0, alt: "pic" });
    expect(await getJob("job-1")).toMatchObject({ message: "Collected 2 posts", posts: 1, images: 1, status: "capturing" });
  });
  test("checkpoint uses a default message and truncates long ones to 300 chars", async () => {
    await send({ type: "offshelf:checkpoint", jobId: "job-1", snapshot: makeSnapshot() }, source);
    expect((await getJob("job-1"))?.message).toBe("Saved capture checkpoint");
    await send({ type: "offshelf:checkpoint", jobId: "job-1", snapshot: makeSnapshot(), message: "x".repeat(400) }, source);
    expect((await getJob("job-1"))?.message).toHaveLength(300);
  });
  test("checkpoint with an invalid snapshot is rejected and nothing is stored", async () => {
    const bad = makeSnapshot([], { sourceUrl: "https://example.com/other" });
    expect((await send({ type: "offshelf:checkpoint", jobId: "job-1", snapshot: bad }, source)).error).toBe("Capture source does not match the authorized tab.");
    expect((await send({ type: "offshelf:checkpoint", jobId: "job-1", snapshot: "nope" }, source)).error).toBe("Invalid document structure.");
    expect(await getDocument(DOC_ID)).toBeUndefined();
  });
  test("finish moves the job to downloading, then done, and opens the reader", async () => {
    await send({ type: "offshelf:checkpoint", jobId: "job-1", snapshot: makeSnapshot([IMAGE_URL]) }, source);
    expect(await send({ type: "offshelf:finish", jobId: "job-1" }, source)).toEqual({ ok: true });
    await waitForStatus("job-1", "done");
    expect(await getJob("job-1")).toMatchObject({ savedImages: 1, images: 1, message: "Saved to your library" });
    expect((await getAsset(stableId(IMAGE_URL)))?.status).toBe("saved");
    expect(harness.chrome.action.setBadgeText).toHaveBeenCalledWith({ tabId: 7, text: "✓" });
    expect(harness.chrome.tabs.create).toHaveBeenCalledWith({ url: `${EXTENSION_ORIGIN}library.html?id=${encodeURIComponent(DOC_ID)}` });
  });
  test("finish reuses an open library tab for the reader", async () => {
    harness.chrome.tabs.query.mockResolvedValue([{ id: 44 }]);
    await send({ type: "offshelf:checkpoint", jobId: "job-1", snapshot: makeSnapshot() }, source);
    await send({ type: "offshelf:finish", jobId: "job-1" }, source);
    await waitForStatus("job-1", "done");
    await vi.waitFor(() => expect(harness.chrome.tabs.update).toHaveBeenCalledWith(44, { url: `${EXTENSION_ORIGIN}library.html?id=${encodeURIComponent(DOC_ID)}`, active: true }));
    expect(harness.chrome.tabs.create).not.toHaveBeenCalled();
  });
  test("finish does not open the reader when the setting is off", async () => {
    await putSettings({ ...(await getSettings()), openReader: false });
    await send({ type: "offshelf:checkpoint", jobId: "job-1", snapshot: makeSnapshot() }, source);
    await send({ type: "offshelf:finish", jobId: "job-1" }, source);
    await waitForStatus("job-1", "done");
    expect(harness.chrome.tabs.create).not.toHaveBeenCalled();
  });
  test("finish without a saved checkpoint interrupts the job", async () => {
    await send({ type: "offshelf:finish", jobId: "job-1" }, source);
    await waitForStatus("job-1", "interrupted");
    expect(await getJob("job-1")).toMatchObject({ error: "The saved document was removed.", message: "Text is saved. Retry the remaining images." });
  });
  test("a second finish is rejected", async () => {
    await send({ type: "offshelf:checkpoint", jobId: "job-1", snapshot: makeSnapshot() }, source);
    await send({ type: "offshelf:finish", jobId: "job-1" }, source);
    expect(await send({ type: "offshelf:finish", jobId: "job-1" }, source)).toEqual({ ok: false, error: "This capture has already stopped." });
    await waitForStatus("job-1", "done");
  });
  test("capture-error fails the job and marks an existing document partial", async () => {
    await putDocument(makeDoc());
    const reply = await send({ type: "offshelf:capture-error", jobId: "job-1", error: "boom" }, source);
    expect(reply).toEqual({ ok: true });
    expect(await getJob("job-1")).toMatchObject({ status: "failed", error: "boom", message: "Capture stopped" });
    const doc = (await getDocument(DOC_ID)) as SavedDocument;
    expect(doc.completeness).toBe("partial");
    expect(doc.warnings).toEqual([{ code: "interrupted", message: "Capture stopped before completion: boom" }]);
    expect(harness.chrome.action.setBadgeText).toHaveBeenCalledWith({ tabId: 7, text: "!" });
  });
  test("capture-error with cancelled:true marks the job cancelled", async () => {
    await send({ type: "offshelf:capture-error", jobId: "job-1", error: "Capture cancelled.", cancelled: true }, source);
    expect(await getJob("job-1")).toMatchObject({ status: "cancelled", message: "Capture cancelled", error: "Capture cancelled." });
  });
  test("capture-error defaults and truncates the error text", async () => {
    await send({ type: "offshelf:capture-error", jobId: "job-1" }, source);
    expect((await getJob("job-1"))?.error).toBe("Capture failed.");
    await putJob(makeJob());
    await send({ type: "offshelf:capture-error", jobId: "job-1", error: "e".repeat(1500) }, source);
    expect((await getJob("job-1"))?.error).toHaveLength(1000);
  });
  test("capture-error replaces an earlier interrupted warning instead of stacking", async () => {
    await putDocument(makeDoc({ warnings: [{ code: "interrupted", message: "old" }, { code: "other", message: "keep" }] }));
    await send({ type: "offshelf:capture-error", jobId: "job-1", error: "new" }, source);
    expect((await getDocument(DOC_ID))?.warnings.map(w => w.code)).toEqual(["other", "interrupted"]);
  });

  test("rejects a missing job id", async () => {
    expect(await send({ type: "offshelf:finish" }, source)).toEqual({ ok: false, error: "Missing capture identifier." });
  });
  test.each([
    ["an unknown job", { jobId: "ghost" }, source],
    ["a different tab", { jobId: "job-1" }, tabSender(8, PAGE_URL)],
    ["a sub-frame", { jobId: "job-1" }, tabSender(7, PAGE_URL, 3)],
    ["a sender with no tab", { jobId: "job-1" }, { id: "test-extension-id", url: PAGE_URL, frameId: 0 }],
  ])("rejects %s", async (_label, extra, sender) => {
    for (const type of ["offshelf:checkpoint", "offshelf:finish", "offshelf:capture-error"]) {
      expect(await send({ type, ...extra, snapshot: makeSnapshot() }, sender)).toEqual({ ok: false, error: "This tab is not authorized for that capture." });
    }
    expect((await getJob("job-1"))?.status).toBe("capturing");
  });
  test("rejects a navigated or URL-less sender and keeps the job capturing", async () => {
    const changed = "The source page changed. Capture was not saved over the original.";
    expect((await send({ type: "offshelf:finish", jobId: "job-1" }, tabSender(7, "https://example.com/elsewhere"))).error).toBe(changed);
    expect((await send({ type: "offshelf:finish", jobId: "job-1" }, { id: "test-extension-id", tab: { id: 7 }, frameId: 0 })).error).toBe(changed);
    expect((await getJob("job-1"))?.status).toBe("capturing");
  });
  test("accepts a sender URL that canonicalises to the source", async () => {
    const sender = tabSender(7, `${PAGE_URL}?utm_source=mail#section`);
    expect(await send({ type: "offshelf:capture-error", jobId: "job-1", error: "x" }, sender)).toEqual({ ok: true });
  });
  test("rejects messages for a job that already stopped", async () => {
    await putJob(makeJob({ status: "done" }));
    for (const type of ["offshelf:checkpoint", "offshelf:finish", "offshelf:capture-error"]) {
      expect(await send({ type, jobId: "job-1", snapshot: makeSnapshot() }, source)).toEqual({ ok: false, error: "This capture has already stopped." });
    }
  });
  test("capture messages do not need an extension-page sender", async () => {
    expect((await send({ type: "offshelf:capture-error", jobId: "job-1" }, source)).ok).toBe(true);
  });
});

describe("offshelf:cancel-job", () => {
  test("cancels an active job and marks the document partial with a warning", async () => {
    await putJob(makeJob());
    await putDocument(makeDoc());
    expect(await send({ type: "offshelf:cancel-job", jobId: "job-1" })).toEqual({ ok: true });
    expect(await getJob("job-1")).toMatchObject({ status: "cancelled", message: "Capture cancelled. Saved checkpoints were retained." });
    const doc = (await getDocument(DOC_ID)) as SavedDocument;
    expect(doc.completeness).toBe("partial");
    expect(doc.warnings).toEqual([{ code: "cancelled", message: "Capture was cancelled. Only the content collected so far was saved." }]);
    expect(harness.chrome.tabs.sendMessage).toHaveBeenCalledWith(7, { type: "offshelf:cancel", jobId: "job-1" });
  });
  test("cancels a downloading job too", async () => {
    await putJob(makeJob({ status: "downloading" }));
    await send({ type: "offshelf:cancel-job", jobId: "job-1" });
    expect(await statusOf("job-1")).toBe("cancelled");
  });
  test("does not stack cancelled warnings and keeps other warnings", async () => {
    await putJob(makeJob());
    await putDocument(makeDoc({ warnings: [{ code: "cancelled", message: "old" }, { code: "paywall", message: "p" }] }));
    await send({ type: "offshelf:cancel-job", jobId: "job-1" });
    expect((await getDocument(DOC_ID))?.warnings.map(w => w.code)).toEqual(["paywall", "cancelled"]);
  });
  test("still cancels when the tab cannot be reached", async () => {
    await putJob(makeJob());
    harness.chrome.tabs.sendMessage.mockRejectedValue(new Error("tab gone"));
    expect(await send({ type: "offshelf:cancel-job", jobId: "job-1" })).toEqual({ ok: true });
    expect(await statusOf("job-1")).toBe("cancelled");
  });
  test("is a no-op for unknown and finished jobs", async () => {
    await putJob(makeJob({ id: "finished", status: "done" }));
    expect(await send({ type: "offshelf:cancel-job", jobId: "ghost" })).toEqual({ ok: true });
    expect(await send({ type: "offshelf:cancel-job", jobId: "finished" })).toEqual({ ok: true });
    expect(await statusOf("finished")).toBe("done");
    expect(harness.chrome.tabs.sendMessage).not.toHaveBeenCalled();
  });
  test("requires a string job id", async () => {
    expect(await send({ type: "offshelf:cancel-job" })).toEqual({ ok: false, error: "Missing identifier." });
  });
});

describe("offshelf:delete", () => {
  test("removes the document, its unshared assets and its jobs", async () => {
    const asset = makeAsset(IMAGE_URL, { status: "saved" });
    await putDocument(makeDoc({ assetIds: [asset.id] }));
    await putAsset(asset);
    await putJob(makeJob({ id: "mine", status: "done" }));
    await putJob(makeJob({ id: "other", documentId: "other-doc", status: "done" }));
    expect(await send({ type: "offshelf:delete", documentId: DOC_ID })).toEqual({ ok: true });
    expect(await getDocument(DOC_ID)).toBeUndefined();
    expect(await getAsset(asset.id)).toBeUndefined();
    expect((await listJobs()).map(job => job.id)).toEqual(["other"]);
  });
  test("cancels an active job for the document before deleting", async () => {
    await putDocument(makeDoc());
    await putJob(makeJob());
    await send({ type: "offshelf:delete", documentId: DOC_ID });
    expect(harness.chrome.tabs.sendMessage).toHaveBeenCalledWith(7, { type: "offshelf:cancel", jobId: "job-1" });
    expect(await getJob("job-1")).toBeUndefined();
  });
  test("deleting an unknown document succeeds", async () => {
    expect(await send({ type: "offshelf:delete", documentId: "ghost" })).toEqual({ ok: true });
  });
  test("requires a string document id", async () => {
    expect(await send({ type: "offshelf:delete" })).toEqual({ ok: false, error: "Missing identifier." });
  });
});

describe("offshelf:retry-images", () => {
  const failedAsset = () => makeAsset(IMAGE_URL, { status: "failed", error: "nope", attempts: 1 });
  test("creates a downloading job and saves the missing images", async () => {
    await putDocument(makeDoc({ assetIds: [stableId(IMAGE_URL)] }));
    await putAsset(failedAsset());
    const reply = await send({ type: "offshelf:retry-images", documentId: DOC_ID });
    expect(reply.ok).toBe(true);
    expect(reply.job).toMatchObject({
      tabId: -1, sourceUrl: PAGE_URL, documentId: DOC_ID, title: "A title", status: "downloading", message: "Retrying missing images…",
      posts: 1, images: 1, savedImages: 0, options: { mode: "auto", autoScroll: false, maxPasses: 1 },
    });
    await waitForStatus(reply.job!.id, "done");
    expect(await getAsset(stableId(IMAGE_URL))).toMatchObject({ status: "saved", attempts: 2, mime: "image/png" });
  });
  test("reuses the tab of the most recent previous job", async () => {
    await putDocument(makeDoc());
    await putJob(makeJob({ id: "old", tabId: 3, status: "done", createdAt: agoIso(9000) }));
    await putJob(makeJob({ id: "newer", tabId: 5, status: "failed", createdAt: agoIso(4000) }));
    expect((await send({ type: "offshelf:retry-images", documentId: DOC_ID })).job?.tabId).toBe(5);
  });
  test.each(["capturing", "downloading"] as const)("rejects when a %s job exists for the document", async status => {
    await putDocument(makeDoc());
    await putJob(makeJob({ status }));
    expect(await send({ type: "offshelf:retry-images", documentId: DOC_ID })).toEqual({ ok: false, error: "A save is already in progress for this document." });
    await putJob(makeJob({ status: "done" }));
  });
  test("rejects an unknown document and a missing id", async () => {
    expect(await send({ type: "offshelf:retry-images", documentId: "ghost" })).toEqual({ ok: false, error: "Document not found." });
    expect(await send({ type: "offshelf:retry-images" })).toEqual({ ok: false, error: "Missing identifier." });
  });
});

describe("recoverJobs", () => {
  test("interrupts a capturing job idle for over 120s and flags the document", async () => {
    await putJob(makeJob({ updatedAt: agoIso(121_000) }));
    await putDocument(makeDoc());
    await recoverJobs();
    expect(await getJob("job-1")).toMatchObject({ status: "interrupted", message: "The capture stopped responding. Saved checkpoints are still available." });
    const doc = (await getDocument(DOC_ID)) as SavedDocument;
    expect(doc.completeness).toBe("partial");
    expect(doc.warnings).toEqual([{ code: "interrupted", message: "Capture was interrupted. Reopen the source page to capture it again." }]);
    expect(harness.chrome.storage.local.set).toHaveBeenCalled();
  });
  test("leaves a fresh capturing job alone", async () => {
    await putJob(makeJob({ updatedAt: agoIso(30_000) }));
    await putDocument(makeDoc());
    await recoverJobs();
    expect(await statusOf("job-1")).toBe("capturing");
    expect((await getDocument(DOC_ID))?.completeness).toBe("unverified");
  });
  test.each(["done", "failed", "cancelled", "interrupted"] as const)("ignores a stale %s job", async status => {
    await putJob(makeJob({ status, updatedAt: agoIso(600_000) }));
    await recoverJobs();
    expect(await statusOf("job-1")).toBe(status);
  });
  test("interrupts without a document present", async () => {
    await putJob(makeJob({ updatedAt: agoIso(300_000) }));
    await recoverJobs();
    expect(await statusOf("job-1")).toBe("interrupted");
  });
  test("restarts a stale downloading job instead of interrupting it", async () => {
    await putDocument(makeDoc({ assetIds: [stableId(IMAGE_URL)] }));
    await putAsset(makeAsset());
    await putJob(makeJob({ status: "downloading", updatedAt: agoIso(300_000) }));
    await recoverJobs();
    await waitForStatus("job-1", "done");
    expect((await getAsset(stableId(IMAGE_URL)))?.status).toBe("saved");
    /* recovery never opens the reader */
    expect(harness.chrome.tabs.create).not.toHaveBeenCalled();
  });
  test("does not notify when there is nothing to recover", async () => {
    await recoverJobs();
    expect(harness.chrome.storage.local.set).not.toHaveBeenCalled();
  });
  test("does not notify when only fresh or finished jobs exist", async () => {
    await putJob(makeJob({ id: "fresh", updatedAt: agoIso(30_000) }));
    await putJob(makeJob({ id: "old-done", status: "done", updatedAt: agoIso(600_000) }));
    await recoverJobs();
    expect(harness.chrome.storage.local.set).not.toHaveBeenCalled();
  });
  test("notifies once when a job was interrupted", async () => {
    await putJob(makeJob({ updatedAt: agoIso(300_000) }));
    await recoverJobs();
    expect(harness.chrome.storage.local.set).toHaveBeenCalledTimes(1);
  });
  test("notifies when a stale download is resumed", async () => {
    await putDocument(makeDoc());
    await putJob(makeJob({ status: "downloading", updatedAt: agoIso(300_000) }));
    await recoverJobs();
    expect(harness.chrome.storage.local.set).toHaveBeenCalled();
    await waitForStatus("job-1", "done");
  });
});

describe("tabs.onRemoved", () => {
  const close = (tabId: number) => harness.nextNotify(() => harness.chrome.tabs.onRemoved.fire(tabId));
  test("interrupts the capturing job and adds one source-closed warning, even when fired twice", async () => {
    await putJob(makeJob());
    await putDocument(makeDoc());
    await close(7);
    expect(await getJob("job-1")).toMatchObject({ status: "interrupted", message: "The source tab was closed. Saved checkpoints were retained." });
    const warnings = () => getDocument(DOC_ID).then(doc => doc?.warnings ?? []);
    expect(await warnings()).toEqual([{ code: "source-closed", message: "The source tab closed before capture completed." }]);
    expect((await getDocument(DOC_ID))?.completeness).toBe("partial");
    await close(7);
    expect(await warnings()).toHaveLength(1);
  });
  test("leaves other tabs and non-capturing jobs alone", async () => {
    await putJob(makeJob({ id: "other-tab", tabId: 8 }));
    await putJob(makeJob({ id: "dl", tabId: 7, status: "downloading" }));
    await close(7);
    expect(await statusOf("other-tab")).toBe("capturing");
    expect(await statusOf("dl")).toBe("downloading");
    await putJob(makeJob({ id: "dl", tabId: 7, status: "done" }));
  });
});

describe("browser event wiring", () => {
  test("onInstalled registers context menus and the recovery alarm", async () => {
    harness.chrome.runtime.onInstalled.fire({ reason: "install" });
    await vi.waitFor(() => expect(harness.chrome.contextMenus.create).toHaveBeenCalledTimes(2));
    expect(harness.chrome.contextMenus.removeAll).toHaveBeenCalled();
    expect(harness.chrome.contextMenus.create).toHaveBeenCalledWith({ id: "offshelf-save", title: "Save page to Offshelf", contexts: ["page"], documentUrlPatterns: ["http://*/*", "https://*/*"] });
    expect(harness.chrome.contextMenus.create).toHaveBeenCalledWith({ id: "offshelf-selection", title: "Save selection to Offshelf", contexts: ["selection"] });
    expect(harness.chrome.alarms.create).toHaveBeenCalledWith("offshelf-recover", { periodInMinutes: 1 });
  });
  test("onStartup recreates the alarm and recovers jobs", async () => {
    await putJob(makeJob({ updatedAt: agoIso(300_000) }));
    harness.chrome.runtime.onStartup.fire();
    expect(harness.chrome.alarms.create).toHaveBeenCalledWith("offshelf-recover", { periodInMinutes: 1 });
    await waitForStatus("job-1", "interrupted");
  });
  test("only the recovery alarm triggers recovery", async () => {
    await putJob(makeJob({ updatedAt: agoIso(300_000) }));
    harness.chrome.alarms.onAlarm.fire({ name: "something-else" });
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(await statusOf("job-1")).toBe("capturing");
    await harness.nextNotify(() => harness.chrome.alarms.onAlarm.fire({ name: "offshelf-recover" }));
    expect(await statusOf("job-1")).toBe("interrupted");
  });
  test("context menu clicks start capture in the matching mode", async () => {
    pageTab(7);
    harness.chrome.contextMenus.onClicked.fire({ menuItemId: "offshelf-selection" }, { id: 7 });
    await vi.waitFor(async () => expect((await listJobs())[0]?.options.mode).toBe("selection"));
    await resetDatabase();
    harness.chrome.contextMenus.onClicked.fire({ menuItemId: "offshelf-save" }, { id: 7 });
    await vi.waitFor(async () => expect((await listJobs())[0]?.options.mode).toBe("auto"));
  });
  test("context menu clicks without a tab or on blocked pages are ignored", async () => {
    harness.chrome.contextMenus.onClicked.fire({ menuItemId: "offshelf-save" }, undefined);
    harness.addTab({ id: 2, url: "chrome://settings" });
    harness.chrome.contextMenus.onClicked.fire({ menuItemId: "offshelf-save" }, { id: 2 });
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(await listJobs()).toEqual([]);
  });
  test("keyboard commands open the library or save the page", async () => {
    pageTab(7);
    harness.chrome.commands.onCommand.fire("open-library", undefined);
    expect(harness.chrome.tabs.create).toHaveBeenCalledWith({ url: `${EXTENSION_ORIGIN}library.html` });
    harness.chrome.commands.onCommand.fire("save-page", { id: 7 });
    await vi.waitFor(async () => expect((await listJobs())[0]).toMatchObject({ tabId: 7, status: "capturing", options: { mode: "auto" } }));
    harness.chrome.commands.onCommand.fire("other", { id: 7 });
  });
});

describe("failure reporting", () => {
  let errorLog: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { errorLog = vi.spyOn(console, "error").mockImplementation(() => {}); });
  afterEach(() => errorLog.mockRestore());

  test("a failed context menu capture sets the badge and logs without page data", async () => {
    harness.addTab({ id: 2, url: "chrome://settings", title: "Secret title" });
    harness.chrome.contextMenus.onClicked.fire({ menuItemId: "offshelf-save" }, { id: 2 });
    await vi.waitFor(() => expect(harness.chrome.action.setBadgeText).toHaveBeenCalledWith({ tabId: 2, text: "!" }));
    expect(errorLog).toHaveBeenCalledWith("[offshelf] capture failed", { tabId: 2, error: expect.stringMatching(/^Open an http or https article first/) });
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain("Secret title");
  });
  test("a failed keyboard capture sets the badge and logs", async () => {
    harness.chrome.commands.onCommand.fire("save-page", { id: 99 });
    await vi.waitFor(() => expect(errorLog).toHaveBeenCalledWith("[offshelf] capture failed", { tabId: 99, error: "No tab with id: 99." }));
    expect(harness.chrome.action.setBadgeText).toHaveBeenCalledWith({ tabId: 99, text: "!" });
  });
  test("a closed tab does not turn the badge failure into an unhandled rejection", async () => {
    harness.chrome.action.setBadgeText.mockRejectedValue(new Error("No tab with id"));
    harness.chrome.commands.onCommand.fire("save-page", { id: 99 });
    await vi.waitFor(() => expect(errorLog).toHaveBeenCalledWith("[offshelf] capture failed", expect.objectContaining({ tabId: 99 })));
  });
  test("successful captures do not log or flag the badge", async () => {
    pageTab(7);
    harness.chrome.commands.onCommand.fire("save-page", { id: 7 });
    await vi.waitFor(async () => expect(await listJobs()).toHaveLength(1));
    expect(errorLog).not.toHaveBeenCalled();
    expect(harness.chrome.action.setBadgeText).not.toHaveBeenCalledWith({ tabId: 7, text: "!" });
  });
  test("a second trigger on a busy tab logs but keeps the running badge", async () => {
    pageTab(7);
    await startCapture(7);
    harness.chrome.action.setBadgeText.mockClear();
    harness.chrome.commands.onCommand.fire("save-page", { id: 7 });
    await vi.waitFor(() => expect(errorLog).toHaveBeenCalledWith("[offshelf] capture failed", { tabId: 7, error: "This tab already has a capture in progress." }));
    expect(harness.chrome.action.setBadgeText).not.toHaveBeenCalledWith({ tabId: 7, text: "!" });
  });
  test("a failing message handler replies with the error and logs the message type", async () => {
    expect(await send({ type: "offshelf:nope" })).toEqual({ ok: false, error: "Unknown Offshelf action." });
    expect(errorLog).toHaveBeenCalledWith("[offshelf] message failed", { type: "offshelf:nope", error: "Unknown Offshelf action." });
  });
  test("a tabs.onRemoved failure is logged with the tab id", async () => {
    harness.chrome.storage.local.set.mockRejectedValue(new Error("quota"));
    await putJob(makeJob());
    harness.chrome.tabs.onRemoved.fire(7);
    await vi.waitFor(() => expect(errorLog).toHaveBeenCalledWith("[offshelf] tab close handling failed", { tabId: 7, error: "quota" }));
  });
  test("a background download failure is logged with the job id", async () => {
    await putDocument(makeDoc({ assetIds: [stableId(IMAGE_URL)] }));
    await putAsset(makeAsset());
    harness.chrome.storage.local.set.mockRejectedValue(new Error("quota"));
    const reply = await send({ type: "offshelf:retry-images", documentId: DOC_ID });
    expect(reply.ok).toBe(false);
    await vi.waitFor(() => expect(errorLog).toHaveBeenCalledWith("[offshelf] download failed", { jobId: expect.any(String), error: "quota" }));
  });
});

describe("concurrent capture triggers", () => {
  test("two simultaneous starts on one tab create exactly one job", async () => {
    pageTab(7);
    const results = await Promise.allSettled([startCapture(7), startCapture(7)]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find(result => result.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason.message).toBe("This tab already has a capture in progress.");
    expect(await listJobs()).toHaveLength(1);
    expect(harness.chrome.scripting.executeScript).toHaveBeenCalledTimes(1);
  });
  test("starts on different tabs both succeed", async () => {
    pageTab(7);
    pageTab(8);
    await Promise.all([startCapture(7), startCapture(8)]);
    expect(await listJobs()).toHaveLength(2);
  });
});

describe("settings validation in capture", () => {
  test("a corrupt stored maxPasses falls back to the default and capture still runs passes", async () => {
    pageTab();
    await putSettings({ maxPasses: "abc", autoScroll: "yes" } as unknown as Settings);
    const reply = await send({ type: "offshelf:start", tabId: 7 });
    expect(reply.job?.options).toEqual({ mode: "auto", autoScroll: true, maxPasses: 24 });
    expect(harness.chrome.tabs.sendMessage).toHaveBeenCalledWith(7, { type: "offshelf:run", job: reply.job });
  });
  test("a raw corrupt settings record is read back as a working default", async () => {
    pageTab();
    const database = await db();
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction("settings", "readwrite");
      tx.objectStore("settings").put({ maxPasses: "abc", fontSize: Infinity }, "reader");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    expect((await send({ type: "offshelf:start", tabId: 7 })).job?.options.maxPasses).toBe(24);
  });
});
