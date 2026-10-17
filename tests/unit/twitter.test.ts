import { captureThread } from "../../src/capture/x-capture";
import { collectVisiblePosts, mergePosts } from "../../src/capture/x-thread";
import { findXArticle, readXArticle } from "../../src/capture/x-article";
import { getPostIdentity, isXHost } from "../../src/capture/x-identity";
import { LIMITS } from "../../src/core/model";
import type { AssetDescriptor, Block, Section, Snapshot } from "../../src/core/model";
import { stableId } from "../../src/core/identity";

const SELECTED = "1000000000000000001";
const NEXT = "1000000000000000002";
const LATER = "1000000000000000003";
const EARLIER = "1000000000000000000";

type TweetOptions = { name?: string; time?: string; extra?: string; avatar?: string; promoted?: boolean };
function tweet(handle: string, id: string, body: string, options: TweetOptions = {}): string {
  const { name = handle, time = "2026-09-26T10:00:00.000Z", extra = "", avatar = "", promoted = false } = options;
  return `<article data-testid="tweet">
    ${avatar ? `<div data-testid="Tweet-User-Avatar"><img src="${avatar}"></div>` : ""}
    <div data-testid="User-Name"><span>${name}</span><span>@${handle}</span></div>
    ${body ? `<div data-testid="tweetText">${body}</div>` : ""}${extra}
    ${promoted ? '<div data-testid="promotedIndicator">Ad</div>' : ""}
    <a role="link" href="https://x.com/${handle}/status/${id}"><time datetime="${time}">t</time></a>
  </article>`;
}
const column = (...posts: string[]) => { document.body.innerHTML = `<div data-testid="primaryColumn">${posts.join("")}</div>`; return document; };
const ids = (result: { sections: Section[] }) => result.sections.map(s => s.id);
const collect = (known?: Set<string>) => collectVisiblePosts(document, "ada", SELECTED, known);
const textOf = (blocks: Block[]) => JSON.stringify(blocks);

describe("isXHost", () => {
  test.each(["x.com", "www.x.com", "twitter.com", "www.twitter.com"])("accepts %s", host => expect(isXHost(host)).toBe(true));
  test.each(["mobile.twitter.com", "xx.com", "x.com.evil.test", "evil-x.com", "example.com", "", "X.COM"])("rejects %s", host => expect(isXHost(host)).toBe(false));
});

describe("getPostIdentity", () => {
  test("reads handle and id from status URLs on x.com and twitter.com", () => {
    expect(getPostIdentity("https://x.com/ada/status/123")).toEqual({ handle: "ada", id: "123" });
    expect(getPostIdentity("https://www.twitter.com/Ada_L/status/9876543210123456789")).toEqual({ handle: "Ada_L", id: "9876543210123456789" });
  });
  test("ignores trailing path, query and hash", () => {
    expect(getPostIdentity("https://x.com/ada/status/123/photo/1?s=20#x")).toEqual({ handle: "ada", id: "123" });
  });
  test("returns undefined for non-post pages, other hosts and garbage", () => {
    for (const url of ["https://x.com/ada", "https://x.com/ada/status/abc", "https://x.com/i/status", "https://example.com/ada/status/1", "https://mobile.twitter.com/ada/status/1", "not a url", ""])
      expect(getPostIdentity(url)).toBeUndefined();
  });
});

