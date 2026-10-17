import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Asset, Block, SavedDocument, Section } from "../../src/core/model";
import { ArticleCard } from "../../src/surfaces/library/article-card";
import { ListRow } from "../../src/surfaces/library/list-row";
import { PostCard } from "../../src/surfaces/library/post-card";
import { sampleDocument } from "../helpers/fixtures";

const noop = () => {};
const capturedAt = "2026-09-01T12:00:00.000Z";

beforeEach(() => {
  let n = 0;
  URL.createObjectURL = vi.fn(() => `blob:test/${++n}`);
  URL.revokeObjectURL = vi.fn();
});

function saved(id: string): Asset {
  return { id, sourceUrl: `https://img.example/${id}.png`, alt: id, status: "saved", blob: new Blob(["x"], { type: "image/png" }), bytes: 1, attempts: 0, updatedAt: "" };
}
const assetMap = (...ids: string[]) => new Map(ids.map((id): [string, Asset] => [id, saved(id)]));
const section = (id: string, blocks: Block[], over: Partial<Section> = {}): Section => ({ id, sourceUrl: "https://example.com/post", excluded: false, blocks, ...over });
const image = (assetId: string): Block => ({ type: "image", assetId, alt: assetId });
const text = (value: string): Block => ({ type: "paragraph", content: [{ text: value }] });

