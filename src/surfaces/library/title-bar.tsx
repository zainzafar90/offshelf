import { Plus, Upload } from "lucide-react";
import type { LibraryQuery, LibraryView } from "../../features/library/library-query";
import { Button } from "../../ui/button";
import { Kbd } from "../../ui/kbd";

export const VIEW_LABELS: Record<LibraryView, string> = { all: "Library", unread: "Unread", starred: "Starred", archive: "Archive" };

type TitleBarProps = {
  query: LibraryQuery;
  onImport: () => void;
  onSavePage: () => void;
};

export function TitleBar({ query, onImport, onSavePage }: TitleBarProps) {
  const label = query.tag || VIEW_LABELS[query.view];

  return (
    <>
      <div className="flex items-center gap-1.5 px-[18px] pt-3 text-[12px] text-muted-foreground">
        <span>Offshelf</span>
        <span aria-hidden>›</span>
        <b className="font-medium text-foreground">{label}</b>
      </div>
      <div className="flex items-center gap-2 px-[18px] pt-3.5 pb-3">
        <h1 className="m-0 text-[14px] font-semibold text-foreground">{label}</h1>
        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="outline" onClick={onImport}>
            <Upload className="size-[15px]" aria-hidden />Import
          </Button>
          <Button variant="default" onClick={onSavePage}>
            <Plus className="size-[15px]" aria-hidden />Save page
            <Kbd className="border-primary-foreground/30 bg-transparent text-primary-foreground/70">⌥⇧S</Kbd>
          </Button>
        </div>
      </div>
    </>
  );
}
