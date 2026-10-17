import { Trash2 } from "lucide-react";
import type { SavedDocument } from "../../core/model";
import { Button } from "../../ui/button";
import { Dialog, DialogContent } from "../../ui/dialog";
import { toast } from "../shared/toast";

type DeleteDialogProps = {
  doc: SavedDocument;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRemove: (id: string) => Promise<boolean>;
  onDeleted: () => void;
};

export function DeleteDialog({ doc, open, onOpenChange, onRemove, onDeleted }: DeleteDialogProps) {
  /* onRemove toasts failures; stay open so the user can retry. */
  const confirmDelete = async () => {
    const deleted = await onRemove(doc.id);

    if (!deleted) return;

    onOpenChange(false);
    toast("Saved copy deleted.");
    onDeleted();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Delete this saved read?"
        description="This removes the local copy and any images not used by another saved item."
      >
        <div className="flex flex-col gap-4 px-[18px] pb-5">
          <p className="text-[13px] font-medium text-foreground">{doc.title}</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Keep it</Button>
            <Button onClick={() => void confirmDelete()}>
              <Trash2 className="size-[15px]" aria-hidden />Delete saved copy
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
