import { useState } from "react";
import type { SavedDocument } from "../../core/model";
import { parseTags } from "../../features/library/tags";
import { Button } from "../../ui/button";
import { Dialog, DialogContent } from "../../ui/dialog";
import { Input } from "../../ui/input";
import { toast } from "../shared/toast";
import { useSubmit } from "./use-submit";

type TagDialogProps = {
  doc: SavedDocument;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (tags: string[]) => Promise<boolean>;
};

type TagFormProps = Pick<TagDialogProps, "doc" | "onOpenChange" | "onSave">;

function TagForm({ doc, onOpenChange, onSave }: TagFormProps) {
  const [value, setValue] = useState(() => doc.tags.join(", "));
  const { pending, submit } = useSubmit();

  const save = async () => {
    if (!await submit(() => onSave(parseTags(value)))) return;

    onOpenChange(false);
    toast("Tags updated.");
  };

  return (
    <div className="flex flex-col gap-4 px-[18px] pb-5">
      <Input
        aria-label="Document tags"
        value={value}
        onChange={event => setValue(event.target.value)}
        placeholder="Design, Engineering, Read again"
        className="w-full"
        autoFocus
      />
      <Button className="w-full justify-center" disabled={pending} onClick={() => void save()}>
        Save tags
      </Button>
    </div>
  );
}

/* Form state lives in the content, which unmounts on close. */
export function TagDialog({ doc, open, onOpenChange, onSave }: TagDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Edit tags" description="Separate tags with commas.">
        <TagForm doc={doc} onOpenChange={onOpenChange} onSave={onSave} />
      </DialogContent>
    </Dialog>
  );
}
