import { normalizeElement } from "../../src/capture/normalize";
import { shouldOmit } from "../../src/capture/omit-rules";
import { isXHost, getPostIdentity } from "../../src/capture/x-identity";
import { createArticleSnapshot } from "../../src/capture/article";
import { LIMITS } from "../../src/core/model";

describe("capture", () => {
  test("isXHost matches X and Twitter only", () => {
    expect(isXHost("x.com")).toBe(true);
    expect(isXHost("www.twitter.com")).toBe(true);
    expect(isXHost("example.com")).toBe(false);
  });
  test("getPostIdentity reads handle and id from a status URL", () => {
    expect(getPostIdentity("https://x.com/ada/status/123")).toMatchObject({ id: "123" });
  });
  test("normalizeElement turns headings, paragraphs and links into blocks", () => {
    const root = document.createElement("article");
    root.innerHTML = `<h2>Title</h2><p>Hello <a href="https://example.com">there</a></p><p><a href="javascript:x">bad</a></p>`;
    const { blocks } = normalizeElement(root, "https://example.com/");
    expect(blocks.map((b: { type: string }) => b.type)).toEqual(["heading", "paragraph", "paragraph"]);
    expect(JSON.stringify(blocks)).not.toContain("javascript:");
  });
  test("shouldOmit skips scripts", () => {
    expect(shouldOmit(document.createElement("script"))).toBe(true);
  });
  test("createArticleSnapshot builds a snapshot for the page URL", () => {
    document.body.innerHTML = `<main><article><h1>Post</h1><p>${"word ".repeat(80)}</p></article></main>`;
    const snap = createArticleSnapshot(document, "https://example.com/post");
    expect(snap.document.sourceUrl).toBe("https://example.com/post");
    expect(snap.document.sections.length).toBeGreaterThan(0);
  });
  test("video posters stay within the asset limit", () => {
    const root = document.createElement("article");
    root.innerHTML = Array.from({ length: LIMITS.maxAssets + 20 }, (_, i) => `<video poster="https://example.com/p${i}.jpg"></video>`).join("");
    const { assets } = normalizeElement(root, "https://example.com/");
    expect(assets.length).toBeLessThanOrEqual(LIMITS.maxAssets);
  });
});
