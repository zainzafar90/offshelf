import { Star } from "lucide-react";
import type { Asset, SavedDocument } from "../../core/model";
import { dateLabel } from "../../core/format";
import { hostname } from "../../core/url";
import { Button } from "../../ui/button";
import { useObjectUrls } from "../reader/blocks/use-object-urls";
import { Avatar } from "../shared/avatar";
import { cardClick, openLinkClick } from "./open-link";

type ListRowProps = {
  doc: SavedDocument;
  assets: Map<string, Asset>;
  onOpen: (id: string) => void;
  onStar: (doc: SavedDocument) => void;
};

export function ListRow({ doc, assets, onOpen, onStar }: ListRowProps) {
  const urlFor = useObjectUrls();
  const avatarId = doc.sections.find(s => !s.excluded)?.avatarAssetId;
  const name = doc.author || doc.siteName || hostname(doc.sourceUrl);
  const readingHref = `?id=${encodeURIComponent(doc.id)}`;

  return (
    <article
      aria-label={doc.title}
      onClick={e => cardClick(e, () => onOpen(doc.id))}
      className="flex cursor-pointer items-center gap-3 rounded-[8px] border border-border bg-card px-3 py-2 hover:border-border-strong"
    >
      <Avatar name={name} src={urlFor(avatarId ? assets.get(avatarId) : undefined)} size={22} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12.5px] font-medium text-foreground">
          <a href={readingHref} onClick={e => openLinkClick(e, () => onOpen(doc.id))} className="text-foreground hover:underline">
            {doc.title}
          </a>
        </div>
        <div className="truncate text-[11.5px] text-muted-foreground">{name} · Saved {dateLabel(doc.capturedAt)}</div>
      </div>
      {doc.tags.includes("Sample") && <span className="shrink-0 text-[11.5px] text-muted-foreground">Sample</span>}
      <Button
        variant="ghost"
        size="icon"
        aria-pressed={doc.starred}
        aria-label={doc.starred ? "Unstar" : "Star"}
        onClick={e => { e.stopPropagation(); onStar(doc); }}
      >
        <Star className="size-[15px]" fill={doc.starred ? "currentColor" : "none"} aria-hidden />
      </Button>
    </article>
  );
}
