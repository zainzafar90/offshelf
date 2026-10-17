import { bestImageUrl } from "../../src/capture/image-source";
import { inlineNodes } from "../../src/capture/inline-content";
import { normalizeElement } from "../../src/capture/normalize";
import { shouldOmit } from "../../src/capture/omit-rules";
import { LIMITS } from "../../src/core/model";
import type { Block } from "../../src/core/model";
import { stableId } from "../../src/core/identity";

const BASE = "https://example.com/post/";
function root(html: string): HTMLElement {
  const el = document.createElement("article");
  el.innerHTML = html;
  return el;
}
const normalize = (html: string) => normalizeElement(root(html), BASE);
const blocksOf = (html: string) => normalize(html).blocks;
const text = (...parts: string[]) => parts.map(t => ({ text: t }));
const nest = (open: string, close: string, depth: number, inner: string) => open.repeat(depth) + inner + close.repeat(depth);

describe("shouldOmit", () => {
  test.each(["script", "style", "noscript", "template", "iframe", "object", "embed", "form", "input", "button", "select", "textarea", "nav", "footer", "aside", "canvas"])("omits <%s>", tag => {
    expect(shouldOmit(document.createElement(tag))).toBe(true);
  });
  test("omits inline svg even though SVG tag names are lowercase", () => {
    expect(shouldOmit(document.createElementNS("http://www.w3.org/2000/svg", "svg"))).toBe(true);
  });
  test("omits hidden, aria-hidden and layout-role elements", () => {
    const attr = (name: string, value: string) => { const el = document.createElement("div"); el.setAttribute(name, value); return el; };
    expect(shouldOmit(attr("hidden", ""))).toBe(true);
    expect(shouldOmit(attr("aria-hidden", "true"))).toBe(true);
    expect(shouldOmit(attr("aria-hidden", "false"))).toBe(false);
    for (const role of ["navigation", "complementary", "dialog", "menu"]) expect(shouldOmit(attr("role", role))).toBe(true);
    expect(shouldOmit(attr("role", "article"))).toBe(false);
  });
  test("omits noisy class names but not look-alikes", () => {
    const withClass = (name: string) => { const el = document.createElement("div"); el.className = name; return el; };
    for (const name of ["advertisement", "post advert", "social-share", "share-tools", "cookie-banner", "newsletter-signup", "related-posts", "sr-only", "visually-hidden", "x_advertisement_y"])
      expect(shouldOmit(withClass(name))).toBe(true);
    for (const name of ["advertising", "shared", "content"]) expect(shouldOmit(withClass(name))).toBe(false);
  });
  test("omits inline display:none and visibility:hidden styles", () => {
    const styled = (css: string) => { const el = document.createElement("p"); el.setAttribute("style", css); return el; };
    expect(shouldOmit(styled("display: none"))).toBe(true);
    expect(shouldOmit(styled("color:red; visibility :hidden"))).toBe(true);
    expect(shouldOmit(styled("display:block"))).toBe(false);
  });
  test("keeps ordinary content", () => {
    expect(shouldOmit(document.createElement("p"))).toBe(false);
    expect(shouldOmit(document.createElement("article"))).toBe(false);
  });
});

