import type { Asset, SavedDocument } from "../../core/model";
import { inView, type LibraryView } from "./library-query";

const VIEWS: LibraryView[] = ["all", "unread", "starred", "archive"];

export function viewCounts(docs: SavedDocument[]): Record<LibraryView, number> {
  return Object.fromEntries(VIEWS.map(v => [v, docs.filter(d => inView(d, v)).length])) as Record<LibraryView, number>;
}

export function kindCounts(docs: SavedDocument[]): { post: number; article: number } {
  const live = docs.filter(d => !d.archived);

  return { post: live.filter(d => d.kind === "thread").length, article: live.filter(d => d.kind !== "thread").length };
}

export function libraryTags(docs: SavedDocument[]): string[] {
  return [...new Set(docs.filter(d => !d.archived).flatMap(d => d.tags))].sort().slice(0, 10);
}

export function storageBytes(assets: Map<string, Asset>): number {
  return [...assets.values()].reduce((sum, a) => sum + a.bytes, 0);
}
