import * as store from "../../src/storage/library-store";
import type { Asset } from "../../src/core/model";
import { sampleDocument } from "../helpers/fixtures";

describe("database", () => {
  test("round-trips a document", async () => {
    await store.putDocument(sampleDocument({ id: "rt" }));
    expect((await store.getDocument("rt"))?.title).toBe("A title");
  });
  test("settings fall back to defaults", async () => {
    const settings = await store.getSettings();
    expect(settings.fontSize).toBe(20);
    expect(settings.readerFont).toBe("serif");
  });
  test("updateDocument patches fields but keeps id and sourceUrl", async () => {
    await store.putDocument(sampleDocument({ id: "up" }));
    await store.updateDocument("up", { starred: true, sourceUrl: "https://evil.example/" });
    const doc = await store.getDocument("up");
    expect(doc?.starred).toBe(true);
    expect(doc?.sourceUrl).toBe("https://example.com/post");
  });
  test("updateDocument on a missing document throws", async () => {
    await expect(store.updateDocument("nope", { starred: true })).rejects.toThrow("no longer in your library");
  });
  test("deleteDocument removes it", async () => {
    await store.putDocument(sampleDocument({ id: "del" }));
    await store.deleteDocument("del");
    expect(await store.getDocument("del")).toBeUndefined();
  });
  test("assetsForDocument returns a map of stored assets", async () => {
    const asset: Asset = { id: "a1", sourceUrl: "https://example.com/a.png", alt: "", status: "saved", bytes: 1, attempts: 0, updatedAt: "2026-09-01T00:00:00.000Z" };
    await store.putAsset(asset);
    const map = await store.assetsForDocument(sampleDocument({ assetIds: ["a1", "missing"] }));
    expect([...map.keys()]).toEqual(["a1"]);
  });
});
