import { useRef, useState } from "react";
import { Check, ListChecks, Tag as TagIcon } from "lucide-react";
import type { Asset, SavedDocument, Settings } from "../../core/model";
import { saveProblem } from "../../features/library/save-problem";
import { primarySection } from "../../features/reader/reader-document";
import { cn } from "../../lib/utils";
import { Button } from "../../ui/button";
import type { ProgressPatch } from "../shared/use-library";
import { BlockView } from "./blocks/block-view";
import { useObjectUrls } from "./blocks/use-object-urls";
import { DeleteDialog } from "./delete-dialog";
import { MediaDialog } from "./media-dialog";
import { OfflineStatus } from "./offline-status";
import { ReaderHeader } from "./reader-header";
import { ReaderOutline } from "./reader-outline";
import { ReaderToolbar } from "./reader-toolbar";
import { ReviewThreadDialog } from "./review-thread-dialog";
import { SaveProblemAlert } from "./save-problem-alert";
import { TagDialog } from "./tag-dialog";
import { ThreadView } from "./thread-view";
import { useEscapeBack } from "./use-escape-back";
import { useFocusMode } from "./use-focus-mode";
import { useReadingProgress } from "./use-reading-progress";

export type ReaderViewProps = {
  doc: SavedDocument;
  assets: Map<string, Asset>;
  settings: Settings;
  crumb: string;
  onBack: () => void;
  onChanged: () => Promise<void>;
  onUpdate: (id: string, patch: Partial<SavedDocument>) => Promise<boolean>;
  onSaveProgress: (id: string, patch: ProgressPatch) => Promise<void>;
  onRemove: (id: string) => Promise<boolean>;
  onDeleted: () => void;
  onOpenAppearance: () => void;
};

export function ReaderView({ doc, assets, settings, crumb, onBack, onChanged, onUpdate, onSaveProgress, onRemove, onDeleted, onOpenAppearance }: ReaderViewProps) {
  const urlFor = useObjectUrls();
  const [focusMode, toggleFocus] = useFocusMode();
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [tagOpen, setTagOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const progress = useReadingProgress(doc.id, scroller, doc.progress, onSaveProgress);

  useEscapeBack(onBack);

  const problem = saveProblem(doc);
  const isThread = doc.kind === "thread";

  return (
    /* `contents` keeps grid rows; carries focus-mode class. */
    <div className={cn("contents", focusMode && "focus-mode")}>
      {/* Hidden, not unmounted: keeps the 1fr row. */}
      <div className={cn("flex items-center gap-1.5 px-[18px] pt-3 text-[12px] text-muted-foreground", focusMode && "hidden")}>
        <button type="button" onClick={onBack} className="hover:text-foreground">Offshelf</button>
        <span aria-hidden>›</span>
        <button type="button" onClick={onBack} className="hover:text-foreground">{crumb}</button>
        <span aria-hidden>›</span>
        <b className="truncate font-medium text-foreground">{doc.title}</b>
      </div>
      <ReaderToolbar
        doc={doc}
        assets={assets}
        focusMode={focusMode}
        onToggleFocus={toggleFocus}
        onToggleStar={() => void onUpdate(doc.id, { starred: !doc.starred })}
        onToggleRead={() => void onUpdate(doc.id, { read: !doc.read })}
        onToggleArchive={() => void onUpdate(doc.id, { archived: !doc.archived })}
        onOpenTags={() => setTagOpen(true)}
        onOpenAppearance={onOpenAppearance}
        onDelete={() => setDeleteOpen(true)}
        onBack={onBack}
      />
      <div className="h-0.5 bg-muted">
        <div className="h-full bg-accent" style={{ width: `${progress * 100}%` }} />
      </div>
      <div className="flex min-h-0 overflow-hidden">
        <div ref={setScroller} data-reader-scroller className="min-w-0 flex-1 overflow-auto">
          <div ref={contentRef} className={cn("mx-auto px-2 pt-7 pb-24", settings.readerWidth === "wide" ? "max-w-[820px]" : "max-w-[680px]")}>
            <ReaderHeader doc={doc} assets={assets} urlFor={urlFor} />
            {problem && <SaveProblemAlert message={problem} sourceUrl={doc.sourceUrl} />}
            <OfflineStatus doc={doc} assets={assets} onFixImages={() => setMediaOpen(true)} />
            {isThread && (
              <Button variant="outline" size="sm" className="mb-4" onClick={() => setReviewOpen(true)}>
                <ListChecks className="size-[15px]" aria-hidden />Review posts
              </Button>
            )}
            <div data-reader-prose className={settings.readerFont === "sans" ? "font-sans" : "font-serif"} style={{ fontSize: settings.fontSize }}>
              {isThread
                ? <ThreadView doc={doc} assets={assets} urlFor={urlFor} cards={settings.threadStyle === "cards"} />
                : <BlockView blocks={primarySection(doc)?.blocks ?? []} assets={assets} urlFor={urlFor} variant="reader" />}
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
              <TagIcon className="size-[15px]" aria-hidden />
              {doc.tags.map(tag => <span key={tag} className="rounded-full bg-muted px-2.5 py-1 text-foreground">{tag}</span>)}
              <Button variant="ghost" size="sm" onClick={() => setTagOpen(true)}>{doc.tags.length ? "Edit tags" : "Add tags"}</Button>
            </div>
            <div className="mt-8 flex items-center justify-center gap-2 text-[12px] text-muted-foreground">
              <Check className="size-[15px]" aria-hidden /><span>You’re all caught up.</span>
            </div>
          </div>
        </div>
        {!focusMode && <ReaderOutline doc={doc} contentRef={contentRef} scroller={scroller} />}
      </div>
      <TagDialog doc={doc} open={tagOpen} onOpenChange={setTagOpen} onSave={tags => onUpdate(doc.id, { tags })} />
      {isThread && (
        <ReviewThreadDialog doc={doc} open={reviewOpen} onOpenChange={setReviewOpen} onSave={patch => onUpdate(doc.id, patch)} />
      )}
      <MediaDialog doc={doc} assets={assets} open={mediaOpen} onOpenChange={setMediaOpen} onChanged={onChanged} />
      <DeleteDialog doc={doc} open={deleteOpen} onOpenChange={setDeleteOpen} onRemove={onRemove} onDeleted={onDeleted} />
    </div>
  );
}
