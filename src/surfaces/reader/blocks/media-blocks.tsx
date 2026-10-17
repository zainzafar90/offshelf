import { useState } from "react";
import { ExternalLink, ImageOff } from "lucide-react";
import type { Asset, Block } from "../../../core/model";
import { safeUrl } from "../../../core/url";
import { cn } from "../../../lib/utils";
import type { BlockViewVariant, UrlFor } from "./block-view";

type ImageBlock = Extract<Block, { type: "image" }>;

type EmbedBlock = Extract<Block, { type: "embed" }>;

function MissingImage({ label, message }: { label?: string; message: string }) {
  return (
    <div
      data-missing-image
      className="flex flex-col items-center gap-2 rounded-[10px] bg-muted p-6 text-center text-muted-foreground"
    >
      <ImageOff className="h-6 w-6" aria-hidden />
      {label && <strong className="font-sans text-[12px] font-semibold text-foreground">{label}</strong>}
      <span className="font-sans text-[12px]">{message}</span>
    </div>
  );
}

type ImageContentProps = { block: ImageBlock; asset?: Asset; source?: string; broken: boolean; rounded: string; onBroken: () => void };

function ImageContent({ block, asset, source, broken, rounded, onBroken }: ImageContentProps) {
  if (source && !broken) {
    return <img src={source} alt={block.alt} loading="lazy" decoding="async" className={cn("w-full", rounded)} onError={onBroken} />;
  }

  if (broken) return <MissingImage message="This image could not be decoded. Its source may use an unsupported format." />;

  return <MissingImage label={block.alt || "Image not saved"} message={asset?.error || "This image is not available offline yet."} />;
}

export function ImageBlockView({
  block, assets, urlFor, variant,
}: { block: ImageBlock; assets: Map<string, Asset>; urlFor: UrlFor; variant: BlockViewVariant }) {
  const asset = assets.get(block.assetId);
  const source = urlFor(asset);
  const [broken, setBroken] = useState(false);
  const rounded = variant === "card" ? "rounded-[8px]" : "rounded-[10px]";

  return (
    <figure className={variant === "card" ? "my-3" : "my-6"}>
      <ImageContent block={block} asset={asset} source={source} broken={broken} rounded={rounded} onBroken={() => setBroken(true)} />
      {block.caption && <figcaption className="mt-2 font-sans text-[12px] text-muted-foreground">{block.caption}</figcaption>}
    </figure>
  );
}

export function EmbedBlockView({
  block, assets, urlFor,
}: { block: EmbedBlock; assets: Map<string, Asset>; urlFor: UrlFor }) {
  const url = safeUrl(block.url);

  if (!url) return null;

  const poster = block.posterAssetId ? urlFor(assets.get(block.posterAssetId)) : undefined;

  return (
    <div className="my-6 flex items-center gap-3 rounded-[10px] border border-border bg-card p-4">
      {poster && <img src={poster} alt="Video preview" className="h-[90px] w-[120px] rounded-[8px] object-cover" />}
      <a href={url} target="_blank" rel="noopener noreferrer" className="flex flex-1 items-center gap-2 text-link">
        {block.label}
        <ExternalLink className="h-4 w-4" aria-hidden />
      </a>
    </div>
  );
}
