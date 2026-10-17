import { BookOpen, Plus, Search } from "lucide-react";
import { Button } from "../../ui/button";

type EmptyStateProps = {
  filtered: boolean;
  search: string;
  onSavePage: () => void;
  onTryReader: () => void;
};

export function EmptyState({ filtered, search, onSavePage, onTryReader }: EmptyStateProps) {
  if (filtered) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-20 text-center">
        <Search className="size-8 text-muted-foreground" aria-hidden />
        <h2 className="text-[15px] font-semibold text-foreground">No reads found</h2>
        <p className="max-w-[320px] text-[12.5px] text-muted-foreground">
          {search ? "Try a different title, author, or phrase." : "Saved pages matching this view will appear here."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 px-6 py-20 text-center">
      <BookOpen className="size-8 text-muted-foreground" aria-hidden />
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Your library starts here</p>
      <h2 className="text-[15px] font-semibold text-foreground">Keep something worth reading.</h2>
      <p className="max-w-[340px] text-[12.5px] whitespace-pre-line text-muted-foreground">
        {"Save an article or a thread, including its images.\nRead it here, even when you’re offline."}
      </p>
      <div className="mt-2 flex gap-2">
        <Button variant="default" onClick={onSavePage}><Plus className="size-[15px]" aria-hidden />Save your first page</Button>
        <Button variant="outline" onClick={onTryReader}>Try the reader</Button>
      </div>
    </div>
  );
}
