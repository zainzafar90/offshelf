import { useState } from "react";
import type { SavedDocument } from "../../core/model";
import { blocksText } from "../../core/document-text";
import type { ReviewPatch } from "../../features/reader/review-patch";
import { buildReviewPatch, includedIds } from "../../features/reader/review-patch";
import { Button } from "../../ui/button";
import { Dialog, DialogContent } from "../../ui/dialog";
import { toast } from "../shared/toast";
import { useSubmit } from "./use-submit";

type ReviewThreadDialogProps = {
  doc: SavedDocument;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (patch: ReviewPatch) => Promise<boolean>;
};

type ReviewFormProps = Pick<ReviewThreadDialogProps, "doc" | "onOpenChange" | "onSave">;

function ReviewForm({ doc, onOpenChange, onSave }: ReviewFormProps) {
  const [included, setIncluded] = useState<Set<string>>(() => includedIds(doc));
  const { pending, submit } = useSubmit();

  const toggle = (id: string) => setIncluded(previous => {
    const next = new Set(previous);

    if (next.has(id)) next.delete(id); else next.add(id);

    return next;
  });

  const save = async () => {
    if (included.size === 0) {
      toast("Keep at least one post in the reader.", "error");

      return;
    }

    const patch = buildReviewPatch(doc, included);

    if (!await submit(() => onSave(patch))) return;

    onOpenChange(false);
    toast("Thread selection updated.");
  };

  return (
    <div className="flex max-h-[55vh] flex-col gap-2 overflow-auto px-[18px] pb-5">
      {doc.sections.map(section => (
        <label key={section.id} className="flex gap-3 rounded-[8px] border border-border p-3 text-[12.5px]">
          <input type="checkbox" checked={included.has(section.id)} onChange={() => toggle(section.id)} className="mt-0.5" />
          <div>
            <div className="text-[11px] font-medium tracking-wide text-muted-foreground">
              {section.relation === "selected" ? "STARTING POST" : "CANDIDATE"} · {section.author || doc.author}
            </div>
            <p className="mt-1 text-foreground">{blocksText(section.blocks).slice(0, 240)}</p>
          </div>
        </label>
      ))}
      <Button className="mt-1 w-full justify-center" disabled={pending} onClick={() => void save()}>Save selection</Button>
    </div>
  );
}

/* Form state lives in the content, which unmounts on close. */
export function ReviewThreadDialog({ doc, open, onOpenChange, onSave }: ReviewThreadDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Review thread" description="Keep the posts that belong. Excluded posts stay saved and can be restored here.">
        <ReviewForm doc={doc} onOpenChange={onOpenChange} onSave={onSave} />
      </DialogContent>
    </Dialog>
  );
}