describe("article card", () => {
  const card = (doc: SavedDocument, assets = new Map<string, Asset>(), onOpen = vi.fn(), onStar = vi.fn()) => {
    const view = render(<ArticleCard doc={doc} assets={assets} onOpen={onOpen} onStar={onStar} />);
    return { ...view, onOpen, onStar };
  };

  test("shows site, reading time, author, saved date and excerpt", () => {
    card(sampleDocument({ siteName: "Craft Blog", readingMinutes: 7, author: "Ada", capturedAt, excerpt: "A short excerpt." }));
    expect(screen.getByText("Craft Blog · 7 min read")).toBeInTheDocument();
    expect(screen.getByText("Ada · Saved Sep 1, 2026")).toBeInTheDocument();
    expect(screen.getByText("A short excerpt.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open ↗" })).toHaveAttribute("href", "https://example.com/post");
  });

  test("falls back to the host name when the site name is empty", () => {
    card(sampleDocument({ siteName: "", sourceUrl: "https://www.longreads.com/a" }));
    expect(screen.getByText("longreads.com · 1 min read")).toBeInTheDocument();
  });

  test("uses the first image of the first included section as the cover", () => {
    const doc = sampleDocument({ sections: [
      section("skip", [image("hidden")], { excluded: true }),
      section("a", [text("intro"), image("first"), image("second")]),
    ] });
    const { container } = card(doc, assetMap("hidden", "first", "second"));
    expect(container.querySelectorAll("img")).toHaveLength(1);
    expect(container.querySelector("img")).toHaveAttribute("src", "blob:test/1");
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });

  test("shows no cover when the image is not saved or has no record", () => {
    const failed: Asset = { ...saved("first"), status: "failed", blob: undefined };
    const doc = sampleDocument({ sections: [section("a", [image("first")])] });
    expect(card(doc, new Map([["first", failed]])).container.querySelector("img")).toBeNull();
  });

  test("a later saved image is not used when the first image is missing", () => {
    const doc = sampleDocument({ sections: [section("a", [image("first"), image("second")])] });
    expect(card(doc, assetMap("second")).container.querySelector("img")).toBeNull();
  });

  test("no cover for a text-only article", () => {
    expect(card(sampleDocument()).container.querySelector("img")).toBeNull();
  });

  test("reading progress shows as a percentage only when started", () => {
    const { unmount } = card(sampleDocument({ progress: 0 }));
    expect(screen.queryByText(/%$/)).toBeNull();
    unmount();
    card(sampleDocument({ progress: 0.456 }));
    expect(screen.getByText("46%")).toBeInTheDocument();
  });

  test("counts images that are not saved, singular and plural", () => {
    const one = sampleDocument({ sections: [section("a", [image("x")])] });
    const { unmount } = card(one, assetMap());
    expect(screen.getByText("1 image not saved")).toBeInTheDocument();
    unmount();
    card(sampleDocument({ sections: [section("a", [image("x"), image("y")])] }), assetMap("x"));
    expect(screen.getByText("1 image not saved")).toBeInTheDocument();
  });

  test("pluralizes when several images are not saved", () => {
    card(sampleDocument({ sections: [section("a", [image("x"), image("y"), image("z")])] }), assetMap("x"));
    expect(screen.getByText("2 images not saved")).toBeInTheDocument();
  });

  test("no missing-image note when every image is saved", () => {
    card(sampleDocument({ sections: [section("a", [image("x")])] }), assetMap("x"));
    expect(screen.queryByText(/not saved/)).toBeNull();
  });

  test("marks samples", () => {
    card(sampleDocument({ tags: ["Sample"] }));
    expect(screen.getByText("Sample")).toBeInTheDocument();
  });

  test("hides Open for an unsafe source URL", () => {
    card(sampleDocument({ sourceUrl: "javascript:alert(1)" }));
    expect(screen.queryByRole("link", { name: "Open ↗" })).toBeNull();
  });

  test("star reflects state and does not open the card", async () => {
    const { onOpen, onStar } = card(sampleDocument({ starred: true }));
    const star = screen.getByRole("button", { name: "Unstar" });
    expect(star).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(star);
    expect(onStar).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  test("clicking the card body opens it; clicking Open ↗ does not", async () => {
    const { onOpen } = card(sampleDocument({ id: "c1", excerpt: "Body text" }));
    await userEvent.click(screen.getByText("Body text"));
    expect(onOpen).toHaveBeenCalledWith("c1");
    onOpen.mockClear();
    await userEvent.click(screen.getByRole("link", { name: "Open ↗" }));
    expect(onOpen).not.toHaveBeenCalled();
  });
});

describe("post card", () => {
  const card = (doc: SavedDocument, onOpen = vi.fn(), onStar = vi.fn()) => {
    render(<PostCard doc={doc} assets={new Map()} onOpen={onOpen} onStar={onStar} />);
    return { onOpen, onStar };
  };
  const thread = (over: Partial<SavedDocument> = {}) => sampleDocument({ kind: "thread", capturedAt, ...over });

  test("the name is the post author, then the document author, then the site, then the host", () => {
    const withSection = thread({ sections: [section("1", [text("hi")], { author: "Section Author" })] });
    const { unmount } = render(<PostCard doc={withSection} assets={new Map()} onOpen={noop} onStar={noop} />);
    expect(screen.getByText("Section Author")).toBeInTheDocument();
    unmount();

    const { unmount: unmount2 } = render(<PostCard doc={thread({ author: "Doc Author" })} assets={new Map()} onOpen={noop} onStar={noop} />);
    expect(screen.getByText("Doc Author")).toBeInTheDocument();
    unmount2();

    const { unmount: unmount3 } = render(<PostCard doc={thread({ author: "", siteName: "Example Site" })} assets={new Map()} onOpen={noop} onStar={noop} />);
    expect(screen.getByText("Example Site")).toBeInTheDocument();
    unmount3();

    render(<PostCard doc={thread({ author: "", siteName: "", sourceUrl: "https://www.example.org/a" })} assets={new Map()} onOpen={noop} onStar={noop} />);
    expect(screen.getByText("example.org")).toBeInTheDocument();
  });

  test("shows the handle with @ when the post has one", () => {
    card(thread({ sections: [section("1", [text("hi")], { author: "Ada", handle: "ada" })] }));
    expect(screen.getByText("@ada")).toBeInTheDocument();
  });

  test("dates show the publish date and the saved date", () => {
    card(thread({ publishedAt: "2026-08-15T12:00:00.000Z" }));
    expect(screen.getByText("Aug 15, 2026 · Saved Sep 1, 2026")).toBeInTheDocument();
  });

  test("a post's own publish date wins over the document's", () => {
    card(thread({ publishedAt: "2026-08-15T12:00:00.000Z", sections: [section("1", [text("hi")], { publishedAt: "2026-07-04T12:00:00.000Z" })] }));
    expect(screen.getByText("Jul 4, 2026 · Saved Sep 1, 2026")).toBeInTheDocument();
  });

  test("with no publish date the saved date is shown twice", () => {
    card(thread());
    expect(screen.getByText("Sep 1, 2026 · Saved Sep 1, 2026")).toBeInTheDocument();
  });

  test("counts only included posts, singular and plural", () => {
    const { unmount } = render(<PostCard doc={thread({ sections: [section("1", [text("a")]), section("2", [text("b")], { excluded: true })] })} assets={new Map()} onOpen={noop} onStar={noop} />);
    expect(screen.getByText("Thread · 1 post")).toBeInTheDocument();
    unmount();
    render(<PostCard doc={thread({ sections: [section("1", [text("a")]), section("2", [text("b")])] })} assets={new Map()} onOpen={noop} onStar={noop} />);
    expect(screen.getByText("Thread · 2 posts")).toBeInTheDocument();
  });

  test("a short post has no Show full post button; a long one opens the reader from it", async () => {
    const { unmount } = render(<PostCard doc={thread({ sections: [section("1", [text("short")])] })} assets={new Map()} onOpen={noop} onStar={noop} />);
    expect(screen.queryByRole("button", { name: "Show full post" })).toBeNull();
    unmount();

    const onOpen = vi.fn();
    card(thread({ id: "long-1", sections: [section("1", [text("w ".repeat(150))])] }), onOpen);
    await userEvent.click(screen.getByRole("button", { name: "Show full post" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith("long-1");
  });

  test("counts images that are not saved", () => {
    card(thread({ sections: [section("1", [text("a"), image("x"), image("y")])] }));
    expect(screen.getByText("2 images not saved")).toBeInTheDocument();
  });

  test("marks samples and star does not open the card", async () => {
    const { onOpen, onStar } = card(thread({ tags: ["Sample"] }));
    expect(screen.getByText("Sample")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Star" }));
    expect(onStar).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });
});

describe("list row", () => {
  test("shows the author and saved date, falling back to site then host", () => {
    const { unmount } = render(<ListRow doc={sampleDocument({ author: "Ada", capturedAt })} assets={new Map()} onOpen={noop} onStar={noop} />);
    expect(screen.getByText("Ada · Saved Sep 1, 2026")).toBeInTheDocument();
    unmount();
    const { unmount: unmount2 } = render(<ListRow doc={sampleDocument({ author: "", siteName: "Craft", capturedAt })} assets={new Map()} onOpen={noop} onStar={noop} />);
    expect(screen.getByText("Craft · Saved Sep 1, 2026")).toBeInTheDocument();
    unmount2();
    render(<ListRow doc={sampleDocument({ author: "", siteName: "", sourceUrl: "https://www.e.org/a", capturedAt })} assets={new Map()} onOpen={noop} onStar={noop} />);
    expect(screen.getByText("e.org · Saved Sep 1, 2026")).toBeInTheDocument();
  });

  test("marks samples, reflects starred state and star does not open the row", async () => {
    const onOpen = vi.fn();
    const onStar = vi.fn();
    render(<ListRow doc={sampleDocument({ tags: ["Sample"], starred: true })} assets={new Map()} onOpen={onOpen} onStar={onStar} />);
    expect(screen.getByText("Sample")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Unstar" }));
    expect(onStar).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  test("clicking the row body opens it", async () => {
    const onOpen = vi.fn();
    render(<ListRow doc={sampleDocument({ id: "row-9", author: "Ada" })} assets={new Map()} onOpen={onOpen} onStar={noop} />);
    await userEvent.click(screen.getByText(/Ada · Saved/));
    expect(onOpen).toHaveBeenCalledWith("row-9");
  });
});