describe("paragraphs and inline marks", () => {
  test("turns paragraphs into blocks and collapses whitespace", () => {
    expect(blocksOf("<p>Hello\n   big\tworld</p><p>Second</p>")).toEqual([
      { type: "paragraph", content: text("Hello big world") }, { type: "paragraph", content: text("Second") },
    ]);
  });
  test("maps formatting tags to marks and merges equal neighbours", () => {
    const [block] = blocksOf("<p>a <b>b</b><strong>c</strong> <i>d</i><em>e</em> <code>f</code><kbd>g</kbd> <s>h</s><del>i</del></p>");
    expect(block).toEqual({ type: "paragraph", content: [
      { text: "a " }, { text: "bc", bold: true }, { text: " " }, { text: "de", italic: true }, { text: " " },
      { text: "fg", code: true }, { text: " " }, { text: "hi", strike: true },
    ] });
  });
  test("nests marks", () => {
    const [block] = blocksOf("<p><b>bold <i>both</i></b></p>");
    expect(block).toEqual({ type: "paragraph", content: [{ text: "bold ", bold: true }, { text: "both", bold: true, italic: true }] });
  });
  test("resolves relative links and drops unsafe ones", () => {
    const [block] = blocksOf(`<p><a href="../x">rel</a> <a href="javascript:alert(1)">bad</a> <a href="https://u:p@evil.test/">cred</a> <a>none</a></p>`);
    expect(block).toEqual({ type: "paragraph", content: [{ text: "rel", href: "https://example.com/x" }, { text: " bad cred none" }] });
  });
  test("<br> becomes a newline", () => {
    expect(blocksOf("<p>one<br>two</p>")).toEqual([{ type: "paragraph", content: text("one\ntwo") }]);
  });
  test("whitespace-only paragraphs are dropped", () => {
    expect(blocksOf("<p>   </p><p></p><div>\n</div>")).toEqual([]);
  });
  test("bare text and inline tags between blocks become their own paragraph", () => {
    expect(blocksOf("intro <b>bold</b> text<h2>Head</h2>tail")).toEqual([
      { type: "paragraph", content: [{ text: "intro " }, { text: "bold", bold: true }, { text: " text" }] },
      { type: "heading", level: 2, content: text("Head"), anchor: "heading-1" },
      { type: "paragraph", content: text("tail") },
    ]);
  });
  test("an inline tag wrapping a block element is treated as a container", () => {
    expect(blocksOf("<span><p>inside</p></span>")).toEqual([{ type: "paragraph", content: text("inside") }]);
  });
  test("emoji images keep their alt text in headings and table cells", () => {
    expect(blocksOf(`<h2>Hi <img class="twemoji" alt="😀"></h2>`)[0]).toMatchObject({ content: text("Hi 😀") });
    const table = blocksOf(`<table><tr><td>ok <img src="https://x.test/emoji/1.png" alt="👍"></td></tr></table>`)[0] as Extract<Block, { type: "table" }>;
    expect(table.rows[0]?.[0]).toEqual(text("ok 👍"));
  });
  test("emoji images inside a paragraph are dropped, not inlined", () => {
    /* current behavior: <img> in a <p> is handled as a block, where emoji are skipped */
    expect(blocksOf(`<p>hi <img class="twemoji" alt="😀"></p>`)).toEqual([{ type: "paragraph", content: text("hi ") }]);
  });
  test("omitted elements inside a paragraph disappear", () => {
    expect(blocksOf(`<p>keep<script>x()</script><span hidden>no</span><button>click</button></p>`)).toEqual([{ type: "paragraph", content: text("keep") }]);
  });
  test("inlineNodes works on any node list", () => {
    const el = root("<b>x</b>y");
    expect(inlineNodes(el.childNodes, BASE)).toEqual([{ text: "x", bold: true }, { text: "y" }]);
    expect(inlineNodes(el.childNodes, BASE, { italic: true })).toEqual([{ text: "x", italic: true, bold: true }, { text: "y", italic: true }]);
  });
  test("inline nesting is cut off beyond 40 levels", () => {
    expect(blocksOf(nest("<span>", "</span>", 40, "deep"))).toEqual([{ type: "paragraph", content: text("deep") }]);
    expect(blocksOf(nest("<span>", "</span>", 41, "deep"))).toEqual([]);
  });
});

describe("headings and rules", () => {
  test("keeps heading levels with positional anchors", () => {
    expect(blocksOf("<h1>One</h1><p>x</p><h3>Three</h3><h6>Six</h6>")).toEqual([
      { type: "heading", level: 1, content: text("One"), anchor: "heading-0" },
      { type: "paragraph", content: text("x") },
      { type: "heading", level: 3, content: text("Three"), anchor: "heading-2" },
      { type: "heading", level: 6, content: text("Six"), anchor: "heading-3" },
    ]);
  });
  test("keeps inline formatting inside headings and drops empty ones", () => {
    expect(blocksOf("<h2>A <em>b</em></h2><h2> </h2>")).toEqual([
      { type: "heading", level: 2, content: [{ text: "A " }, { text: "b", italic: true }], anchor: "heading-0" },
    ]);
  });
  test("<hr> becomes a rule", () => {
    expect(blocksOf("<p>a</p><hr><p>b</p>").map(b => b.type)).toEqual(["paragraph", "rule", "paragraph"]);
  });
});

