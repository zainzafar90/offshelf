import { previewBlocks } from "../../src/features/library/preview-blocks";
import { sampleDocument } from "../helpers/fixtures";
import type { Block } from "../../src/core/model";

test("articles preview 3 blocks and pull in the first image if none shown", () => {
  const p = (t: string): Block => ({ type: "paragraph", content: [{ text: t }] });
  const doc = sampleDocument({ assetIds: ["img"], sections: [{ id: "s", sourceUrl: "https://example.com/post", blocks: [p("1"), p("2"), p("3"), p("4"), { type: "image", assetId: "img", alt: "" }] }] });
  const blocks = previewBlocks(doc);
  expect(blocks).toHaveLength(4);
  expect(blocks[3].type).toBe("image");
});
test("threads preview up to 8 blocks", () => {
  const blocks = Array.from({ length: 10 }, (_, i): Block => ({ type: "paragraph", content: [{ text: String(i) }] }));
  const doc = sampleDocument({ kind: "thread", sections: [{ id: "s", sourceUrl: "https://example.com/post", blocks }] });
  expect(previewBlocks(doc)).toHaveLength(8);
});
