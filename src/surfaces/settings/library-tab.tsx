import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Download, Folder } from "lucide-react";
import { errorMessage } from "../../core/errors";
import { exportBackup, importBackup } from "../../storage/backup";
import { Button } from "../../ui/button";
import { toast } from "../shared/toast";

type LibraryTabProps = {
  onChanged: () => Promise<void>;
};

export function LibraryTab({ onChanged }: LibraryTabProps) {
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setExporting(true);

    try {
      await exportBackup();
      toast("Library backup downloaded.");
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) return;

    try {
      const result = await importBackup(file);

      toast(`Imported ${result.added} items. ${result.skipped} existing items left unchanged.`);
      await onChanged();
    } catch (error) {
      toast(errorMessage(error), "error");
    }
  };

  return (
    <div className="flex flex-col gap-3 py-3">
      <div className="flex gap-2">
        <Button variant="outline" disabled={exporting} onClick={() => void handleExport()}>
          <Download className="size-[15px]" aria-hidden />Export backup
        </Button>
        <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
          <Folder className="size-[15px]" aria-hidden />Import backup
        </Button>
        <input ref={fileInputRef} type="file" accept=".json,.offshelf.json,application/json" hidden onChange={event => void handleImport(event)} />
      </div>
      <p className="m-0 text-[12px] text-muted-foreground">
        Export before removing the extension or clearing browser data. Existing items are never overwritten during import.
      </p>
    </div>
  );
}
