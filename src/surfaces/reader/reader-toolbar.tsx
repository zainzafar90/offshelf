import { Archive, ArchiveRestore, ArrowLeft, CaseSensitive, Check, Focus, Star, Tag, Trash2 } from "lucide-react";
import type { Asset, SavedDocument } from "../../core/model";
import { safeUrl } from "../../core/url";
import { cn } from "../../lib/utils";
import { Button } from "../../ui/button";
import { ExportMenu } from "./export-menu";

type ReaderToolbarProps = {
  doc: SavedDocument;
  assets: Map<string, Asset>;
  focusMode: boolean;
  onToggleFocus: () => void;
  onToggleStar: () => void;
  onToggleRead: () => void;
  onToggleArchive: () => void;
  onOpenTags: () => void;
  onOpenAppearance: () => void;
  onDelete: () => void;
  onBack: () => void;
};

export function ReaderToolbar({ doc, assets, focusMode, onToggleFocus, onToggleStar, onToggleRead, onToggleArchive, onOpenTags, onOpenAppearance, onDelete, onBack }: ReaderToolbarProps) {
  const sourceHref = safeUrl(doc.sourceUrl);

  return (
    <div className="flex items-center gap-1 px-[18px] pt-3.5 pb-3">
      <Button variant="ghost" size="icon" aria-label="Back to library" onClick={onBack}>
        <ArrowLeft className="size-[15px]" aria-hidden />
      </Button>
      <span className="ml-1 text-[14px] font-semibold text-foreground">
        {doc.kind === "thread" ? `Post by ${doc.author}` : "Article"}
      </span>
      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="icon" aria-pressed={focusMode} aria-label="Focus mode" onClick={onToggleFocus}>
          <Focus className="size-[15px]" aria-hidden />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Reading appearance" onClick={onOpenAppearance}>
          <CaseSensitive className="size-[15px]" aria-hidden />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Edit tags" onClick={onOpenTags}>
          <Tag className="size-[15px]" aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-pressed={doc.starred}
          aria-label={doc.starred ? "Remove from starred" : "Star this document"}
          onClick={onToggleStar}
        >
          <Star className={cn("size-[15px]", doc.starred && "fill-current")} aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-pressed={doc.read}
          aria-label={doc.read ? "Mark unread" : "Mark as read"}
          onClick={onToggleRead}
          className={cn(doc.read && "text-foreground")}
        >
          <Check className="size-[15px]" aria-hidden />
        </Button>
        <Button variant="ghost" size="icon" aria-label={doc.archived ? "Unarchive" : "Archive"} onClick={onToggleArchive}>
          {doc.archived ? <ArchiveRestore className="size-[15px]" aria-hidden /> : <Archive className="size-[15px]" aria-hidden />}
        </Button>
        <ExportMenu doc={doc} assets={assets} />
        {sourceHref && (
          <Button variant="outline" asChild>
            <a href={sourceHref} target="_blank" rel="noopener noreferrer">Open original ↗</a>
          </Button>
        )}
        <Button variant="ghost" size="icon" aria-label="Delete saved copy" onClick={onDelete}>
          <Trash2 className="size-[15px]" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
