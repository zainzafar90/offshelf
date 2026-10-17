import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Asset } from "../../src/core/model";
import { ArticleCard } from "../../src/surfaces/library/article-card";
import { sampleDocument } from "../helpers/fixtures";

const noop = () => {};

test("the title link has the reading href, opens on a plain click and on Enter", async () => {
  const onOpen = vi.fn();
  const doc = sampleDocument({ id: "art-1", title: "A slow read" });
  render(<ArticleCard doc={doc} assets={new Map()} onOpen={onOpen} onStar={noop} />);
  const link = screen.getByRole("link", { name: "A slow read" });
  expect(link).toHaveAttribute("href", "?id=art-1");

  await userEvent.click(link);
  expect(onOpen).toHaveBeenCalledWith("art-1");

  onOpen.mockClear();
  link.focus();
  await userEvent.keyboard("{Enter}");
  expect(onOpen).toHaveBeenCalledWith("art-1");
});

test("revokes its cover image's object URL when the card unmounts", () => {
  URL.createObjectURL = vi.fn(() => "blob:test/1");
  URL.revokeObjectURL = vi.fn();
  const saved: Asset = { id: "cover", sourceUrl: "https://e.com/a.png", alt: "A", status: "saved", blob: new Blob(["x"], { type: "image/png" }), bytes: 1, attempts: 0, updatedAt: "" };
  const doc = sampleDocument({ sections: [{ id: "s", sourceUrl: "https://example.com/post", blocks: [{ type: "image", assetId: "cover", alt: "Cover" }] }] });
  const { unmount } = render(<ArticleCard doc={doc} assets={new Map([["cover", saved]])} onOpen={noop} onStar={noop} />);
  unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test/1");
});