describe("lists", () => {
  test("unordered list", () => {
    expect(blocksOf("<ul><li>one</li><li>two <b>b</b></li></ul>")).toEqual([{
      type: "list", ordered: false, start: 1,
      items: [[{ type: "paragraph", content: text("one") }], [{ type: "paragraph", content: [{ text: "two " }, { text: "b", bold: true }] }]],
    }]);
  });
  test("ordered list honours start and clamps invalid values to 1", () => {
    const start = (attr: string) => (blocksOf(`<ol${attr}><li>a</li></ol>`)[0] as Extract<Block, { type: "list" }>).start;
    expect(start("")).toBe(1);
    expect(start(' start="5"')).toBe(5);
    expect(start(' start="0"')).toBe(1);
    expect(start(' start="-3"')).toBe(1);
    expect(start(' start="abc"')).toBe(1);
    expect(blocksOf("<ol><li>a</li></ol>")[0]).toMatchObject({ ordered: true });
  });
  test("nested lists live inside the item blocks", () => {
    const [list] = blocksOf("<ul><li>parent<ul><li>child</li></ul></li></ul>") as Extract<Block, { type: "list" }>[];
    expect(list.items[0]?.map(b => b.type)).toEqual(["paragraph", "list"]);
  });
  test("ignores non-li children and empty items, and drops a list with no items", () => {
    expect(blocksOf("<ul><div>stray</div><li></li><li>kept</li></ul>")).toEqual([
      { type: "list", ordered: false, start: 1, items: [[{ type: "paragraph", content: text("kept") }]] },
    ]);
    expect(blocksOf("<ul><li></li></ul><ol></ol>")).toEqual([]);
  });
});

describe("code, quotes and tables", () => {
  test("pre keeps whitespace, trims one leading and trailing newline, and reads the language", () => {
    expect(blocksOf(`<pre><code class="hljs language-ts">\nconst a  = 1;\n  b();\n</code></pre>`)).toEqual([
      { type: "code", text: "const a  = 1;\n  b();", language: "ts" },
    ]);
  });
  test("pre without a language class or with only whitespace", () => {
    expect(blocksOf("<pre>plain\n\n</pre>")).toEqual([{ type: "code", text: "plain\n", language: undefined }]);
    expect(blocksOf("<pre>  \n </pre>")).toEqual([]);
  });
  test("blockquote wraps child blocks", () => {
    expect(blocksOf("<blockquote><p>quoted</p><blockquote><p>inner</p></blockquote></blockquote>")).toEqual([{
      type: "quote", blocks: [{ type: "paragraph", content: text("quoted") }, { type: "quote", blocks: [{ type: "paragraph", content: text("inner") }] }],
    }]);
  });
  test("table with a header row", () => {
    expect(blocksOf("<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td><b>2</b></td></tr></tbody></table>")).toEqual([{
      type: "table", header: true,
      rows: [[text("A"), text("B")], [text("1"), [{ text: "2", bold: true }]]],
    }]);
  });
  test("table without th has no header, and nested tables do not leak rows", () => {
    const [table] = blocksOf("<table><tr><td>outer<table><tr><td>inner</td></tr></table></td></tr></table>") as Extract<Block, { type: "table" }>[];
    expect(table.header).toBe(false);
    expect(table.rows).toHaveLength(1);
  });
  test("table with no rows is dropped; rows are capped at 400", () => {
    expect(blocksOf("<table></table>")).toEqual([]);
    const rows = Array.from({ length: 450 }, (_, i) => `<tr><td>${i}</td></tr>`).join("");
    expect((blocksOf(`<table>${rows}</table>`)[0] as Extract<Block, { type: "table" }>).rows).toHaveLength(400);
  });
});

