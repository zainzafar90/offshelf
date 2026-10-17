import type { Block } from "../../src/core/model";
import { coverAssetId, isLongText, splitBlocks, unsavedImagesLabel } from "../../src/features/library/card-content";
import { sampleDocument } from "../helpers/fixtures";

const image = (assetId: string): Block => ({ type: "image", assetId, alt: "" });
const paragraph: Block = { type: "paragraph", content: [{ text: "hi" }] };
const section = (id: string, blocks: Block[], excluded = false) => ({ id, sourceUrl: "https://example.com/post", excluded, blocks });

test("cover is the first image of the first included section", () => {
  const doc = sampleDocument({ sections: [section("a", [paragraph]), section("b", [image("one"), image("two")])] });
  expect(coverAssetId(doc)).toBe("one");
});
test("cover skips excluded sections and is undefined without images", () => {
  const skipped = sampleDocument({ sections: [section("a", [image("hidden")], true), section("b", [image("shown")])] });
  expect(coverAssetId(skipped)).toBe("shown");
  expect(coverAssetId(sampleDocument({ sections: [section("a", [paragraph])] }))).toBeUndefined();
});

test("splitBlocks separates text from images, quotes and embeds", () => {
  const quote: Block = { type: "quote", blocks: [paragraph] };
  const embed: Block = { type: "embed", url: "https://example.com/v", label: "Video" };
  const { text, media } = splitBlocks([paragraph, image("a"), quote, embed]);
  expect(text).toEqual([paragraph]);
  expect(media).toEqual([image("a"), quote, embed]);
});

test("text longer than 220 characters is long", () => {
  expect(isLongText(220)).toBe(false);
  expect(isLongText(221)).toBe(true);
});

test("unsaved image label is singular, plural, or absent", () => {
  expect(unsavedImagesLabel(3, 3)).toBeUndefined();
  expect(unsavedImagesLabel(0, 0)).toBeUndefined();
  expect(unsavedImagesLabel(3, 2)).toBe("1 image not saved");
  expect(unsavedImagesLabel(5, 2)).toBe("3 images not saved");
});
