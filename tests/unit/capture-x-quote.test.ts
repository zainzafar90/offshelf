import { collectVisiblePosts } from "../../src/capture/x-thread";

const SELECTED = "2103891145130414387";
const QUOTED = "2103800000000000000";

function tweet(handle: string, id: string, text: string, extra = ""): string {
  return `<div role="link"><article data-testid="tweet">
    <div data-testid="User-Name"><span>${handle}</span><a role="link" href="https://x.com/${handle}/status/${id}"><time datetime="2026-09-26T19:55:00.000Z">8h</time></a></div>
    <div data-testid="tweetText">${text}</div>${extra}
  </article></div>`;
}

// Focal post on a status page: no header timestamp; a quoted post whose own
// time is not inside a link comes first; the post's own timestamp link is last.
// Real X wraps every post in a role="link" element (every <time> is inside one).
const focal = `<div role="link"><article data-testid="tweet">
  <div data-testid="User-Name"><span>NicolasZu</span></div>
  <div data-testid="tweetText">Huge fan of Codex here.</div>
  <div role="link" tabindex="0">
    <div data-testid="User-Name"><span>NicolasZu</span><time datetime="2026-09-26T13:00:00.000Z">8h</time></div>
    <div data-testid="tweetText">Why does it feel like the sub is 5x more usage?</div>
  </div>
  <a role="link" href="https://x.com/NicolasZu/status/${SELECTED}"><time datetime="2026-09-26T19:55:00.000Z">9:55 PM · Sep 26, 2026</time></a>
</article></div>`;

function page(): Document {
  document.body.innerHTML = `<div data-testid="primaryColumn">
    ${focal}
    ${tweet("someone", "2103900000000000001", "Just use the other model")}
    ${tweet("NicolasZu", "2103900000000000002", "Dont’ wanna use it when Astra or Opus 5.5 is available!")}
  </div>`;
  return document;
}

test("keeps the selected post when it quotes another post", () => {
  const { sections } = collectVisiblePosts(page(), "NicolasZu", SELECTED);
  expect(sections[0]?.id).toBe(SELECTED);
  expect(sections[0]?.relation).toBe("selected");
  expect(JSON.stringify(sections[0]?.blocks)).toContain("Huge fan of Codex here.");
});

test("stops at the first reply by someone else instead of collecting the author's later replies", () => {
  const { sections } = collectVisiblePosts(page(), "NicolasZu", SELECTED);
  expect(sections.map(s => s.id)).toEqual([SELECTED]);
  expect(sections.map(s => s.id)).not.toContain(QUOTED);
});

test("falls back to the first status-linked timestamp when every time sits in a nested link card", () => {
  document.body.innerHTML = `<div data-testid="primaryColumn"><article data-testid="tweet">
    <div data-testid="tweetText">Main post text</div>
    <div role="link"><time>9h</time><div data-testid="tweetText">Quoted text</div></div>
    <div role="link"><a role="link" href="https://x.com/NicolasZu/status/${SELECTED}"><time>9:55 PM</time></a></div>
  </article></div>`;
  const { sections } = collectVisiblePosts(document, "NicolasZu", SELECTED);
  expect(sections[0]?.id).toBe(SELECTED);
});

test("saves the author's avatar, not the quoted author's", () => {
  document.body.innerHTML = `<div data-testid="primaryColumn"><article data-testid="tweet">
    <div data-testid="Tweet-User-Avatar"><img src="https://pbs.twimg.com/profile_images/1/me_normal.jpg"></div>
    <div data-testid="tweetText">Main post text</div>
    <div role="link"><div data-testid="Tweet-User-Avatar"><img src="https://pbs.twimg.com/profile_images/2/them_normal.jpg"></div><time>9h</time></div>
    <a role="link" href="https://x.com/NicolasZu/status/${SELECTED}"><time>9:55 PM</time></a>
  </article></div>`;
  const { sections, assets } = collectVisiblePosts(document, "NicolasZu", SELECTED);
  const avatar = assets.find(asset => asset.id === sections[0]?.avatarAssetId);
  expect(avatar?.sourceUrl).toBe("https://pbs.twimg.com/profile_images/1/me_bigger.jpg");
});

describe("after the selected post scrolls out of the page", () => {
  const CONTINUATION = "2103891145130414390";
  test("ignores the author's replies to comments", () => {
    document.body.innerHTML = `<div data-testid="primaryColumn">
      ${tweet("someone", "2103900000000000001", "Just use the other model")}
      ${tweet("NicolasZu", "2103900000000000002", "Yeah I do that but it’s a workaround")}
    </div>`;
    const { sections } = collectVisiblePosts(document, "NicolasZu", SELECTED, new Set([SELECTED]));
    expect(sections).toEqual([]);
  });
  test("keeps continuing the thread from a post it already saved", () => {
    document.body.innerHTML = `<div data-testid="primaryColumn">
      ${tweet("NicolasZu", CONTINUATION, "Second part of the thread")}
      ${tweet("NicolasZu", "2103891145130414391", "Third part")}
      ${tweet("someone", "2103900000000000001", "Nice thread")}
      ${tweet("NicolasZu", "2103900000000000002", "Thanks!")}
    </div>`;
    const { sections } = collectVisiblePosts(document, "NicolasZu", SELECTED, new Set([SELECTED, CONTINUATION]));
    expect(sections.map(s => s.id)).toEqual([CONTINUATION, "2103891145130414391"]);
  });
});
