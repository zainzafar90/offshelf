import type { Block, SavedDocument } from "../../core/model";

const UNCLAMPED_TYPES = new Set(["image", "quote", "embed"]);
const LONG_TEXT_CHARS = 220;

export function coverAssetId(doc: SavedDocument): string | undefined {
  for (const section of doc.sections) {
    if (section.excluded) continue;

    for (const block of section.blocks) if (block.type === "image") return block.assetId;
  }

  return undefined;
}

/* Only text clamps; images and quotes render in full. */
export function splitBlocks(blocks: Block[]): { text: Block[]; media: Block[] } {
  const text: Block[] = [];
  const media: Block[] = [];

  for (const block of blocks) (UNCLAMPED_TYPES.has(block.type) ? media : text).push(block);

  return { text, media };
}

export function isLongText(length: number): boolean {
  return length > LONG_TEXT_CHARS;
}

export function unsavedImagesLabel(total: number, saved: number): string | undefined {
  const missing = total - saved;

  if (missing <= 0) return undefined;

  return `${missing} ${missing === 1 ? "image" : "images"} not saved`;
}
