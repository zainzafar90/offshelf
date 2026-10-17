import { Blob as NodeBlob } from "node:buffer";
import { estimateBackupBytes, exportBackup, importBackup } from "../../src/storage/backup";
import { LIMITS } from "../../src/core/model";
import type { Asset } from "../../src/core/model";
import { stableId } from "../../src/core/identity";
import { downloadBlob } from "../../src/storage/file-download";
import { getAsset, getDocument, listAssets, listDocuments, putAsset, putDocument } from "../../src/storage/library-store";
import { sampleDocument } from "../helpers/fixtures";
import { PNG_BYTES } from "../helpers/jobs";
import { resetDatabase } from "../helpers/reset-db";

/* jsdom's FileReader rejects the Node Blobs that fake-indexeddb stores, so read bytes directly. */
vi.mock("../../src/storage/file-download", () => ({
  downloadBlob: vi.fn(),
  blobToDataUrl: async (blob: Blob) => `data:image/png;base64,${Buffer.from(await blob.arrayBuffer()).toString("base64")}`,
}));

const IMG = "https://img.example.com/a.png";
const IMG_ID = stableId(IMG);
const PNG_DATA_URL = `data:image/png;base64,${Buffer.from(PNG_BYTES).toString("base64")}`;
const backupFile = (body: unknown) => new File([JSON.stringify(body)], "b.offshelf.json", { type: "application/json" });
const backupOf = (documents: unknown[], assets: unknown[] = []) => ({ format: "offshelf-backup", version: 1, exportedAt: "2026-09-01T00:00:00.000Z", documents, assets });
const imageDoc = (overrides = {}) => sampleDocument({ id: "img-doc", assetIds: [IMG_ID], ...overrides });
const imageEntry = (overrides = {}) => ({ id: IMG_ID, sourceUrl: IMG, alt: "pic", data: PNG_DATA_URL, ...overrides });

beforeEach(async () => {
  await resetDatabase();
  vi.mocked(downloadBlob).mockClear();
});

test("imports a 0.3.0 backup file", async () => {
  const backup = { format: "offshelf-backup", version: 1, exportedAt: "2026-09-01T00:00:00.000Z", documents: [sampleDocument({ id: "bk" })], assets: [] };
  const file = new File([JSON.stringify(backup)], "offshelf-backup.offshelf.json", { type: "application/json" });
  expect(await importBackup(file)).toEqual({ added: 1, skipped: 0 });
  expect((await getDocument("bk"))?.title).toBe("A title");
});

test("rejects a file that is not an Offshelf backup", async () => {
  const file = new File([JSON.stringify({ format: "other" })], "x.json");
  await expect(importBackup(file)).rejects.toThrow("Offshelf library backup");
});

test("estimateBackupBytes accounts for base64 growth", () => {
  const mb = 1024 * 1024;
  expect(estimateBackupBytes(3)).toBe(4);
  expect(estimateBackupBytes(200 * mb)).toBeGreaterThan(LIMITS.maxBackupBytes);
  expect(estimateBackupBytes(180 * mb)).toBeLessThanOrEqual(LIMITS.maxBackupBytes);
});

