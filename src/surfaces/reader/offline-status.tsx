import { AlertTriangle, Cloud } from "lucide-react";
import type { Asset, SavedDocument } from "../../core/model";
import { mediaCounts } from "../../features/library/media-counts";
import { includedPostCount } from "../../features/reader/reader-document";
import { cn } from "../../lib/utils";
import { Button } from "../../ui/button";

type OfflineStatusProps = { doc: SavedDocument; assets: Map<string, Asset>; onFixImages: () => void };

export function OfflineStatus({ doc, assets, onFixImages }: OfflineStatusProps) {
  const { total, saved } = mediaCounts(doc, assets);
  const missing = saved < total;
  const StatusIcon = missing ? AlertTriangle : Cloud;
  const noteCount = doc.warnings.length;

  return (
    <>
      <div className={cn("mb-4 flex items-center gap-2 text-[12px]", missing ? "text-foreground" : "text-muted-foreground")}>
        <StatusIcon className="size-[15px]" aria-hidden />
        <span>{total ? `${saved} of ${total} images offline` : "Text saved offline"}</span>
        {doc.kind === "thread" && (
          <>
            <span aria-hidden>·</span>
            <span>{includedPostCount(doc)} posts · completeness unverified</span>
          </>
        )}
        {missing && <Button variant="ghost" size="sm" onClick={onFixImages}>Fix missing images</Button>}
      </div>
      {noteCount > 0 && (
        <details className="mb-4 rounded-[8px] bg-muted px-3 py-2 text-[12px] text-muted-foreground">
          <summary className="cursor-pointer font-medium text-foreground">{noteCount} capture note{noteCount === 1 ? "" : "s"}</summary>
          {doc.warnings.map((warning, index) => <p key={index} className="mt-1.5">{warning.message}</p>)}
        </details>
      )}
    </>
  );
}
