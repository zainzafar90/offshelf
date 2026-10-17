import { mediaCounts } from "../../src/features/library/media-counts";
import { sampleDocument } from "../helpers/fixtures";
import type { Asset } from "../../src/core/model";

test("counts saved vs total visible assets", () => {
  const doc = sampleDocument({
    assetIds: ["a", "b"],
    sections: [{
      id: "s", sourceUrl: "https://example.com/post",
      blocks: [{ type: "image", assetId: "a", alt: "" }, { type: "image", assetId: "b", alt: "" }],
    }],
  });
  const assets = new Map<string, Asset>([
    ["a", { id: "a", sourceUrl: "https://e.com/a.png", alt: "", status: "saved", bytes: 1, attempts: 0, updatedAt: "" }],
    ["b", { id: "b", sourceUrl: "https://e.com/b.png", alt: "", status: "failed", bytes: 0, attempts: 1, updatedAt: "" }],
  ]);
  expect(mediaCounts(doc, assets)).toEqual({ total: 2, saved: 1 });
});

test("excluded sections are not counted", () => {
  const doc = sampleDocument({
    assetIds: ["a"],
    sections: [{ id: "s", sourceUrl: "https://example.com/post", excluded: true, blocks: [{ type: "image", assetId: "a", alt: "" }] }],
  });
  expect(mediaCounts(doc, new Map())).toEqual({ total: 0, saved: 0 });
});
