import { Star } from "lucide-react";
import { SaveProblemNote } from "./save-problem-note";
import { dateLabel } from "../../core/format";
import { hostname, safeUrl } from "../../core/url";
import { coverAssetId, unsavedImagesLabel } from "../../features/library/card-content";
import { mediaCounts } from "../../features/library/media-counts";
import { readerUrl } from "../../features/library/reader-route";
import { Button } from "../../ui/button";
import { useObjectUrls } from "../reader/blocks/use-object-urls";
import { cardClick, openLinkClick } from "./open-link";
import type { CardProps } from "./post-card";

export function ArticleCard({ doc, assets, onOpen, onStar }: CardProps) {
  const urlFor = useObjectUrls();
  const site = doc.siteName || hostname(doc.sourceUrl);
  const cover = urlFor(assets.get(coverAssetId(doc) ?? ""));
  const { total, saved } = mediaCounts(doc, assets);
  const sourceHref = safeUrl(doc.sourceUrl);
  const progress = Math.round(doc.progress * 100);
  const readingHref = readerUrl(doc.id);
  const unsavedLabel = unsavedImagesLabel(total, saved);

  return (
    <article
      aria-label={doc.title}
      onClick={e => cardClick(e, () => onOpen(doc.id))}
      className="cursor-pointer overflow-hidden rounded-[10px] border border-border bg-card transition-colors hover:border-border-strong"
    >
      {cover && (
        <div className="aspect-video bg-muted">
          <img src={cover} alt="" className="h-full w-full object-cover" loading="lazy" />
        </div>
      )}
      <div className="p-[13px]">
        <div className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
          <span className="grid size-4 shrink-0 place-items-center rounded bg-muted-hover text-[9px] font-semibold text-foreground">{site[0]?.toUpperCase()}</span>
          <span className="truncate">{site} · {doc.readingMinutes} min read</span>
          {sourceHref && (
            <a href={sourceHref} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="ml-auto shrink-0 text-link">
              Open ↗
            </a>
          )}
        </div>
        <h3 className="mt-2.5 mb-1.5 font-serif text-[22px] leading-[1.12]">
          <a href={readingHref} onClick={e => openLinkClick(e, () => onOpen(doc.id))} className="text-foreground hover:underline">
            {doc.title}
          </a>
        </h3>
        <p className="line-clamp-3 text-[12.5px] text-secondary">{doc.excerpt}</p>
        <div className="mt-2.5 flex items-center gap-2 text-[11.5px] text-muted-foreground">
          <span className="truncate">{doc.author} · Saved {dateLabel(doc.capturedAt)}</span>
          {doc.progress > 0 && (
            <span className="flex shrink-0 items-center gap-1.5">
              <span className="h-0.5 w-16 overflow-hidden rounded-full bg-muted">
                <span className="block h-full bg-accent" style={{ width: `${progress}%` }} />
              </span>
              {progress}%
            </span>
          )}
          {doc.tags.includes("Sample") && <span className="shrink-0">Sample</span>}
          <Button
            variant="ghost"
            size="icon"
            aria-pressed={doc.starred}
            aria-label={doc.starred ? "Unstar" : "Star"}
            onClick={e => { e.stopPropagation(); onStar(doc); }}
            className="ml-auto shrink-0"
          >
            <Star className="size-[15px]" fill={doc.starred ? "currentColor" : "none"} aria-hidden />
          </Button>
        </div>
        {unsavedLabel && <div className="mt-1.5 text-[11.5px] text-muted-foreground">{unsavedLabel}</div>}
      </div>
      <SaveProblemNote doc={doc} />
    </article>
  );
}
