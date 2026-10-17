import { kindCounts, libraryTags, storageBytes, viewCounts } from "../../src/features/library/library-counts";
import { sampleDocument } from "../helpers/fixtures";
import type { Asset } from "../../src/core/model";

const docs = [
  sampleDocument({ id: "a", tags: ["Zeta", "Design"] }),
  sampleDocument({ id: "t", kind: "thread", starred: true, read: true, tags: ["Design"] }),
  sampleDocument({ id: "x", archived: true, tags: ["Hidden"] }),
];

test("view counts", () => {
  expect(viewCounts(docs)).toEqual({ all: 2, unread: 1, starred: 1, archive: 1 });
});
test("kind counts skip archived", () => {
  expect(kindCounts(docs)).toEqual({ post: 1, article: 1 });
});
test("tags are unique, sorted, non-archived, max 10", () => {
  expect(libraryTags(docs)).toEqual(["Design", "Zeta"]);
  const many = Array.from({ length: 12 }, (_, i) => sampleDocument({ id: `m${i}`, tags: [`T${String(i).padStart(2, "0")}`] }));
  expect(libraryTags(many)).toHaveLength(10);
});
test("storage bytes sums assets", () => {
  const assets = new Map<string, Asset>([["1", { id: "1", sourceUrl: "https://e.com/1.png", alt: "", status: "saved", bytes: 100, attempts: 0, updatedAt: "" }], ["2", { id: "2", sourceUrl: "https://e.com/2.png", alt: "", status: "failed", bytes: 0, attempts: 1, updatedAt: "" }]]);
  expect(storageBytes(assets)).toBe(100);
});
