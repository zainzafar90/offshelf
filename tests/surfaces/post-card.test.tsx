import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Asset, Block } from "../../src/core/model";
import { PostCard } from "../../src/surfaces/library/post-card";
import { sampleDocument } from "../helpers/fixtures";

const noop = () => {};

function longParagraphs(count: number): Block[] {
  return Array.from({ length: count }, (_, i): Block => ({
    type: "paragraph",
    content: [{ text: `Paragraph number ${i} has enough words in it to push the total text well past the two hundred and twenty character clamp threshold used by the card.` }],
  }));
}

test("a long post's image renders outside the clamped text container", () => {
  const blocks: Block[] = [...longParagraphs(3), { type: "image", assetId: "missing", alt: "A saved photo" }];
  const doc = sampleDocument({ kind: "thread", sections: [{ id: "s", sourceUrl: "https://example.com/post", blocks }] });
  const { container } = render(<PostCard doc={doc} assets={new Map()} onOpen={noop} onStar={noop} />);
  const clamped = container.querySelector(".line-clamp-7");
  expect(clamped).not.toBeNull();
  expect(clamped?.querySelector("[data-missing-image]")).toBeNull();
  expect(container.querySelector("[data-missing-image]")).not.toBeNull();
});

test("thread completeness note matches the vanilla copy per state", () => {
  const base = sampleDocument({ kind: "thread" });
  const { rerender } = render(<PostCard doc={{ ...base, completeness: "partial" }} assets={new Map()} onOpen={noop} onStar={noop} />);
  expect(screen.getByText("Partial thread · review in reader")).toBeInTheDocument();

  rerender(<PostCard doc={{ ...base, completeness: "unverified" }} assets={new Map()} onOpen={noop} onStar={noop} />);
  expect(screen.getByText("Thread completeness unverified")).toBeInTheDocument();

  rerender(<PostCard doc={{ ...base, completeness: "page-snapshot" }} assets={new Map()} onOpen={noop} onStar={noop} />);
  expect(screen.queryByText(/Partial thread|Thread completeness/)).toBeNull();
});

test("revokes its own object URL when the card unmounts", () => {
  URL.createObjectURL = vi.fn(() => "blob:test/1");
  URL.revokeObjectURL = vi.fn();
  const saved: Asset = { id: "img", sourceUrl: "https://e.com/a.png", alt: "A", status: "saved", blob: new Blob(["x"], { type: "image/png" }), bytes: 1, attempts: 0, updatedAt: "" };
  const doc = sampleDocument({ kind: "thread", sections: [{ id: "s", sourceUrl: "https://example.com/post", blocks: [{ type: "image", assetId: "img", alt: "A cat" }] }] });
  const { unmount } = render(<PostCard doc={doc} assets={new Map([["img", saved]])} onOpen={noop} onStar={noop} />);
  unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test/1");
});

test("renders its excerpt when there are no preview blocks", () => {
  const doc = sampleDocument({ kind: "thread", excerpt: "Fallback excerpt text.", sections: [{ id: "s", sourceUrl: "https://example.com/post", blocks: [] }] });
  render(<PostCard doc={doc} assets={new Map()} onOpen={noop} onStar={noop} />);
  expect(screen.getByText("Fallback excerpt text.")).toBeInTheDocument();
});

test("the Read thread link has the reading href and opens on a plain click", async () => {
  const onOpen = vi.fn();
  const doc = sampleDocument({ id: "th-1", kind: "thread" });
  render(<PostCard doc={doc} assets={new Map()} onOpen={onOpen} onStar={noop} />);
  const link = screen.getByRole("link", { name: "Read thread" });
  expect(link).toHaveAttribute("href", "?id=th-1");

  await userEvent.click(link);
  expect(onOpen).toHaveBeenCalledWith("th-1");
});

test("Enter on the focused Read thread link opens it", async () => {
  const onOpen = vi.fn();
  const doc = sampleDocument({ id: "th-2", kind: "thread" });
  render(<PostCard doc={doc} assets={new Map()} onOpen={onOpen} onStar={noop} />);
  const link = screen.getByRole("link", { name: "Read thread" });
  link.focus();
  expect(link).toHaveFocus();
  await userEvent.keyboard("{Enter}");
  expect(onOpen).toHaveBeenCalledWith("th-2");
});

test("an unfinished save is called out on the card", () => {
  const doc = sampleDocument({ kind: "thread", warnings: [{ code: "interrupted", message: "Capture stopped before completion: The selected post was not found." }] });
  render(<PostCard doc={doc} assets={new Map()} onOpen={noop} onStar={noop} />);
  expect(screen.getByText("Save didn't finish")).toBeInTheDocument();
});

test("shows the saved author avatar instead of initials", () => {
  URL.createObjectURL = vi.fn(() => "blob:test/avatar");
  URL.revokeObjectURL = vi.fn();
  const base = sampleDocument({ kind: "thread", assetIds: ["avatar"] });
  const doc = { ...base, sections: [{ ...base.sections[0], avatarAssetId: "avatar" }] };
  const avatar: Asset = { id: "avatar", sourceUrl: "https://pbs.twimg.com/profile_images/1/me_bigger.jpg", alt: "", status: "saved", blob: new Blob(["x"]), bytes: 1, attempts: 1, updatedAt: "2026-09-27T00:00:00.000Z" };
  const { container } = render(<PostCard doc={doc} assets={new Map([["avatar", avatar]])} onOpen={noop} onStar={noop} />);
  expect(container.querySelector('img[src="blob:test/avatar"]')).not.toBeNull();
});

test("a post shows at most four images and counts the rest", () => {
  URL.createObjectURL = vi.fn(() => "blob:test/image");
  URL.revokeObjectURL = vi.fn();
  const ids = ["i1", "i2", "i3", "i4", "i5", "i6"];
  const assets = new Map(ids.map((id): [string, Asset] => [id, { id, sourceUrl: `https://pbs.twimg.com/media/${id}.jpg`, alt: "", status: "saved", blob: new Blob(["x"]), bytes: 1, attempts: 1, updatedAt: "" }]));
  const blocks: Block[] = [{ type: "paragraph", content: [{ text: "Six screenshots" }] }, ...ids.map((id): Block => ({ type: "image", assetId: id, alt: "" }))];
  const doc = sampleDocument({ kind: "thread", assetIds: ids, sections: [{ id: "s", sourceUrl: "https://x.com/a/status/1", blocks }] });
  const { container } = render(<PostCard doc={doc} assets={assets} onOpen={noop} onStar={noop} />);
  expect(container.querySelectorAll("img")).toHaveLength(4);
  expect(screen.getByText("+2")).toBeInTheDocument();
});