describe("findXArticle and readXArticle", () => {
  const articleHtml = (testid: string) => `<div data-testid="${testid}"><h1>Long read</h1><p>${"Some words here. ".repeat(20)}</p></div>`;
  test.each(["twitterArticleReadView", "twitterArticleRichTextView", "articleBody"])("finds an article by %s", testid => {
    document.body.innerHTML = articleHtml(testid);
    expect(findXArticle(document)?.getAttribute("data-testid")).toBe(testid);
  });
  test("finds nothing on an ordinary page", () => {
    document.body.innerHTML = "<main><p>no article</p></main>";
    expect(findXArticle(document)).toBeNull();
  });
  test("readXArticle builds an x-article snapshot with a rendered-snapshot warning", () => {
    document.body.innerHTML = articleHtml("twitterArticleReadView");
    const snap = readXArticle(document, "https://x.com/ada/article/55?utm_source=a#top");
    expect(snap.document).toMatchObject({ kind: "x-article", sourceUrl: "https://x.com/ada/article/55", title: "Long read", completeness: "page-snapshot" });
    expect(snap.document.warnings.at(-1)).toEqual({ code: "x-snapshot", message: "Saved the rendered X Article. Expand any hidden content before capture." });
  });
  test("readXArticle throws when the article body is not loaded", () => {
    document.body.innerHTML = "<main></main>";
    expect(() => readXArticle(document, "https://x.com/ada/article/55")).toThrow("The X Article body is not loaded. Open the full article, then capture it again.");
  });
});

describe("collectVisiblePosts: which posts are kept", () => {
  test("keeps the selected post and the author's consecutive follow-ups, in page order", () => {
    column(tweet("ada", SELECTED, "first"), tweet("ada", NEXT, "second"), tweet("ada", LATER, "third"));
    expect(ids(collect())).toEqual([SELECTED, NEXT, LATER]);
  });
  test("marks only the selected post as selected", () => {
    column(tweet("ada", SELECTED, "first"), tweet("ada", NEXT, "second"));
    expect(collect().sections.map(s => s.relation)).toEqual(["selected", "candidate"]);
  });
  test("includes the author's earlier posts but not other people's", () => {
    column(tweet("ada", EARLIER, "root"), tweet("bob", "1000000000000000099", "reply"), tweet("ada", SELECTED, "selected"));
    expect(ids(collect())).toEqual([EARLIER, SELECTED]);
  });
  test("ends the thread at the first post by someone else", () => {
    column(tweet("ada", SELECTED, "a"), tweet("bob", "1000000000000000099", "b"), tweet("ada", LATER, "c"));
    expect(ids(collect())).toEqual([SELECTED]);
  });
  test("handle matching ignores case", () => {
    column(tweet("Ada", SELECTED, "a"), tweet("ADA", NEXT, "b"));
    expect(ids(collectVisiblePosts(document, "aDa", SELECTED))).toEqual([SELECTED, NEXT]);
  });
  test("returns nothing when neither the selected nor a known post is on the page", () => {
    column(tweet("ada", NEXT, "second"));
    expect(collect()).toEqual({ sections: [], assets: [], truncated: false });
  });
  test("anchors on the first already-known post when the selected post scrolled away", () => {
    column(tweet("ada", NEXT, "second"), tweet("ada", LATER, "third"));
    expect(ids(collect(new Set([NEXT])))).toEqual([NEXT, LATER]);
  });
  test("skips promoted posts and posts inside placement tracking", () => {
    column(tweet("ada", SELECTED, "a"), tweet("ada", NEXT, "ad", { promoted: true }),
      `<div data-testid="placementTracking">${tweet("ada", LATER, "tracked")}</div>`);
    expect(ids(collect())).toEqual([SELECTED]);
  });
  test("only reads posts inside the primary column when one exists", () => {
    document.body.innerHTML = `<aside>${tweet("ada", NEXT, "sidebar")}</aside><div data-testid="primaryColumn">${tweet("ada", SELECTED, "main")}</div>`;
    expect(ids(collect())).toEqual([SELECTED]);
  });
  test("falls back to the whole page without a primary column", () => {
    document.body.innerHTML = tweet("ada", SELECTED, "main");
    expect(ids(collect())).toEqual([SELECTED]);
  });
  test("ignores articles without a status-linked timestamp", () => {
    column(`<article data-testid="tweet"><div data-testid="tweetText">orphan</div><time>1h</time></article>`, tweet("ada", SELECTED, "ok"));
    expect(ids(collect())).toEqual([SELECTED]);
  });
  test("skips a post that has no readable content", () => {
    column(tweet("ada", SELECTED, "first"), tweet("ada", NEXT, ""), tweet("ada", LATER, "third"));
    expect(ids(collect())).toEqual([SELECTED, LATER]);
  });
  test("flags posts that show a Show more control", () => {
    column(tweet("ada", SELECTED, "long", { extra: '<span data-testid="tweet-text-show-more-link">Show more</span>' }));
    expect(collect().truncated).toBe(true);
    column(tweet("ada", SELECTED, "short"));
    expect(collect().truncated).toBe(false);
  });
});

