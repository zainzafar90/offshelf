import { Star } from "lucide-react";
import { SaveProblemNote } from "./save-problem-note";
import type { Asset, SavedDocument } from "../../core/model";
import { blocksText } from "../../core/document-text";
import { dateLabel } from "../../core/format";
import { hostname, safeUrl } from "../../core/url";
import { isLongText, splitBlocks, unsavedImagesLabel } from "../../features/library/card-content";
import { mediaCounts } from "../../features/library/media-counts";
import { previewBlocks } from "../../features/library/preview-blocks";
import { readerUrl } from "../../features/library/reader-route";
import { includedPostCount } from "../../features/reader/reader-document";
import { cn } from "../../lib/utils";
import { Button } from "../../ui/button";
import { BlockView } from "../reader/blocks/block-view";
import { useObjectUrls } from "../reader/blocks/use-object-urls";
import { Avatar } from "../shared/avatar";
import { cardClick, openLinkClick } from "./open-link";
import { PostMedia } from "./post-media";

export type CardProps = {
  doc: SavedDocument;
  assets: Map<string, Asset>;
  onOpen: (id: string) => void;
  onStar: (doc: SavedDocument) => void;
};

const THREAD_NOTE: Partial<Record<SavedDocument["completeness"], string>> = {
  partial: "Partial thread · review in reader",
  unverified: "Thread completeness unverified",
};

export function PostCard({ doc, assets, onOpen, onStar }: CardProps) {
  const urlFor = useObjectUrls();
  const section = doc.sections.find(s => !s.excluded);
  const name = section?.author || doc.author || doc.siteName || hostname(doc.sourceUrl);
  const handle = section?.handle ? `@${section.handle}` : undefined;
  const { text, media } = splitBlocks(previewBlocks(doc));
  const long = isLongText(blocksText(text).length);
  const { total, saved } = mediaCounts(doc, assets);
  const postCount = includedPostCount(doc);
  const sourceHref = safeUrl(doc.sourceUrl);
  const threadNote = THREAD_NOTE[doc.completeness];
  const readingHref = readerUrl(doc.id);
  const unsavedLabel = unsavedImagesLabel(total, saved);
  const showExcerpt = text.length === 0 && media.length === 0;

  return (
    <article
      aria-label={doc.title}
      onClick={e => cardClick(e, () => onOpen(doc.id))}
      className="cursor-pointer rounded-[10px] border border-border bg-card p-[13px] transition-colors hover:border-border-strong"
    >
      <div className="flex items-start gap-2.5">
        <Avatar name={name} src={urlFor(section?.avatarAssetId ? assets.get(section.avatarAssetId) : undefined)} size={28} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12.5px] font-semibold text-foreground">
            {name}
            {handle && <span className="ml-1.5 font-normal text-muted-foreground">{handle}</span>}
          </div>
          <div className="truncate text-[11.5px] text-muted-foreground">
            {dateLabel(section?.publishedAt || doc.publishedAt || doc.capturedAt)} · Saved {dateLabel(doc.capturedAt)}
          </div>
        </div>
        {sourceHref && (
          <a href={sourceHref} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="shrink-0 text-[11.5px] text-link">
            Open ↗
          </a>
        )}
      </div>
      {text.length > 0 && (
        <div className={cn("mt-2.5", long && "line-clamp-7 overflow-hidden")}>
          <BlockView blocks={text} assets={assets} urlFor={urlFor} variant="card" />
        </div>
      )}
      {showExcerpt && <p className="mt-2.5 text-[13px] leading-[1.55] text-foreground">{doc.excerpt}</p>}
      {long && (
        <button type="button" onClick={e => { e.stopPropagation(); onOpen(doc.id); }} className="mt-1.5 inline-block text-[12px] text-link hover:underline">
          Show full post
        </button>
      )}
      {media.length > 0 && <PostMedia blocks={media} assets={assets} urlFor={urlFor} />}
      <div className="mt-2.5 flex items-center gap-2 text-[11.5px] text-muted-foreground">
        <span>Thread · {postCount} {postCount === 1 ? "post" : "posts"}</span>
        <a href={readingHref} onClick={e => openLinkClick(e, () => onOpen(doc.id))} className="text-link hover:underline">
          Read thread
        </a>
        {doc.tags.includes("Sample") && <span>Sample</span>}
        <Button
          variant="ghost"
          size="icon"
          aria-pressed={doc.starred}
          aria-label={doc.starred ? "Unstar" : "Star"}
          onClick={e => { e.stopPropagation(); onStar(doc); }}
          className="ml-auto"
        >
          <Star className="size-[15px]" fill={doc.starred ? "currentColor" : "none"} aria-hidden />
        </Button>
      </div>
      {unsavedLabel && <div className="mt-1.5 text-[11.5px] text-muted-foreground">{unsavedLabel}</div>}
      {threadNote && <div className="mt-1.5 text-[11.5px] text-muted-foreground">{threadNote}</div>}
      <SaveProblemNote doc={doc} />
    </article>
  );
}
