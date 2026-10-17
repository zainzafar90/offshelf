import { DEFAULT_SETTINGS } from "../../src/core/model";
import type { Settings } from "../../src/core/model";
import { stableId } from "../../src/core/identity";
import * as connection from "../../src/storage/connection";
import * as jobStore from "../../src/storage/job-store";
import * as libraryStore from "../../src/storage/library-store";
import { IMAGE_URL, PAGE_URL, makeAsset, makeDoc, makeJob } from "../helpers/jobs";
import { resetDatabase } from "../helpers/reset-db";

const store = { ...connection, ...jobStore, ...libraryStore };

const DOC_ID = stableId(PAGE_URL);
const OTHER_URL = "https://img.example.com/other.png";

beforeEach(resetDatabase);

async function putRawSettings(value: unknown): Promise<void> {
  const database = await store.db();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction("settings", "readwrite");
    tx.objectStore("settings").put(value, "reader");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function rawSettings(): Promise<unknown> {
  const database = await store.db();
  return new Promise((resolve, reject) => {
    const req = database.transaction("settings").objectStore("settings").get("reader");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

describe("mutateJob", () => {
  test("applies the change, persists it and returns the new job", async () => {
    await store.putJob(makeJob());
    const next = await store.mutateJob("job-1", job => ({ ...job, status: "downloading", message: "go" }));
    expect(next).toMatchObject({ id: "job-1", status: "downloading", message: "go" });
    expect(await store.getJob("job-1")).toEqual(next);
  });
  test("passes the stored job to the mutator", async () => {
    await store.putJob(makeJob({ posts: 4 }));
    const seen = vi.fn(() => undefined);
    await store.mutateJob("job-1", seen);
    expect(seen).toHaveBeenCalledWith(expect.objectContaining({ id: "job-1", posts: 4 }));
  });
  test("returns undefined and writes nothing when the mutator returns undefined", async () => {
    const job = makeJob();
    await store.putJob(job);
    expect(await store.mutateJob("job-1", () => undefined)).toBeUndefined();
    expect(await store.getJob("job-1")).toEqual(job);
  });
  test("returns undefined without calling the mutator when the job is missing", async () => {
    const change = vi.fn();
    expect(await store.mutateJob("ghost", change)).toBeUndefined();
    expect(change).not.toHaveBeenCalled();
    expect(await store.listJobs()).toEqual([]);
  });
  test("concurrent mutations serialise so only one wins a status race", async () => {
    await store.putJob(makeJob());
    const claim = (status: "cancelled" | "downloading") => store.mutateJob("job-1", job => job.status === "capturing" ? { ...job, status } : undefined);
    const results = await Promise.all([claim("cancelled"), claim("downloading")]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });
});

describe("saveCaptureCheckpoint", () => {
  const checkpoint = (overrides = {}, assets = [makeAsset()]) =>
    store.saveCaptureCheckpoint("job-1", makeDoc({ assetIds: assets.map(a => a.id), title: "Fresh", ...overrides }), assets, "Collected");

  test("writes document, assets and job progress together", async () => {
    await store.putJob(makeJob());
    await checkpoint();
    expect((await store.getDocument(DOC_ID))?.title).toBe("Fresh");
    expect(await store.getAsset(stableId(IMAGE_URL))).toMatchObject({ status: "pending" });
    expect(await store.getJob("job-1")).toMatchObject({ documentId: DOC_ID, title: "Fresh", posts: 1, images: 1, message: "Collected", status: "capturing" });
  });
  test("keeps reader state and excluded sections from the stored document", async () => {
    const section = makeDoc().sections[0]!;
    await store.putJob(makeJob());
    await store.putDocument(makeDoc({ starred: true, archived: true, read: true, progress: 0.4, tags: ["keep"], capturedAt: "2020-01-01T00:00:00.000Z",
      sections: [{ ...section, excluded: true }] }));
    await checkpoint({ sections: [{ ...section, excluded: false }, { ...section, id: "s2" }] });
    expect(await store.getDocument(DOC_ID)).toMatchObject({
      title: "Fresh", starred: true, archived: true, read: true, progress: 0.4, tags: ["keep"], capturedAt: "2020-01-01T00:00:00.000Z",
    });
    expect((await store.getDocument(DOC_ID))?.sections.map(s => [s.id, s.excluded])).toEqual([["s1", true], ["s2", false]]);
  });
  test("never overwrites an existing asset", async () => {
    await store.putJob(makeJob());
    await store.putAsset(makeAsset(IMAGE_URL, { status: "saved", bytes: 9 }));
    await checkpoint();
    expect(await store.getAsset(stableId(IMAGE_URL))).toMatchObject({ status: "saved", bytes: 9 });
  });
  test.each([
    ["missing", undefined],
    ["not capturing", { status: "downloading" as const }],
    ["for a different source", { sourceUrl: "https://example.com/other" }],
  ])("rejects when the job is %s and writes nothing", async (_label, job) => {
    if (job) await store.putJob(makeJob(job));
    await expect(checkpoint()).rejects.toThrow("This capture has already stopped.");
    expect(await store.getDocument(DOC_ID)).toBeUndefined();
    expect(await store.getAsset(stableId(IMAGE_URL))).toBeUndefined();
  });
  test("rejects a document id collision with a different source URL", async () => {
    await store.putJob(makeJob());
    await store.putDocument(makeDoc({ sourceUrl: "https://example.com/impostor", title: "Original" }));
    await expect(checkpoint()).rejects.toThrow("Document identifier collision.");
    expect((await store.getDocument(DOC_ID))?.title).toBe("Original");
  });
  test("rejects an asset id collision and rolls back the document", async () => {
    await store.putJob(makeJob());
    await store.putAsset(makeAsset(IMAGE_URL, { sourceUrl: "https://img.example.com/impostor.png" }));
    await expect(checkpoint()).rejects.toThrow("Image identifier collision.");
    expect(await store.getDocument(DOC_ID)).toBeUndefined();
    expect((await store.getJob("job-1"))?.message).toBe("Reading the page…");
  });
});

describe("saveDownloadedAsset", () => {
  const saved = (overrides = {}) => makeAsset(IMAGE_URL, { status: "saved", bytes: 12, mime: "image/png", ...overrides });
  test("stores the asset and reports progress", async () => {
    await store.putDocument(makeDoc());
    await store.putJob(makeJob({ status: "downloading" }));
    expect(await store.saveDownloadedAsset("job-1", saved(), 1, 3)).toBe(true);
    expect(await store.getAsset(stableId(IMAGE_URL))).toMatchObject({ status: "saved", bytes: 12 });
    expect(await store.getJob("job-1")).toMatchObject({ savedImages: 1, images: 3, message: "Saving images · 1 of 3 available offline" });
  });
  test("never lowers the saved image count", async () => {
    await store.putDocument(makeDoc());
    await store.putJob(makeJob({ status: "downloading", savedImages: 5 }));
    await store.saveDownloadedAsset("job-1", saved(), 2, 6);
    expect(await store.getJob("job-1")).toMatchObject({ savedImages: 5, message: "Saving images · 5 of 6 available offline" });
  });
  test.each([
    ["the job is missing", undefined, true],
    ["the job is not downloading", { status: "cancelled" as const }, true],
    ["the document is missing", { status: "downloading" as const }, false],
  ])("returns false and stores nothing when %s", async (_label, job, withDoc) => {
    if (withDoc) await store.putDocument(makeDoc());
    if (job) await store.putJob(makeJob(job));
    expect(await store.saveDownloadedAsset("job-1", saved(), 1, 1)).toBe(false);
    expect(await store.getAsset(stableId(IMAGE_URL))).toBeUndefined();
    if (job) expect((await store.getJob("job-1"))?.message).toBe("Reading the page…");
  });
});

describe("deleteDocument", () => {
  test("keeps assets shared with another document and removes unshared ones", async () => {
    const shared = makeAsset(IMAGE_URL), unshared = makeAsset(OTHER_URL);
    await store.putAsset(shared);
    await store.putAsset(unshared);
    await store.putDocument(makeDoc({ assetIds: [shared.id, unshared.id] }));
    await store.putDocument(makeDoc({ id: "other-doc", sourceUrl: "https://example.com/other", assetIds: [shared.id] }));
    await store.deleteDocument(DOC_ID);
    expect(await store.getDocument(DOC_ID)).toBeUndefined();
    expect(await store.getDocument("other-doc")).toBeDefined();
    expect(await store.getAsset(shared.id)).toBeDefined();
    expect(await store.getAsset(unshared.id)).toBeUndefined();
  });
  test("removes only the jobs that belong to the document", async () => {
    await store.putDocument(makeDoc());
    await store.putJob(makeJob({ id: "mine-1", status: "done" }));
    await store.putJob(makeJob({ id: "mine-2", status: "failed" }));
    await store.putJob(makeJob({ id: "theirs", documentId: "other-doc" }));
    await store.deleteDocument(DOC_ID);
    expect((await store.listJobs()).map(job => job.id)).toEqual(["theirs"]);
  });
  test("leaves unrelated assets alone and tolerates a missing document", async () => {
    const stray = makeAsset(OTHER_URL);
    await store.putAsset(stray);
    await expect(store.deleteDocument("ghost")).resolves.toBeUndefined();
    expect(await store.getAsset(stray.id)).toBeDefined();
  });
});

describe("updateDocument", () => {
  test("throws for a missing id and creates nothing", async () => {
    await expect(store.updateDocument("ghost", { starred: true })).rejects.toThrow("This document is no longer in your library.");
    expect(await store.listDocuments()).toEqual([]);
  });
  test("returns the stored result and refreshes updatedAt", async () => {
    await store.putDocument(makeDoc());
    const updated = await store.updateDocument(DOC_ID, { starred: true, id: "hijack" });
    expect(updated).toMatchObject({ id: DOC_ID, starred: true });
    expect(updated.updatedAt).not.toBe("2026-09-01T10:00:00.000Z");
    expect(await store.getDocument(DOC_ID)).toEqual(updated);
  });
});

describe("updateDocument validation", () => {
  test("rejects a patch that makes the document invalid and stores nothing", async () => {
    const stored = makeDoc();
    await store.putDocument(stored);
    await expect(store.updateDocument(DOC_ID, { tags: Array.from({ length: 31 }, (_, i) => `t${i}`) })).rejects.toThrow("Invalid or oversized document collection.");
    await expect(store.updateDocument(DOC_ID, { kind: "podcast" as never })).rejects.toThrow("Unsupported source type.");
    expect(await store.getDocument(DOC_ID)).toEqual(stored);
  });
  test("stores the validated document, not the raw patch", async () => {
    await store.putDocument(makeDoc());
    const updated = await store.updateDocument(DOC_ID, { progress: 5, title: "Renamed" });
    expect(updated).toMatchObject({ progress: 1, title: "Renamed" });
    expect(await store.getDocument(DOC_ID)).toEqual(updated);
  });
});

describe("createJobIfTabIdle", () => {
  test("inserts the job when the tab has no active job", async () => {
    expect(await store.createJobIfTabIdle(makeJob({ id: "a" }))).toBe(true);
    expect((await store.getJob("a"))?.id).toBe("a");
  });
  test.each(["capturing", "downloading"] as const)("refuses when the tab has a %s job", async status => {
    await store.putJob(makeJob({ id: "busy", status }));
    expect(await store.createJobIfTabIdle(makeJob({ id: "b" }))).toBe(false);
    expect(await store.getJob("b")).toBeUndefined();
  });
  test.each(["done", "failed", "cancelled", "interrupted"] as const)("ignores a %s job and other tabs", async status => {
    await store.putJob(makeJob({ id: "old", status }));
    await store.putJob(makeJob({ id: "elsewhere", tabId: 9 }));
    expect(await store.createJobIfTabIdle(makeJob({ id: "c" }))).toBe(true);
  });
  test("concurrent calls for one tab admit exactly one", async () => {
    const results = await Promise.all([1, 2, 3, 4].map(n => store.createJobIfTabIdle(makeJob({ id: `race-${n}` }))));
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await store.listJobs()).toHaveLength(1);
  });
});

describe("settings", () => {
  test("getSettings returns the defaults when nothing is stored", async () => {
    expect(await store.getSettings()).toEqual(DEFAULT_SETTINGS);
  });
  test("getSettings merges stored values over the defaults", async () => {
    await store.putSettings({ fontSize: 26, theme: "dark" } as Partial<Settings> as Settings);
    expect(await store.getSettings()).toEqual({ ...DEFAULT_SETTINGS, fontSize: 26, theme: "dark" });
  });
  test("getSettings repairs a corrupt stored record field by field", async () => {
    await putRawSettings({ maxPasses: "abc", theme: "neon", fontSize: 99, autoScroll: false });
    expect(await store.getSettings()).toEqual({ ...DEFAULT_SETTINGS, fontSize: 26, autoScroll: false });
  });
  test("putSettings stores only validated values", async () => {
    await store.putSettings({ ...DEFAULT_SETTINGS, maxPasses: 500, theme: "neon" as never });
    expect(await store.getSettings()).toEqual({ ...DEFAULT_SETTINGS, maxPasses: 80 });
    expect(await rawSettings()).toEqual({ ...DEFAULT_SETTINGS, maxPasses: 80 });
  });
  test("putSettings replaces the previous value", async () => {
    await store.putSettings({ ...DEFAULT_SETTINGS, fontSize: 30 });
    await store.putSettings({ ...DEFAULT_SETTINGS, autoScroll: false });
    expect(await store.getSettings()).toEqual({ ...DEFAULT_SETTINGS, autoScroll: false });
  });
});

describe("list and get helpers", () => {
  test("return undefined or empty lists for missing data", async () => {
    expect(await store.getDocument("x")).toBeUndefined();
    expect(await store.getAsset("x")).toBeUndefined();
    expect(await store.getJob("x")).toBeUndefined();
    expect([await store.listDocuments(), await store.listAssets(), await store.listJobs()]).toEqual([[], [], []]);
  });
});