describe("collectVisiblePosts: section contents", () => {
  test("fills in author, handle, date and canonical source URL", () => {
    column(tweet("ada", SELECTED, "hello", { name: "Ada Lovelace", time: "2026-09-26T19:55:00.000Z" }));
    expect(collect().sections[0]).toMatchObject({
      id: SELECTED, sourceUrl: `https://x.com/ada/status/${SELECTED}`, author: "Ada Lovelace", handle: "ada", publishedAt: "2026-09-26T19:55:00.000Z",
      blocks: [{ type: "paragraph", content: [{ text: "hello" }] }],
    });
  });
  test("falls back to the handle when the display name is empty", () => {
    column(`<article data-testid="tweet"><div data-testid="User-Name"><span>@ada</span></div><div data-testid="tweetText">hi</div>
      <a href="https://x.com/ada/status/${SELECTED}"><time>1h</time></a></article>`);
    expect(collect().sections[0]?.author).toBe("ada");
  });
  test("keeps links and hashtags in the text", () => {
    column(tweet("ada", SELECTED, `see <a href="https://example.com/p">this</a> <a href="/hashtag/x">#x</a>`));
    const content = (collect().sections[0]?.blocks[0] as Extract<Block, { type: "paragraph" }>).content;
    expect(content).toEqual([{ text: "see " }, { text: "this", href: "https://example.com/p" }, { text: " " }, { text: "#x", href: `https://x.com/hashtag/x` }]);
  });
  test("adds photos, video and link cards after the text", () => {
    const extra = `<div data-testid="tweetPhoto"><img src="https://pbs.twimg.com/media/PHOTO?format=jpg&name=small" alt="a photo"></div>
      <video poster="https://pbs.twimg.com/ext_tw_video_thumb/1/p.jpg" src="https://video.twimg.com/v.mp4"></video>
      <div data-testid="card.wrapper"><a href="https://example.com/story">Story</a></div>`;
    column(tweet("ada", SELECTED, "look", { extra }));
    const { sections, assets } = collect();
    expect(sections[0]?.blocks.map(b => b.type)).toEqual(["paragraph", "image", "embed", "paragraph"]);
    expect(assets.map(a => a.sourceUrl)).toEqual(["https://pbs.twimg.com/media/PHOTO?format=jpg&name=orig", "https://pbs.twimg.com/ext_tw_video_thumb/1/p.jpg"]);
  });
  test("a second tweetText outside a quote card becomes a blockquote", () => {
    column(tweet("ada", SELECTED, "main", { extra: '<div data-testid="tweetText">extra &amp; text</div>' }));
    expect(collect().sections[0]?.blocks).toEqual([
      { type: "paragraph", content: [{ text: "main" }] },
      { type: "quote", blocks: [{ type: "paragraph", content: [{ text: "extra & text" }] }] },
    ]);
  });
  test("uses the larger avatar variant and registers it as an asset", () => {
    column(tweet("ada", SELECTED, "hi", { avatar: "https://pbs.twimg.com/profile_images/1/me_normal.jpg" }));
    const { sections, assets } = collect();
    const url = "https://pbs.twimg.com/profile_images/1/me_bigger.jpg";
    expect(sections[0]?.avatarAssetId).toBe(stableId(url));
    expect(assets).toEqual([{ id: stableId(url), sourceUrl: url, alt: "" }]);
  });
  test("ignores data: avatars", () => {
    column(tweet("ada", SELECTED, "hi", { avatar: "data:image/png;base64,AAAA" }));
    expect(collect().sections[0]?.avatarAssetId).toBeUndefined();
  });
  test("dedupes assets shared between posts", () => {
    const avatar = "https://pbs.twimg.com/profile_images/1/me_normal.jpg";
    column(tweet("ada", SELECTED, "a", { avatar }), tweet("ada", NEXT, "b", { avatar }));
    expect(collect().assets).toHaveLength(1);
  });
  test("a quoted post becomes a quote block with a citation", () => {
    const quoted = `<div role="link" tabindex="0">
      <div data-testid="Tweet-User-Avatar"><img src="https://pbs.twimg.com/profile_images/2/gh_normal.jpg"></div>
      <div data-testid="User-Name"><span>Grace Hopper</span><span>@grace</span></div>
      <div data-testid="tweetText">Nanoseconds matter</div></div>`;
    column(tweet("ada", SELECTED, "Reading this", { extra: quoted }));
    const { sections, assets } = collect();
    const avatarUrl = "https://pbs.twimg.com/profile_images/2/gh_bigger.jpg";
    expect(sections[0]?.blocks).toEqual([
      { type: "paragraph", content: [{ text: "Reading this" }] },
      { type: "quote", cite: { author: "Grace Hopper", handle: "grace", avatarAssetId: stableId(avatarUrl) },
        blocks: [{ type: "paragraph", content: [{ text: "Nanoseconds matter" }] }] },
    ]);
    expect(assets.map(a => a.sourceUrl)).toContain(avatarUrl);
    expect(textOf(sections[0]!.blocks)).not.toContain("Reading thisNanoseconds");
  });
  test("a quote card without readable content is dropped", () => {
    const quoted = `<div role="link"><div data-testid="User-Name"><span>Grace</span><span>@grace</span></div></div>`;
    column(tweet("ada", SELECTED, "Only mine", { extra: quoted }));
    expect(collect().sections[0]?.blocks).toHaveLength(1);
  });
});

