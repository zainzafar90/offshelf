import type { ElementType } from "react";
import type { Asset, Block, QuoteCite } from "../../../core/model";
import { cn } from "../../../lib/utils";
import { Avatar } from "../../shared/avatar";
import { InlineView } from "./inline-view";
import { EmbedBlockView, ImageBlockView } from "./media-blocks";

export type BlockViewVariant = "reader" | "card";

export type UrlFor = (asset: Asset | undefined) => string | undefined;

/* Card: fixed px, serif. Reader: em, inherits font. */
const CARD_HEADING_SIZE: Record<number, string> = { 1: "text-[28px]", 2: "text-[26px]", 3: "text-[23px]" };
const READER_HEADING_SIZE: Record<number, string> = { 1: "text-[1.5em]", 2: "text-[1.4em]", 3: "text-[1.25em]" };

function headingSize(level: number, variant: BlockViewVariant): string {
  if (variant === "card") return CARD_HEADING_SIZE[level] ?? "text-[19px]";

  return READER_HEADING_SIZE[level] ?? "text-[1.05em]";
}

type BlockViewProps = {
  blocks: Block[];
  assets: Map<string, Asset>;
  urlFor: UrlFor;
  variant?: BlockViewVariant;
};

export function BlockView({ blocks, assets, urlFor, variant = "reader" }: BlockViewProps) {
  return (
    <div className={cn(
      /* Reader inherits font from data-reader-prose. */
      variant === "card" ? "font-sans text-[13px] leading-[1.55]" : "leading-[1.7]",
      "text-foreground",
    )}>
      {renderBlocks(blocks, assets, urlFor, variant)}
    </div>
  );
}

function renderBlocks(blocks: Block[], assets: Map<string, Asset>, urlFor: UrlFor, variant: BlockViewVariant) {
  return blocks.map((block, index) => (
    <BlockNode key={index} block={block} assets={assets} urlFor={urlFor} variant={variant} />
  ));
}

function BlockNode({ block, assets, urlFor, variant }: { block: Block; assets: Map<string, Asset>; urlFor: UrlFor; variant: BlockViewVariant }) {
  switch (block.type) {
    case "paragraph":
      return <p className="mb-[1.05em]"><InlineView content={block.content} /></p>;

    case "heading": {
      const Tag = `h${block.level}` as ElementType;
      const size = headingSize(block.level, variant);

      return (
        <Tag id={block.anchor} className={cn("mb-[0.5em] mt-[1.5em] font-medium leading-[1.3] first:mt-0", variant === "card" && "font-serif", size)}>
          <InlineView content={block.content} />
        </Tag>
      );
    }

    case "image":
      return <ImageBlockView block={block} assets={assets} urlFor={urlFor} variant={variant} />;
    case "quote":
      return (
        <blockquote className="my-6 border-l-2 border-border-strong pl-6 italic text-secondary">
          {block.cite && <QuoteCiteView cite={block.cite} src={urlFor(block.cite.avatarAssetId ? assets.get(block.cite.avatarAssetId) : undefined)} />}
          {renderBlocks(block.blocks, assets, urlFor, variant)}
        </blockquote>
      );

    case "list": {
      const items = block.items.map((item, index) => <li key={index}>{renderBlocks(item, assets, urlFor, variant)}</li>);

      return block.ordered
        ? <ol start={block.start} className="my-[1.05em] list-decimal pl-6">{items}</ol>
        : <ul className="my-[1.05em] list-disc pl-6">{items}</ul>;
    }

    case "code":
      return (
        <div className="my-6">
          {block.language && <div className="mb-1 font-sans text-[11px] uppercase text-muted-foreground">{block.language}</div>}
          <pre className="overflow-auto rounded-[8px] bg-muted p-4">
            <code className="font-mono text-[13px]">{block.text}</code>
          </pre>
        </div>
      );
    case "table":
      return (
        <div className="my-6 overflow-x-auto">
          <table className="w-full border-collapse">
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => {
                    const Cell = block.header && rowIndex === 0 ? "th" : "td";

                    return <Cell key={cellIndex} className="border border-border p-2 text-left"><InlineView content={cell} /></Cell>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "embed":
      return <EmbedBlockView block={block} assets={assets} urlFor={urlFor} />;
    case "rule":
      return <hr className="my-6 border-border" />;
  }
}

function QuoteCiteView({ cite, src }: { cite: QuoteCite; src?: string }) {
  return (
    <div className="mb-2 flex items-center gap-2 font-sans text-[12.5px] not-italic">
      <Avatar name={cite.author} src={src} size={20} />
      <span className="truncate font-semibold text-foreground">{cite.author}</span>
      {cite.handle && <span className="truncate text-muted-foreground">@{cite.handle}</span>}
    </div>
  );
}
