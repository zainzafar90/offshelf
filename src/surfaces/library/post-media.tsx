import { useState } from "react";
import type { Asset, Block } from "../../core/model";
import { cn } from "../../lib/utils";
import type { UrlFor } from "../reader/blocks/block-view";
import { BlockView } from "../reader/blocks/block-view";

type ImageBlock = Extract<Block, { type: "image" }>;

type PostMediaProps = { blocks: Block[]; assets: Map<string, Asset>; urlFor: UrlFor };

const MAX_TILES = 4;

type TileShape = "single" | "lead" | "square";

function tileShape(count: number, index: number): TileShape {
  if (count === 1) return "single";

  if (count === 3 && index === 0) return "lead";

  return "square";
}

export function PostMedia({ blocks, assets, urlFor }: PostMediaProps) {
  const images = blocks.filter((block): block is ImageBlock => block.type === "image");
  const others = blocks.filter(block => block.type !== "image");
  const tiles = images.slice(0, MAX_TILES);
  const hidden = images.length - tiles.length;

  return (
    <>
      {tiles.length > 0 && (
        <div className={cn("mt-2.5 grid gap-1 overflow-hidden rounded-[8px]", tiles.length > 1 && "grid-cols-2")}>
          {tiles.map((block, index) => (
            <MediaTile
              key={index}
              block={block}
              src={urlFor(assets.get(block.assetId))}
              shape={tileShape(tiles.length, index)}
              hidden={index === tiles.length - 1 ? hidden : 0}
            />
          ))}
        </div>
      )}
      {others.length > 0 && (
        <div className="mt-2.5">
          <BlockView blocks={others} assets={assets} urlFor={urlFor} variant="card" />
        </div>
      )}
    </>
  );
}

type MediaTileProps = { block: ImageBlock; src?: string; shape: TileShape; hidden: number };

function MediaTile({ block, src, shape, hidden }: MediaTileProps) {
  const [broken, setBroken] = useState(false);

  return (
    <div className={cn("relative overflow-hidden bg-muted", shape === "square" && "aspect-square", shape === "lead" && "row-span-2")}>
      {src && !broken ? (
        <img
          src={src}
          alt={block.alt}
          loading="lazy"
          decoding="async"
          onError={() => setBroken(true)}
          className={cn("w-full object-cover", shape === "single" ? "max-h-[340px]" : "h-full")}
        />
      ) : (
        <div data-missing-image className="grid h-full min-h-20 place-items-center p-3 text-center text-[11.5px] text-muted-foreground">
          {broken ? "Image could not be shown" : block.alt || "Image not saved"}
        </div>
      )}
      {hidden > 0 && (
        <div className="absolute inset-0 grid place-items-center bg-primary/55 text-[15px] font-semibold text-primary-foreground">+{hidden}</div>
      )}
    </div>
  );
}