describe("importBackup validation", () => {
  test.each([
    ["wrong format", { ...backupOf([]), format: "other" }],
    ["wrong version", { ...backupOf([]), version: 2 }],
    ["missing documents", { format: "offshelf-backup", version: 1, assets: [] }],
    ["missing assets", { format: "offshelf-backup", version: 1, documents: [] }],
    ["a JSON null", null],
  ])("rejects %s", async (_label, body) => {
    await expect(importBackup(backupFile(body))).rejects.toThrow("Select an Offshelf library backup (.offshelf.json).");
  });
  test("rejects invalid JSON with the parser error", async () => {
    await expect(importBackup(new File(["{nope"], "x.json"))).rejects.toThrow(SyntaxError);
  });
  test("rejects a file over the 250 MB limit before reading it", async () => {
    const huge = { size: LIMITS.maxBackupBytes + 1, text: vi.fn() } as unknown as File;
    await expect(importBackup(huge)).rejects.toThrow("This backup exceeds the 250 MB import limit.");
    expect(huge.text).not.toHaveBeenCalled();
  });
  test("rejects too many documents or assets", async () => {
    await expect(importBackup(backupFile(backupOf(new Array(5001).fill(0))))).rejects.toThrow("Backup collection limit exceeded.");
    await expect(importBackup(backupFile(backupOf([], new Array(20_001).fill(0))))).rejects.toThrow("Backup collection limit exceeded.");
  });
  test("rejects an invalid document and stores nothing", async () => {
    await expect(importBackup(backupFile(backupOf([sampleDocument({ id: "ok" }), { schemaVersion: 2 }])))).rejects.toThrow("This document version is not supported.");
    expect(await listDocuments()).toEqual([]);
  });
  test("rejects an incomplete image manifest", async () => {
    const file = backupFile(backupOf([imageDoc()], []));
    await expect(importBackup(file)).rejects.toThrow("The backup image manifest is incomplete.");
    expect(await listDocuments()).toEqual([]);
  });
  test.each([
    ["a null entry", null],
    ["a non-string source URL", imageEntry({ sourceUrl: 5 })],
    ["an unsafe source URL", imageEntry({ sourceUrl: "javascript:alert(1)" })],
    ["an id that does not match the URL", imageEntry({ id: "forged" })],
  ])("rejects %s as an invalid image reference", async (_label, entry) => {
    await expect(importBackup(backupFile(backupOf([sampleDocument()], [entry])))).rejects.toThrow("The backup contains an invalid image reference.");
  });
  test.each([
    ["a non-string payload", 42],
    ["a non-image data URL", "data:text/html;base64,PGI+"],
    ["an SVG data URL", "data:image/svg+xml;base64,PHN2Zz4="],
    ["non-base64 data", "data:image/png;base64,***"],
  ])("rejects %s as unsupported image data", async (_label, data) => {
    await expect(importBackup(backupFile(backupOf([imageDoc()], [imageEntry({ data })])))).rejects.toThrow("Unsupported image data in backup.");
  });
  test("rejects image data whose bytes are not an image", async () => {
    const data = `data:image/png;base64,${btoa("<html>script</html>")}`;
    await expect(importBackup(backupFile(backupOf([imageDoc()], [imageEntry({ data })])))).rejects.toThrow("An image in the backup has an invalid file signature.");
  });
});

describe("importBackup storing", () => {
  test("skips a document that already exists and keeps the stored copy", async () => {
    await putDocument(sampleDocument({ id: "dup", title: "Local copy" }));
    const result = await importBackup(backupFile(backupOf([sampleDocument({ id: "dup", title: "Backup copy" }), sampleDocument({ id: "new" })])));
    expect(result).toEqual({ added: 1, skipped: 1 });
    expect((await getDocument("dup"))?.title).toBe("Local copy");
    expect(await getDocument("new")).toBeDefined();
  });
  test("importing the same backup twice adds nothing the second time", async () => {
    const file = () => backupFile(backupOf([sampleDocument({ id: "once" })]));
    expect(await importBackup(file())).toEqual({ added: 1, skipped: 0 });
    expect(await importBackup(file())).toEqual({ added: 0, skipped: 1 });
  });
  test("saves image data as a saved asset with a sniffed mime type", async () => {
    await importBackup(backupFile(backupOf([imageDoc()], [imageEntry()])));
    expect(await getAsset(IMG_ID)).toMatchObject({ status: "saved", bytes: PNG_BYTES.length, mime: "image/png", alt: "pic", sourceUrl: IMG, error: undefined });
  });
  test("stores an entry without data as a failed asset", async () => {
    await importBackup(backupFile(backupOf([imageDoc()], [imageEntry({ data: undefined, alt: 7 })])));
    expect(await getAsset(IMG_ID)).toMatchObject({ status: "failed", bytes: 0, alt: "", error: "Image was not present in the backup." });
  });
  test("ignores assets that no imported document references", async () => {
    await importBackup(backupFile(backupOf([sampleDocument()], [imageEntry()])));
    expect(await listAssets()).toEqual([]);
  });
  test("does not replace an already saved asset but does replace an unsaved one", async () => {
    const stored: Asset = { id: IMG_ID, sourceUrl: IMG, alt: "", status: "saved", bytes: 99, mime: "image/png", attempts: 1, updatedAt: "2026-09-01T00:00:00.000Z" };
    await putAsset(stored);
    await importBackup(backupFile(backupOf([imageDoc()], [imageEntry()])));
    expect((await getAsset(IMG_ID))?.bytes).toBe(99);
    await resetDatabase();
    await putAsset({ ...stored, status: "failed", bytes: 0 });
    await importBackup(backupFile(backupOf([imageDoc()], [imageEntry()])));
    expect(await getAsset(IMG_ID)).toMatchObject({ status: "saved", bytes: PNG_BYTES.length });
  });
});