describe("images", () => {
  test("creates an image block and registers the asset", () => {
    const { blocks, assets } = normalize(`<img src="/pics/a.png" alt=" A cat ">`);
    const url = "https://example.com/pics/a.png";
    expect(blocks).toEqual([{ type: "image", assetId: stableId(url), alt: "A cat", caption: undefined }]);
    expect(assets).toEqual([{ id: stableId(url), sourceUrl: url, alt: "A cat" }]);
  });
  test("picks the largest srcset candidate", () => {
    const { assets } = normalize(`<img src="small.png" srcset="small.png 480w, big.png 1200w, mid.png 800w">`);
    expect(assets[0]?.sourceUrl).toBe("https://example.com/post/big.png");
  });
  test("srcset density descriptors and a missing descriptor", () => {
    expect(normalize(`<img srcset="a.png 1x, b.png 2x">`).assets[0]?.sourceUrl).toBe("https://example.com/post/b.png");
    expect(normalize(`<img src="x.png" srcset="only.png">`).assets[0]?.sourceUrl).toBe("https://example.com/post/only.png");
  });
  test("data-srcset and lazy attributes are used", () => {
    expect(normalize(`<img src="placeholder.gif" data-srcset="a.png 100w, b.png 900w">`).assets[0]?.sourceUrl).toBe("https://example.com/post/b.png");
    expect(normalize(`<img src="placeholder.gif" data-src="real.png">`).assets[0]?.sourceUrl).toBe("https://example.com/post/real.png");
    expect(normalize(`<img src="placeholder.gif" data-original="orig.png">`).assets[0]?.sourceUrl).toBe("https://example.com/post/orig.png");
    expect(normalize(`<img src="placeholder.gif" data-lazy-src="lazy.png">`).assets[0]?.sourceUrl).toBe("https://example.com/post/lazy.png");
  });
  test("srcset containing data URIs is ignored in favour of src", () => {
    expect(normalize(`<img src="real.png" srcset="data:image/png;base64,AAAA 1x, data:image/png;base64,BBBB 2x">`).assets[0]?.sourceUrl).toBe("https://example.com/post/real.png");
  });
  test("keeps raster data URIs and rejects svg data URIs and javascript URLs", () => {
    expect(normalize(`<img src="data:image/png;base64,AAAA">`).assets[0]?.sourceUrl).toBe("data:image/png;base64,AAAA");
    expect(blocksOf(`<img src="data:image/svg+xml;base64,AAAA">`)).toEqual([]);
    expect(blocksOf(`<img src="javascript:alert(1)">`)).toEqual([]);
    expect(blocksOf(`<img>`)).toEqual([]);
  });
  test("skips tracking pixels and emoji", () => {
    expect(blocksOf(`<img src="https://example.com/p.gif" width="1" height="1">`)).toEqual([]);
    expect(blocksOf(`<img src="https://example.com/p.gif" width="3">`)).toEqual([]);
    expect(blocksOf(`<img src="https://example.com/twemoji/1f600.png" alt="x">`)).toEqual([]);
    expect(blocksOf(`<img class="emoji" src="https://example.com/e.png">`)).toEqual([]);
    expect(blocksOf(`<img src="https://example.com/ok.png" width="4">`)).toHaveLength(1);
  });
  test("upgrades pbs.twimg.com media URLs to the original size", () => {
    expect(normalize(`<img src="https://pbs.twimg.com/media/abc?format=jpg&name=small">`).assets[0]?.sourceUrl).toBe("https://pbs.twimg.com/media/abc?format=jpg&name=orig");
    expect(normalize(`<img src="https://pbs.twimg.com/profile_images/1/a.jpg">`).assets[0]?.sourceUrl).toBe("https://pbs.twimg.com/profile_images/1/a.jpg");
  });
  test("figure captions attach to the images inside", () => {
    const { blocks } = normalize(`<figure><img src="a.png" alt="alt"><figcaption> Nice view </figcaption></figure>`);
    expect(blocks).toEqual([{ type: "image", assetId: stableId("https://example.com/post/a.png"), alt: "alt", caption: "Nice view" }]);
  });
  test("a stray figcaption outside a figure is ignored", () => {
    expect(blocksOf("<figcaption>orphan</figcaption>")).toEqual([]);
  });
  test("the same image used twice yields two blocks and one asset", () => {
    const { blocks, assets } = normalize(`<img src="a.png"><img src="a.png">`);
    expect(blocks).toHaveLength(2);
    expect(assets).toHaveLength(1);
  });
  test("stops adding images after the asset limit", () => {
    const html = Array.from({ length: LIMITS.maxAssets + 5 }, (_, i) => `<img src="https://example.com/${i}.png">`).join("");
    const { blocks, assets } = normalize(html);
    expect(assets).toHaveLength(LIMITS.maxAssets);
    expect(blocks).toHaveLength(LIMITS.maxAssets);
  });
  test("an image inside a paragraph becomes its own block after the text", () => {
    expect(blocksOf(`<p>text <img src="https://example.com/a.png"> more</p>`).map(b => b.type)).toEqual(["paragraph", "image", "paragraph"]);
  });
  test("an inline link wrapping an image becomes a block container", () => {
    const { blocks } = normalize(`<a href="https://example.com/big"><img src="a.png"></a>`);
    expect(blocks.map(b => b.type)).toEqual(["image"]);
  });
  test("normalizeElement accepts an <img> root", () => {
    const img = document.createElement("img");
    img.setAttribute("src", "https://example.com/solo.png");
    expect(normalizeElement(img, BASE).blocks).toHaveLength(1);
    const tiny = document.createElement("img");
    tiny.setAttribute("src", "https://example.com/solo.png");
    tiny.setAttribute("width", "2");
    expect(normalizeElement(tiny, BASE)).toEqual({ blocks: [], assets: [] });
  });
  test("bestImageUrl is usable on its own", () => {
    const img = document.createElement("img");
    img.setAttribute("srcset", "a.png 1x, b.png 3x");
    expect(bestImageUrl(img, BASE)).toBe("https://example.com/post/b.png");
    expect(bestImageUrl(document.createElement("img"), BASE)).toBeUndefined();
  });
});