describe("mergePosts", () => {
  const asset = (n: number): AssetDescriptor => ({ id: `asset-${n}`, sourceUrl: `https://img.example.com/${n}.png`, alt: "" });
  const section = (id: string, assetIds: string[] = [], avatar?: string): Section => ({
    id, sourceUrl: `https://x.com/ada/status/${id}`, avatarAssetId: avatar,
    blocks: assetIds.map(assetId => ({ type: "image" as const, assetId, alt: "" })),
  });
  const maps = () => ({ sections: new Map<string, Section>(), assets: new Map<string, AssetDescriptor>() });

  test("adds sections and their assets and reports no limit", () => {
    const { sections, assets } = maps();
    const limited = mergePosts(sections, assets, { sections: [section("1", ["asset-1"]), section("2")], assets: [asset(1)] });
    expect(limited).toBe(false);
    expect([...sections.keys()]).toEqual(["1", "2"]);
    expect([...assets.keys()]).toEqual(["asset-1"]);
  });
  test("counts avatar assets", () => {
    const { sections, assets } = maps();
    mergePosts(sections, assets, { sections: [section("1", [], "asset-9")], assets: [asset(9)] });
    expect([...assets.keys()]).toEqual(["asset-9"]);
  });
  test("replaces an existing section with the same id", () => {
    const { sections, assets } = maps();
    mergePosts(sections, assets, { sections: [section("1")], assets: [] });
    const updated = { ...section("1"), author: "new" };
    mergePosts(sections, assets, { sections: [updated], assets: [] });
    expect(sections.get("1")?.author).toBe("new");
  });
  test("skips a section whose assets were not offered and reports the limit", () => {
    const { sections, assets } = maps();
    const limited = mergePosts(sections, assets, { sections: [section("1", ["asset-1"]), section("2")], assets: [] });
    expect(limited).toBe(true);
    expect([...sections.keys()]).toEqual(["2"]);
  });
  test("stops adding new posts at the post limit but still updates existing ones", () => {
    const { sections, assets } = maps();
    for (let i = 0; i < LIMITS.maxPosts; i++) sections.set(`p${i}`, section(`p${i}`));
    expect(mergePosts(sections, assets, { sections: [section("new")], assets: [] })).toBe(true);
    expect(sections.has("new")).toBe(false);
    expect(mergePosts(sections, assets, { sections: [{ ...section("p0"), author: "edited" }], assets: [] })).toBe(false);
    expect(sections.get("p0")?.author).toBe("edited");
  });
  test("refuses a section that would exceed the asset limit", () => {
    const { sections, assets } = maps();
    for (let i = 0; i < LIMITS.maxAssets; i++) assets.set(`old-${i}`, asset(i));
    expect(mergePosts(sections, assets, { sections: [section("1", ["asset-new"])], assets: [asset(999)].map(a => ({ ...a, id: "asset-new" })) })).toBe(true);
    expect(sections.size).toBe(0);
    expect(assets.size).toBe(LIMITS.maxAssets);
  });
  test("does not recount assets that are already stored", () => {
    const { sections, assets } = maps();
    for (let i = 0; i < LIMITS.maxAssets; i++) assets.set(`old-${i}`, asset(i));
    expect(mergePosts(sections, assets, { sections: [section("1", ["old-0"])], assets: [] })).toBe(false);
    expect(sections.has("1")).toBe(true);
  });
});