describe("exportBackup", () => {
  const savedAsset = (): Asset => ({ id: IMG_ID, sourceUrl: IMG, alt: "pic", status: "saved", bytes: PNG_BYTES.length, mime: "image/png", attempts: 1,
    updatedAt: "2026-09-01T00:00:00.000Z", blob: new NodeBlob([PNG_BYTES], { type: "image/png" }) as unknown as Blob });
  const exported = async () => {
    const [blob, name] = vi.mocked(downloadBlob).mock.calls[0]!;
    return { blob, name, json: JSON.parse(await blob.text()) };
  };

  test("downloads a dated offshelf-backup v1 JSON file", async () => {
    await putDocument(sampleDocument({ id: "one" }));
    await exportBackup();
    const { blob, name, json } = await exported();
    expect(name).toMatch(/^offshelf-backup-\d{4}-\d{2}-\d{2}\.offshelf\.json$/);
    expect(blob.type).toBe("application/json");
    expect(json).toMatchObject({ format: "offshelf-backup", version: 1, assets: [] });
    expect(json.documents.map((doc: { id: string }) => doc.id)).toEqual(["one"]);
    expect(typeof json.exportedAt).toBe("string");
  });
  test("encodes images as data URLs without the blob field", async () => {
    await putDocument(imageDoc());
    await putAsset(savedAsset());
    await putAsset({ ...savedAsset(), id: "no-blob", blob: undefined, status: "failed", bytes: 0 });
    await exportBackup();
    const { json } = await exported();
    const byId = Object.fromEntries(json.assets.map((a: { id: string }) => [a.id, a]));
    expect(byId[IMG_ID]).toMatchObject({ sourceUrl: IMG, status: "saved", mime: "image/png", data: PNG_DATA_URL });
    expect(byId["no-blob"]).not.toHaveProperty("data");
    expect(byId[IMG_ID]).not.toHaveProperty("blob");
  });
  test("refuses a library whose encoded size exceeds the backup limit", async () => {
    await putAsset({ ...savedAsset(), bytes: 200 * 1024 * 1024 });
    await expect(exportBackup()).rejects.toThrow("This library is too large for a single JSON backup.");
    expect(downloadBlob).not.toHaveBeenCalled();
  });
  test("round trips documents and images through export then import", async () => {
    await putDocument(imageDoc({ title: "Round trip", starred: true, tags: ["a"] }));
    await putDocument(sampleDocument({ id: "plain" }));
    await putAsset(savedAsset());
    await exportBackup();
    const { blob } = await exported();
    await resetDatabase();
    expect(await importBackup(new File([await blob.text()], "restore.offshelf.json"))).toEqual({ added: 2, skipped: 0 });
    const restored = (await listDocuments()).sort((a, b) => a.id.localeCompare(b.id));
    expect(restored.map(doc => [doc.id, doc.title, doc.starred, doc.tags, doc.assetIds])).toEqual([["img-doc", "Round trip", true, ["a"], [IMG_ID]], ["plain", "A title", false, [], []]]);
    /* current behavior: import re-validates, so unsafe hrefs are dropped and word counts recomputed */
    expect(JSON.stringify(restored)).not.toContain("javascript:");
    expect(restored[0]?.wordCount).toBeGreaterThan(0);
    expect(await getAsset(IMG_ID)).toMatchObject({ status: "saved", bytes: PNG_BYTES.length, mime: "image/png", alt: "pic", sourceUrl: IMG });
    expect(await importBackup(new File([await blob.text()], "again.offshelf.json"))).toEqual({ added: 0, skipped: 2 });
  });
});
