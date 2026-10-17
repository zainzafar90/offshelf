import type { AssetDescriptor, Section } from "../../src/core/model";
import { LIMITS } from "../../src/core/model";
import { collectVisiblePosts, mergePosts } from "../../src/capture/x-thread";

const SELECTED = "2103891145130414387";

function focalWithQuote(): Document {
  document.body.innerHTML = `<div data-testid="primaryColumn"><article data-testid="tweet">
    <div data-testid="Tweet-User-Avatar"><img src="https://pbs.twimg.com/profile_images/1/me_normal.jpg"></div>
    <div data-testid="User-Name"><span>Nicolas Zullo</span><span>@NicolasZu</span></div>
    <div data-testid="tweetText">Huge fan of Codex here.</div>
    <div data-testid="tweetPhoto"><img src="https://pbs.twimg.com/media/own.jpg"></div>
    <div role="link" tabindex="0">
      <div data-testid="Tweet-User-Avatar"><img src="https://pbs.twimg.com/profile_images/2/them_normal.jpg"></div>
      <div data-testid="User-Name"><span>Other Person</span><span>@other</span><time>9h</time></div>
      <div data-testid="tweetText">Why does it feel like the sub is 5x more usage?</div>
      <div data-testid="tweetPhoto"><img src="https://pbs.twimg.com/media/quoted.jpg"></div>
    </div>
    <a role="link" href="https://x.com/NicolasZu/status/${SELECTED}"><time>9:55 PM</time></a>
  </article></div>`;
  return document;
}

test("keeps the quoted post's author, picture, text and photo inside the quote", () => {
  const { sections, assets } = collectVisiblePosts(focalWithQuote(), "NicolasZu", SELECTED);
  const blocks = sections[0]!.blocks;
  const quote = blocks.find(block => block.type === "quote");
  expect(quote?.type === "quote" && quote.cite?.author).toBe("Other Person");
  expect(quote?.type === "quote" && quote.cite?.handle).toBe("other");
  const avatar = assets.find(asset => quote?.type === "quote" && asset.id === quote.cite?.avatarAssetId);
  expect(avatar?.sourceUrl).toContain("/profile_images/2/");
  expect(JSON.stringify(quote)).toContain("5x more usage");
  const quotedPhoto = assets.find(asset => asset.sourceUrl.includes("quoted.jpg"));
  expect(JSON.stringify(quote)).toContain(quotedPhoto!.id);
  const outside = blocks.filter(block => block.type !== "quote");
  expect(JSON.stringify(outside)).not.toContain(quotedPhoto!.id);
  expect(JSON.stringify(outside)).toContain("Huge fan of Codex here.");
  expect(outside.some(block => block.type === "image")).toBe(true);
});

describe("mergePosts", () => {
  const image = (n: number): AssetDescriptor => ({ id: `a${n}`, sourceUrl: `https://pbs.twimg.com/media/${n}.jpg`, alt: "" });
  const post = (id: string, assetIds: string[]): Section => ({
    id, sourceUrl: `https://x.com/a/status/${id}`, blocks: assetIds.map(assetId => ({ type: "image", assetId, alt: "" })),
  });
  function full(): Map<string, AssetDescriptor> {
    return new Map(Array.from({ length: LIMITS.maxAssets - 1 }, (_, n) => [`a${n}`, image(n)]));
  }

  test("skips a post whose images would pass the image limit instead of breaking the save", () => {
    const sections = new Map<string, Section>();
    const assets = full();
    const limited = mergePosts(sections, assets, { sections: [post("1", ["b1", "b2"])], assets: [{ ...image(1), id: "b1" }, { ...image(2), id: "b2" }] });
    expect(limited).toBe(true);
    expect(sections.size).toBe(0);
    expect(assets.size).toBe(LIMITS.maxAssets - 1);
  });

  test("keeps a post that still fits", () => {
    const sections = new Map<string, Section>();
    const assets = full();
    const limited = mergePosts(sections, assets, { sections: [post("1", ["b1"])], assets: [{ ...image(1), id: "b1" }] });
    expect(limited).toBe(false);
    expect([...sections.keys()]).toEqual(["1"]);
    expect(assets.has("b1")).toBe(true);
  });
});
