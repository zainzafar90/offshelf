import type { Asset, Block } from "../../src/core/model";
import { missingAssets, missingMedia, originsOf } from "../../src/features/reader/missing-media";
import { makeAsset } from "../helpers/jobs";
import { sampleDocument } from "../helpers/fixtures";

const image = (assetId: string): Block => ({ type: "image", assetId, alt: "" });
const docWith = (ids: string[], excluded: string[] = []) => sampleDocument({
  sections: [
    { id: "s1", sourceUrl: "https://example.com/post", excluded: false, blocks: ids.map(image) },
    { id: "s2", sourceUrl: "https://example.com/post", excluded: true, blocks: excluded.map(image) },
  ],
});
const asset = (url: string, status: Asset["status"]) => makeAsset(url, { status });

test("only visible, unsaved assets are missing", () => {
  const a = asset("https://a.example/1.png", "saved");
  const b = asset("https://b.example/2.png", "failed");
  const c = asset("https://c.example/3.png", "pending");
  const hidden = asset("https://d.example/4.png", "failed");
  const assets = new Map([a, b, c, hidden].map(item => [item.id, item]));
  const doc = docWith([a.id, b.id, c.id, "unknown"], [hidden.id]);
  expect(missingAssets(doc, assets).map(item => item.id)).toEqual([b.id, c.id]);
});

test("origins are unique patterns and skip unsafe urls", () => {
  const list = [
    asset("https://a.example/1.png", "failed"),
    asset("https://a.example/2.png", "failed"),
    asset("https://b.example/3.png", "permission"),
    asset("javascript:alert(1)", "failed"),
  ];
  expect(originsOf(list)).toEqual(["https://a.example/*", "https://b.example/*"]);
});

test("missingMedia reports totals and saved count", () => {
  const saved = asset("https://a.example/1.png", "saved");
  const failed = asset("https://b.example/2.png", "failed");
  const assets = new Map([saved, failed].map(item => [item.id, item]));
  const result = missingMedia(docWith([saved.id, failed.id]), assets);
  expect(result).toMatchObject({ total: 2, saved: 1, origins: ["https://b.example/*"] });
  expect(result.missing).toEqual([failed]);
});
