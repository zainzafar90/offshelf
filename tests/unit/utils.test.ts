import type { Block, Section } from "../../src/core/model";
import * as assetRefs from "../../src/core/asset-refs";
import * as documentText from "../../src/core/document-text";
import * as errors from "../../src/core/errors";
import * as format from "../../src/core/format";
import * as identity from "../../src/core/identity";
import * as jobStatus from "../../src/core/job-status";
import * as numberRange from "../../src/core/number-range";
import * as time from "../../src/core/time";
import * as url from "../../src/core/url";
import * as fileName from "../../src/exports/file-name";
import * as htmlEscape from "../../src/exports/html-escape";
import { sampleDocument } from "../helpers/fixtures";

const utils = { ...assetRefs, ...documentText, ...errors, ...format, ...identity, ...jobStatus, ...numberRange, ...time, ...url, ...fileName, ...htmlEscape };

describe("utils", () => {
  test("safeUrl keeps http(s) and drops script URLs", () => {
    expect(utils.safeUrl("https://example.com/a")).toBe("https://example.com/a");
    expect(utils.safeUrl("javascript:alert(1)")).toBeUndefined();
  });
  test("stableId is deterministic", () => {
    expect(utils.stableId("https://example.com/a")).toBe(utils.stableId("https://example.com/a"));
    expect(utils.stableId("https://example.com/a")).not.toBe(utils.stableId("https://example.com/b"));
  });
  test("escapeHtml escapes markup", () => {
    expect(utils.escapeHtml(`<a href="x">&</a>`)).not.toMatch(/[<>"]/);
  });
  test("isActiveJob", () => {
    expect(utils.isActiveJob("capturing")).toBe(true);
    expect(utils.isActiveJob("downloading")).toBe(true);
    expect(utils.isActiveJob("done")).toBe(false);
  });
  test("formatBytes is human readable", () => {
    expect(utils.formatBytes(2048)).toMatch(/KB/);
  });
});

describe("utils: time and numbers", () => {
  test("now returns an ISO timestamp", () => {
    expect(utils.now()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
  test("errorMessage reads Error messages and stringifies everything else", () => {
    expect(utils.errorMessage(new Error("boom"))).toBe("boom");
    expect(utils.errorMessage("plain")).toBe("plain");
    expect(utils.errorMessage(404)).toBe("404");
    expect(utils.errorMessage({ a: 1 })).toBe("[object Object]");
    expect(utils.errorMessage(undefined)).toBe("undefined");
  });
  test("sleep resolves after the delay", async () => {
    vi.useFakeTimers();
    let done = false;
    const pending = utils.sleep(500).then(() => { done = true; });
    await vi.advanceTimersByTimeAsync(499);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(done).toBe(true);
    vi.useRealTimers();
  });
  test("clamp bounds a number on both sides", () => {
    expect([utils.clamp(5, 1, 10), utils.clamp(-3, 1, 10), utils.clamp(99, 1, 10)]).toEqual([5, 1, 10]);
  });
  test("formatBytes switches units at 1 KB and 1 MB", () => {
    expect([0, 1023, 1024, 1536, 1024 * 1024 - 1, 1024 * 1024, 5.5 * 1024 * 1024].map(utils.formatBytes))
      .toEqual(["0 B", "1023 B", "1 KB", "2 KB", "1024 KB", "1.0 MB", "5.5 MB"]);
  });
  test("dateLabel formats a date and returns Invalid Date for garbage", () => {
    const label = utils.dateLabel("2026-09-15T12:00:00.000Z");
    expect(label).toMatch(/2026/);
    expect(label).toMatch(/Sep/);
    /* current behavior: no fallback for bad input */
    expect(utils.dateLabel("not a date")).toBe("Invalid Date");
  });
});

describe("utils: urls", () => {
  test("safeUrl resolves relatives, strips nothing else, and rejects credentials and other schemes", () => {
    expect(utils.safeUrl("/a?b=1", "https://example.com/x")).toBe("https://example.com/a?b=1");
    expect(utils.safeUrl("//cdn.example.com/a.png", "https://example.com/")).toBe("https://cdn.example.com/a.png");
    for (const bad of ["https://user:pw@example.com/", "data:text/html,hi", "file:///etc/passwd", "ftp://example.com/", "", null, undefined, "http://", "not a url"])
      expect(utils.safeUrl(bad as string)).toBeUndefined();
  });
  test("imageUrl accepts raster data URIs and http(s) URLs only", () => {
    const png = "data:image/png;base64,AAAA";
    expect(utils.imageUrl(png)).toBe(png);
    expect(utils.imageUrl("data:image/jpeg;base64,AA AA")).toBe("data:image/jpeg;base64,AA AA");
    expect(utils.imageUrl("data:image/svg+xml;base64,AAAA")).toBeUndefined();
    expect(utils.imageUrl("data:text/html;base64,AAAA")).toBeUndefined();
    expect(utils.imageUrl("data:image/png;utf8,AAAA")).toBeUndefined();
    expect(utils.imageUrl("/a.png", "https://example.com/post")).toBe("https://example.com/a.png");
    expect(utils.imageUrl("javascript:alert(1)")).toBeUndefined();
    expect(utils.imageUrl(undefined)).toBeUndefined();
  });
  test("canonicalUrl drops the hash and tracking params but keeps real params", () => {
    expect(utils.canonicalUrl("https://example.com/a?utm_source=x&UTM_medium=y&fbclid=1&gclid=2&mc_cid=3&mc_eid=4&keep=1#top"))
      .toBe("https://example.com/a?keep=1");
    expect(utils.canonicalUrl("https://example.com/a?utm_source=x")).toBe("https://example.com/a");
    expect(utils.canonicalUrl("https://example.com/a?fbclidx=1&gclid2=2")).toBe("https://example.com/a?fbclidx=1&gclid2=2");
  });
  test("canonicalUrl folds twitter.com and www hosts to x.com and trims post URLs", () => {
    expect(utils.canonicalUrl("https://twitter.com/ada/status/123?s=20&t=abc#x")).toBe("https://x.com/ada/status/123");
    expect(utils.canonicalUrl("https://www.x.com/ada/status/123/photo/1?s=1")).toBe("https://x.com/ada/status/123");
    expect(utils.canonicalUrl("https://x.com/ada?lang=en")).toBe("https://x.com/ada");
    expect(utils.canonicalUrl("https://mobile.twitter.com/ada/status/1")).toBe("https://mobile.twitter.com/ada/status/1");
  });
  test("canonicalUrl throws on an invalid URL", () => {
    expect(() => utils.canonicalUrl("nope")).toThrow();
  });
  test("hostname strips www and falls back to 'Saved locally' for invalid input", () => {
    expect(utils.hostname("https://www.example.com/a")).toBe("example.com");
    expect(utils.hostname("https://sub.example.com:8080/a")).toBe("sub.example.com");
    expect(utils.hostname("not a url")).toBe("Saved locally");
    expect(utils.hostname("")).toBe("Saved locally");
  });
  test("originPattern builds a host-wide match pattern for http(s) only", () => {
    expect(utils.originPattern("https://img.example.com:8443/a/b.png?x=1")).toBe("https://img.example.com/*");
    expect(utils.originPattern("http://example.com/a")).toBe("http://example.com/*");
    expect(utils.originPattern("data:image/png;base64,AAAA")).toBeUndefined();
    expect(utils.originPattern("chrome://settings")).toBeUndefined();
    expect(utils.originPattern("garbage")).toBeUndefined();
  });
});

describe("utils: ids and file names", () => {
  test("stableId is a 16-char FNV-1a 64 hex digest", () => {
    expect(utils.stableId("")).toBe("cbf29ce484222325");
    expect(utils.stableId("a")).toBe("af63dc4c8601ec8c");
    expect(utils.stableId("https://example.com/a")).toMatch(/^[0-9a-f]{16}$/);
    expect(utils.stableId("é")).not.toBe(utils.stableId("e"));
  });
  test("fileName strips unsafe characters, trims dots and spaces, and caps at 90 chars", () => {
    expect(utils.fileName('a<b>c:d"e/f\\g|h?i*j')).toBe("abcdefghij");
    expect(utils.fileName("  My post...  ")).toBe("My post");
    expect(utils.fileName("tab\there\u0000x")).toBe("tabherex");
    expect(utils.fileName("ａｂｃ")).toBe("abc");
    expect(utils.fileName("x".repeat(200))).toHaveLength(90);
  });
  test("fileName falls back to saved-document when nothing is left", () => {
    expect(utils.fileName("")).toBe("saved-document");
    expect(utils.fileName('///???')).toBe("saved-document");
    expect(utils.fileName(" . . ")).toBe("saved-document");
  });
});

describe("utils: escaping", () => {
  test("escapeHtml escapes all five special characters exactly", () => {
    expect(utils.escapeHtml(`<a href="x" title='y'>&amp;</a>`)).toBe("&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;amp;&lt;/a&gt;");
    expect(utils.escapeHtml("plain")).toBe("plain");
  });
});

describe("utils: text and blocks", () => {
  const p = (...text: string[]): Block => ({ type: "paragraph", content: text.map(t => ({ text: t })) });
  const image = (assetId: string, extra: Partial<Extract<Block, { type: "image" }>> = {}): Block => ({ type: "image", assetId, alt: "alt", ...extra });

  test("inlineText joins inline parts", () => {
    expect(utils.inlineText([{ text: "a" }, { text: "b", bold: true }])).toBe("ab");
  });
  test("blocksText flattens every block type", () => {
    const blocks: Block[] = [
      { type: "heading", level: 2, anchor: "h", content: [{ text: "Head" }] },
      p("Para ", "graph"),
      { type: "code", text: "x = 1" },
      { type: "quote", blocks: [p("quoted")] },
      { type: "list", ordered: false, start: 1, items: [[p("one")], [p("two")]] },
      { type: "table", header: true, rows: [[[{ text: "a" }], [{ text: "b" }]], [[{ text: "c" }], [{ text: "d" }]]] },
      image("i1", { caption: "A caption" }),
      image("i2"),
      { type: "embed", url: "https://example.com/v", label: "Video" },
      { type: "rule" },
    ];
    expect(utils.blocksText(blocks)).toBe(["Head", "Para graph", "x = 1", "quoted", "one\ntwo", "a\tb\nc\td", "A caption", "alt", "Video", ""].join("\n\n"));
  });
  test("documentText skips excluded sections", () => {
    const doc = sampleDocument({ sections: [
      { id: "a", sourceUrl: "https://example.com/", blocks: [p("keep")] },
      { id: "b", sourceUrl: "https://example.com/", excluded: true, blocks: [p("drop")] },
      { id: "c", sourceUrl: "https://example.com/", blocks: [p("also")] },
    ] });
    expect(utils.documentText(doc)).toBe("keep\n\nalso");
  });
  test("measureDocument counts words, reading minutes and builds an excerpt", () => {
    const words = Array.from({ length: 441 }, (_, i) => `w${i}`).join(" ");
    const measured = utils.measureDocument(sampleDocument({ sections: [{ id: "a", sourceUrl: "https://example.com/", blocks: [p(words)] }] }));
    expect(measured.wordCount).toBe(441);
    expect(measured.readingMinutes).toBe(3);
    expect(measured.excerpt).toHaveLength(230);
    expect(measured.excerpt.startsWith("w0 w1 w2")).toBe(true);
  });
  test("measureDocument treats apostrophes and hyphens as part of one word and collapses whitespace in the excerpt", () => {
    const measured = utils.measureDocument(sampleDocument({ sections: [{ id: "a", sourceUrl: "https://example.com/", blocks: [p("Don't  re-use\n\nit ’tis 42")] }] }));
    expect(measured.wordCount).toBe(5);
    expect(measured.excerpt).toBe("Don't re-use it ’tis 42");
  });
  test("measureDocument reports at least one reading minute for an empty document", () => {
    const measured = utils.measureDocument(sampleDocument({ sections: [] }));
    expect(measured).toMatchObject({ wordCount: 0, readingMinutes: 1, excerpt: "" });
  });
  test("collectAssetIds finds images and posters through quotes and lists, deduplicated", () => {
    const blocks: Block[] = [
      image("a"),
      { type: "embed", url: "https://example.com/v", label: "v", posterAssetId: "poster" },
      { type: "embed", url: "https://example.com/w", label: "w" },
      { type: "quote", blocks: [image("b"), { type: "list", ordered: true, start: 1, items: [[image("c")], [image("a")]] }] },
    ];
    expect(utils.collectAssetIds(blocks)).toEqual(["a", "poster", "b", "c"]);
    expect(utils.collectAssetIds([])).toEqual([]);
  });
  test("sectionAssetIds adds section and quote avatars on top of block assets", () => {
    const section: Section = {
      id: "s", sourceUrl: "https://example.com/", avatarAssetId: "avatar",
      blocks: [image("a"), { type: "quote", cite: { author: "Q", avatarAssetId: "quote-avatar" }, blocks: [image("b")] },
        { type: "list", ordered: false, start: 1, items: [[{ type: "quote", cite: { author: "L", avatarAssetId: "list-avatar" }, blocks: [] }]] }],
    };
    expect(utils.sectionAssetIds(section).sort()).toEqual(["a", "avatar", "b", "list-avatar", "quote-avatar"]);
  });
  test("isActiveJob is true only for capturing and downloading", () => {
    const statuses = ["capturing", "downloading", "done", "failed", "cancelled", "interrupted"] as const;
    expect(statuses.filter(utils.isActiveJob)).toEqual(["capturing", "downloading"]);
  });
});
