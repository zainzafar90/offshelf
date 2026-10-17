import type { Asset, SavedDocument } from "../../core/model";
import { relativeTime } from "../../features/library/relative-time";

type StatusBarProps = {
  documents: SavedDocument[];
  assets: Map<string, Asset>;
};

export function StatusBar({ documents, assets }: StatusBarProps) {
  const stored = [...assets.values()].filter(asset => asset.status === "saved").length;
  const failed = [...assets.values()].filter(asset => asset.status === "failed").length;
  const newest = documents.reduce((max, doc) => (doc.capturedAt > max ? doc.capturedAt : max), "");

  return (
    <div className="flex gap-4 border-t border-border bg-background px-[18px] py-1.5 text-[11.5px] tabular-nums text-muted-foreground">
      <span>Saved on this device · works offline</span>
      {newest && <span className="ml-auto">Last saved {relativeTime(newest)}</span>}
      <span>{stored} images stored{failed > 0 ? ` · ${failed} couldn't be saved` : ""}</span>
    </div>
  );
}
