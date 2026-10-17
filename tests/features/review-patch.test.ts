import type { Block } from "../../src/core/model";
import { buildReviewPatch, includedIds } from "../../src/features/reader/review-patch";
import { sampleDocument } from "../helpers/fixtures";

const para = (text: string): Block => ({ type: "paragraph", content: [{ text }] });
const doc = sampleDocument({
  kind: "thread",
  sections: [
    { id: "a", sourceUrl: "https://example.com/post", excluded: false, blocks: [para("alpha beta")] },
    { id: "b", sourceUrl: "https://example.com/post", excluded: true, blocks: [para("gamma delta epsilon")] },
  ],
});

test("includedIds lists sections that are not excluded", () => {
  expect(includedIds(doc)).toEqual(new Set(["a"]));
});

test("the patch flips exclusion and re-measures the document", () => {
  const patch = buildReviewPatch(doc, new Set(["b"]));
  expect(patch.sections.map(section => section.excluded)).toEqual([true, false]);
  expect(patch.wordCount).toBe(3);
  expect(patch.excerpt).toBe("gamma delta epsilon");
  expect(patch.readingMinutes).toBe(1);
  expect(Object.keys(patch).sort()).toEqual(["excerpt", "readingMinutes", "sections", "wordCount"]);
});
