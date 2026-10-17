import { toMarkdown, markdownInline } from "../../src/exports/markdown";
import { toHtml } from "../../src/exports/html";
import { crc32, createZip } from "../../src/exports/zip";
import { sampleDocument } from "../helpers/fixtures";

describe("exports", () => {
  test("markdown escapes markdown syntax", () => {
    expect(markdownInline([{ text: "a*b", bold: true }])).toBe("**a\\*b**");
  });
  test("markdown keeps safe links and credits Offshelf", () => {
    const md = toMarkdown(sampleDocument(), new Map());
    expect(md).toContain("[**world**](<https://example.com/w>)");
    expect(md).toContain("Saved with Offshelf");
  });
  test("markdown never emits javascript: links", () => {
    expect(toMarkdown(sampleDocument(), new Map())).not.toContain("javascript:");
  });
  test("html escapes the title and never emits javascript: links", () => {
    const html = toHtml(sampleDocument({ title: "<script>x</script>" }), new Map());
    expect(html).not.toContain("<script>x</script>");
    expect(html).not.toContain("javascript:");
  });
  test("crc32 matches the known value", () => {
    expect(crc32(new TextEncoder().encode("hello"))).toBe(0x3610a686);
  });
  test("createZip rejects path traversal", () => {
    expect(() => createZip([{ name: "../x", bytes: new Uint8Array() }])).toThrow("Unsafe archive filename");
  });
});

describe("quoted post exports", () => {
  const doc = () => {
    const d = sampleDocument();
    d.sections[0].blocks = [{ type: "quote", cite: { author: "Other <b>", handle: "other" }, blocks: [{ type: "paragraph", content: [{ text: "Quoted words" }] }] }];
    return d;
  };
  test("markdown names the quoted author", () => {
    expect(toMarkdown(doc(), new Map())).toContain("> **Other &lt;b\\>** @other");
  });
  test("html names the quoted author, escaped", () => {
    const html = toHtml(doc(), new Map());
    expect(html).toContain("Other &lt;b&gt;");
    expect(html).toContain("@other");
  });
});