describe("captureThread", () => {
  const SOURCE = `https://x.com/ada/status/${SELECTED}`;
  const checkpoint = vi.fn(async (_snapshot: Snapshot, _message: string) => {});
  const controller = () => new AbortController();
  const options = { autoScroll: false, maxPasses: 1 };
  const capture = (opts = options, signal = controller().signal, source = SOURCE) => captureThread(document, source, opts, signal, checkpoint);

  beforeEach(() => {
    checkpoint.mockClear();
    vi.stubGlobal("location", { href: SOURCE });
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    vi.spyOn(window, "scrollBy").mockImplementation(() => {});
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

  test("rejects a URL that is not a specific post", async () => {
    await expect(capture(options, controller().signal, "https://x.com/ada")).rejects.toThrow("Open a specific X post or thread before saving it.");
  });
  test("builds a thread snapshot from the rendered posts", async () => {
    column(tweet("ada", SELECTED, "Thread opener <b>here</b>", { name: "Ada" }), tweet("ada", NEXT, "Part two"));
    const snap = await capture();
    expect(snap.document).toMatchObject({
      id: stableId(SOURCE), sourceUrl: SOURCE, kind: "thread", siteName: "X", title: "Thread opener here", author: "Ada",
      completeness: "unverified", starred: false, archived: false, read: false, progress: 0, tags: [], assetIds: [],
    });
    expect(snap.document.sections.map(s => s.id)).toEqual([SELECTED, NEXT]);
    expect(snap.document.wordCount).toBeGreaterThan(0);
    expect(snap.document.warnings.map(w => w.code)).toEqual(["thread-unverified", "starting-post"]);
    expect(snap.assets).toEqual([]);
  });
  test("orders sections by numeric post id regardless of page order", async () => {
    column(tweet("ada", SELECTED, "a"), tweet("ada", "1000000000000000010", "b"), tweet("ada", "999999999999999999", "c"));
    const snap = await capture();
    expect(snap.document.sections.map(s => s.id)).toEqual(["999999999999999999", SELECTED, "1000000000000000010"]);
  });
  test("titles the thread by handle when the selected post has no leading paragraph and caps long titles", async () => {
    column(tweet("ada", SELECTED, "", { extra: '<div data-testid="tweetPhoto"><img src="https://pbs.twimg.com/media/ONLY?format=png"></div>' }));
    expect((await capture()).document.title).toBe("Thread by @ada");
    column(tweet("ada", SELECTED, "x".repeat(300)));
    expect((await capture()).document.title).toHaveLength(110);
  });
  test("sends a checkpoint with the collected count", async () => {
    column(tweet("ada", SELECTED, "a"), tweet("ada", NEXT, "b"));
    await capture();
    expect(checkpoint).toHaveBeenCalledTimes(1);
    expect(checkpoint.mock.calls[0]?.[1]).toBe("Collected 2 posts · pass 1");
    column(tweet("ada", SELECTED, "a"));
    checkpoint.mockClear();
    await capture();
    expect(checkpoint.mock.calls[0]?.[1]).toBe("Collected 1 post · pass 1");
  });
  test("adds a truncation warning and clicks Show more only on the author's posts", async () => {
    const more = '<span data-testid="tweet-text-show-more-link">Show more</span>';
    column(tweet("ada", SELECTED, "long", { extra: more }), tweet("bob", "1000000000000000099", "other", { extra: more }));
    const clicks: string[] = [];
    document.querySelectorAll('[data-testid="tweet-text-show-more-link"]').forEach(button => button.addEventListener("click", () => clicks.push(button.closest("article")?.querySelector("[data-testid=User-Name] span")?.textContent ?? "")));
    const snap = await capture();
    expect(clicks).toEqual(["ada"]);
    expect(snap.document.warnings.map(w => w.code)).toContain("truncated-post");
  });
  test("fails when the selected post is not rendered", async () => {
    column(tweet("ada", NEXT, "not the selected one"));
    await expect(capture()).rejects.toThrow("The selected post was not found in the rendered page. Open it fully and try again.");
    expect(checkpoint).not.toHaveBeenCalled();
  });
  test("fails when cancelled", async () => {
    column(tweet("ada", SELECTED, "a"));
    const abort = controller();
    abort.abort();
    await expect(capture(options, abort.signal)).rejects.toThrow("Capture cancelled.");
  });
  test("fails when the page navigates away", async () => {
    column(tweet("ada", SELECTED, "a"));
    vi.stubGlobal("location", { href: "https://x.com/ada/status/5" });
    await expect(capture()).rejects.toThrow("The source page changed during capture. The last checkpoint was kept.");
  });
  test("treats tracking params on the live URL as the same page", async () => {
    column(tweet("ada", SELECTED, "a"));
    vi.stubGlobal("location", { href: `${SOURCE}?s=20#x` });
    await expect(capture()).resolves.toBeDefined();
  });
  test("restores the scroll position even when capture fails", async () => {
    column(tweet("ada", NEXT, "missing selected"));
    await capture().catch(() => {});
    expect(window.scrollTo).toHaveBeenCalledWith(window.scrollX, window.scrollY);
  });
  test("an auto-scroll capture that runs out of passes is partial with a capture-limit warning", async () => {
    column(tweet("ada", SELECTED, "a"));
    const snap = await capture({ autoScroll: true, maxPasses: 1 });
    /* current behavior: hitting the last pass is treated as reaching the limit */
    expect(snap.document.completeness).toBe("partial");
    expect(snap.document.warnings.map(w => w.code)).toContain("capture-limit");
    expect(window.scrollBy).toHaveBeenCalledWith(0, Math.max(600, window.innerHeight * 0.85));
  });
  test("auto-scroll stops after five idle passes without flagging a limit", async () => {
    vi.useFakeTimers();
    column(tweet("ada", SELECTED, "a"));
    const pending = capture({ autoScroll: true, maxPasses: 20 });
    await vi.advanceTimersByTimeAsync(10_000);
    const snap = await pending;
    /* the initial collect counts as the first sighting, so idle hits 5 on pass 5 */
    expect(checkpoint).toHaveBeenCalledTimes(5);
    expect(snap.document.completeness).toBe("unverified");
    expect(snap.document.warnings.map(w => w.code)).not.toContain("capture-limit");
  });
});
