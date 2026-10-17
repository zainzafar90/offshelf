import { includedPostCount, primarySection, readerByline } from "../../src/features/reader/reader-document";
import { sampleDocument } from "../helpers/fixtures";

const section = (id: string, over: object = {}) => ({ id, sourceUrl: "https://example.com/post", blocks: [], ...over });

test("primary section is the first included one", () => {
  const doc = sampleDocument({ sections: [section("a", { excluded: true }), section("b"), section("c")] });
  expect(primarySection(doc)?.id).toBe("b");
  expect(includedPostCount(doc)).toBe(2);
});

test("a thread byline shows the handle and no site", () => {
  const doc = sampleDocument({ kind: "thread", sections: [section("a", { author: "Grace", handle: "grace", avatarAssetId: "av" })] });
  expect(readerByline(doc)).toEqual({ author: "Grace", handle: "@grace", site: undefined, avatarAssetId: "av" });
});

test("an article byline shows the site and falls back to the document author", () => {
  const doc = sampleDocument({ kind: "article", author: "Ada", siteName: "Example", sections: [section("a", { handle: "ignored" })] });
  expect(readerByline(doc)).toEqual({ author: "Ada", handle: undefined, site: "Example", avatarAssetId: undefined });
});
