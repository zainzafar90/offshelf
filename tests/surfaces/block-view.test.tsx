import { fireEvent, render, screen } from "@testing-library/react";
import { BlockView } from "../../src/surfaces/reader/blocks/block-view";
import { useObjectUrls } from "../../src/surfaces/reader/blocks/use-object-urls";
import type { Asset, Block } from "../../src/core/model";

const saved: Asset = { id: "img", sourceUrl: "https://e.com/a.png", alt: "A", status: "saved", blob: new Blob(["x"], { type: "image/png" }), bytes: 1, attempts: 0, updatedAt: "" };
const failed: Asset = { ...saved, id: "bad", status: "failed", blob: undefined, error: "Host refused" };

function Harness({ blocks, assets }: { blocks: Block[]; assets: Map<string, Asset> }) {
  const urlFor = useObjectUrls();
  return <BlockView blocks={blocks} assets={assets} urlFor={urlFor} variant="reader" />;
}

beforeEach(() => {
  let n = 0;
  URL.createObjectURL = vi.fn(() => `blob:test/${++n}`);
  URL.revokeObjectURL = vi.fn();
});

test("drops unsafe links and keeps safe ones", () => {
  render(<Harness assets={new Map()} blocks={[{ type: "paragraph", content: [{ text: "ok", href: "https://e.com" }, { text: "bad", href: "javascript:alert(1)" }] }]} />);
  expect(screen.getByRole("link", { name: "ok" })).toHaveAttribute("rel", "noopener noreferrer");
  expect(screen.queryByRole("link", { name: "bad" })).toBeNull();
});

test("saved image renders, failed image shows the placeholder with its error", () => {
  render(<Harness assets={new Map([["img", saved], ["bad", failed]])} blocks={[{ type: "image", assetId: "img", alt: "A cat" }, { type: "image", assetId: "bad", alt: "A dog" }]} />);
  expect(screen.getByRole("img", { name: "A cat" })).toHaveAttribute("src", "blob:test/1");
  expect(screen.getByText("Host refused")).toBeInTheDocument();
  expect(screen.queryByRole("img", { name: "A dog" })).toBeNull();
});

test("headings keep anchors, lists keep start, tables use th for header", () => {
  const { container } = render(<Harness assets={new Map()} blocks={[
    { type: "heading", level: 2, anchor: "intro", content: [{ text: "Intro" }] },
    { type: "list", ordered: true, start: 3, items: [[{ type: "paragraph", content: [{ text: "c" }] }]] },
    { type: "table", header: true, rows: [[[{ text: "H" }]], [[{ text: "v" }]]] },
  ]} />);
  expect(container.querySelector("h2#intro")).not.toBeNull();
  expect(container.querySelector("ol")?.getAttribute("start")).toBe("3");
  expect(container.querySelector("th")?.textContent).toBe("H");
});

test("failing to decode a saved image shows the decode placeholder with no alt label", () => {
  render(<Harness assets={new Map([["img", saved]])} blocks={[{ type: "image", assetId: "img", alt: "A cat" }]} />);
  const image = screen.getByRole("img", { name: "A cat" });
  fireEvent.error(image);
  expect(screen.getByText("This image could not be decoded. Its source may use an unsupported format.")).toBeInTheDocument();
  expect(screen.queryByText("A cat")).toBeNull();
  expect(document.querySelector("[data-missing-image]")).not.toBeNull();
});

test("revokes urls on unmount", () => {
  const { unmount } = render(<Harness assets={new Map([["img", saved]])} blocks={[{ type: "image", assetId: "img", alt: "A cat" }]} />);
  unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test/1");
});

test("a quoted post shows its author, handle and saved picture", () => {
  const avatar: Asset = { ...saved, id: "q-avatar" };
  const blocks: Block[] = [{ type: "quote", cite: { author: "Other Person", handle: "other", avatarAssetId: "q-avatar" }, blocks: [{ type: "paragraph", content: [{ text: "Quoted words" }] }] }];
  const { container } = render(<Harness blocks={blocks} assets={new Map([["q-avatar", avatar]])} />);
  expect(screen.getByText("Other Person")).toBeInTheDocument();
  expect(screen.getByText("@other")).toBeInTheDocument();
  expect(container.querySelector("blockquote img")).not.toBeNull();
});
