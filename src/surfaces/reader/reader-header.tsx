import type { Asset, SavedDocument } from "../../core/model";
import { dateLabel } from "../../core/format";
import { hostname } from "../../core/url";
import { readerByline } from "../../features/reader/reader-document";
import { Avatar } from "../shared/avatar";
import type { UrlFor } from "./blocks/block-view";

type ReaderHeaderProps = { doc: SavedDocument; assets: Map<string, Asset>; urlFor: UrlFor };

export function ReaderHeader({ doc, assets, urlFor }: ReaderHeaderProps) {
  const { author, handle, site, avatarAssetId } = readerByline(doc);
  const isThread = doc.kind === "thread";

  return (
    <>
      <div className="mb-[22px] flex items-center gap-2.5">
        <Avatar name={author || doc.siteName || hostname(doc.sourceUrl)} src={urlFor(avatarAssetId ? assets.get(avatarAssetId) : undefined)} size={28} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12.5px] font-semibold text-foreground">
            {author}
            {handle && <span className="ml-1.5 font-normal text-muted-foreground">{handle}</span>}
            {site && <span className="ml-1.5 font-normal text-muted-foreground">{site}</span>}
          </div>
          <div className="truncate text-[11.5px] text-muted-foreground">
            {!isThread && `${doc.readingMinutes} min read · `}Saved {dateLabel(doc.capturedAt)}
          </div>
        </div>
      </div>
      {!isThread && (
        <h1 className="m-0 mb-3.5 font-serif text-[44px] leading-[1.04] tracking-[-0.2px] text-foreground">{doc.title}</h1>
      )}
    </>
  );
}