describe("video and audio embeds", () => {
  test("video with src and poster", () => {
    const { blocks, assets } = normalize(`<video src="clip.mp4" poster="poster.jpg"></video>`);
    const poster = "https://example.com/post/poster.jpg";
    expect(blocks).toEqual([{ type: "embed", url: "https://example.com/post/clip.mp4", label: "Video — open the original to play", posterAssetId: stableId(poster) }]);
    expect(assets).toEqual([{ id: stableId(poster), sourceUrl: poster, alt: "Video preview" }]);
  });
  test("reads the first <source> and labels audio", () => {
    expect(blocksOf(`<audio controls><source src="/a.mp3" type="audio/mpeg"></audio>`)).toEqual([
      { type: "embed", url: "https://example.com/a.mp3", label: "Audio — open the original to play", posterAssetId: undefined },
    ]);
  });
  test("falls back to the page URL when the media has no usable source", () => {
    expect(blocksOf(`<video></video>`)[0]).toMatchObject({ url: BASE });
    expect(blocksOf(`<video src="javascript:x"></video>`)[0]).toMatchObject({ url: BASE });
  });
  test("an unsafe poster is ignored", () => {
    const { blocks, assets } = normalize(`<video src="v.mp4" poster="javascript:x"></video>`);
    expect(blocks[0]).toMatchObject({ posterAssetId: undefined });
    expect(assets).toEqual([]);
  });
  test("a poster already registered is reused after the asset limit is hit", () => {
    const images = Array.from({ length: LIMITS.maxAssets - 1 }, (_, i) => `<img src="https://example.com/${i}.png">`).join("");
    const html = `${images}<video src="a.mp4" poster="https://example.com/p.png"></video><video src="b.mp4" poster="https://example.com/p.png"></video><video src="c.mp4" poster="https://example.com/q.png"></video>`;
    const { blocks, assets } = normalize(html);
    const embeds = blocks.filter(b => b.type === "embed") as Extract<Block, { type: "embed" }>[];
    expect(embeds.map(e => e.posterAssetId)).toEqual([stableId("https://example.com/p.png"), stableId("https://example.com/p.png"), undefined]);
    expect(assets).toHaveLength(LIMITS.maxAssets);
  });
});

describe("omission, containers and limits", () => {
  test("drops omitted subtrees entirely", () => {
    const html = `<nav><p>menu</p></nav><p>keep</p><footer><p>foot</p></footer><div class="advertisement"><p>ad</p></div><div hidden><p>h</p></div><div style="display:none"><p>d</p></div><aside><p>side</p></aside><form><p>f</p></form><iframe src="https://example.com/x"></iframe>`;
    expect(blocksOf(html)).toEqual([{ type: "paragraph", content: text("keep") }]);
  });
  test("inline svg text is dropped from the output", () => {
    expect(blocksOf("<svg><text>label</text></svg>")).toEqual([]);
    expect(blocksOf("<p>keep<svg><text>label</text></svg></p>")).toEqual([{ type: "paragraph", content: text("keep") }]);
  });
  test("generic containers recurse into their children", () => {
    expect(blocksOf("<div><section><div><p>deep</p></div></section></div>")).toEqual([{ type: "paragraph", content: text("deep") }]);
  });
  test("block nesting is cut off beyond 35 levels", () => {
    expect(blocksOf(nest("<div>", "</div>", 34, "<p>ok</p>"))).toHaveLength(1);
    expect(blocksOf(nest("<div>", "</div>", 35, "<p>gone</p>"))).toEqual([]);
  });
  test("throws when a page has more blocks than the limit", () => {
    const html = "<p>x</p>".repeat(LIMITS.maxBlocks + 1);
    expect(() => normalize(html)).toThrow("This page is too large to capture safely.");
    expect(normalize("<p>x</p>".repeat(LIMITS.maxBlocks)).blocks).toHaveLength(LIMITS.maxBlocks);
  });
  test("an empty root yields no blocks and no assets", () => {
    expect(normalize("")).toEqual({ blocks: [], assets: [] });
  });
});
