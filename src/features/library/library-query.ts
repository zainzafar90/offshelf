import { visibleAssets } from "../../core/asset-refs";
import type { SavedDocument } from "../../core/model";

export type LibraryView = "all" | "unread" | "starred" | "archive";

export type KindFilter = "all" | "post" | "article";

export type SortOrder = "newest" | "oldest" | "title";

export type LibraryQuery = { view: LibraryView; kind: KindFilter; tag: string; search: string; imageOnly: boolean; sort: SortOrder };

export const PAGE_SIZE = 60;

export const DEFAULT_QUERY: LibraryQuery = { view: "all", kind: "all", tag: "", search: "", imageOnly: false, sort: "newest" };

export function inView(doc: SavedDocument, view: LibraryView): boolean {
  if (view === "archive") return doc.archived;

  if (doc.archived) return false;

  if (view === "unread") return !doc.read;

  if (view === "starred") return doc.starred;

  return true;
}

function searchText(doc: SavedDocument): string {
  const sections = doc.sections.map(s => `${s.author || ""} ${s.handle || ""} ${JSON.stringify(s.blocks)}`).join(" ");

  return `${doc.sourceUrl}\n${doc.title}\n${doc.author}\n${doc.siteName}\n${doc.excerpt}\n${doc.tags.join(" ")}\n${sections}`.toLocaleLowerCase();
}

export function matchesSearch(doc: SavedDocument, query: string): boolean {
  const q = query.trim().toLocaleLowerCase();

  return !q || searchText(doc).includes(q);
}

function matchesKind(doc: SavedDocument, kind: KindFilter): boolean {
  if (kind === "post") return doc.kind === "thread";

  if (kind === "article") return doc.kind !== "thread";

  return true;
}

function compare(order: SortOrder) {
  return (a: SavedDocument, b: SavedDocument): number =>
    order === "title" ? a.title.localeCompare(b.title) : order === "oldest" ? a.capturedAt.localeCompare(b.capturedAt) : b.capturedAt.localeCompare(a.capturedAt);
}

export function queryDocuments(docs: SavedDocument[], q: LibraryQuery): SavedDocument[] {
  return docs
    .filter(d => inView(d, q.view) && matchesKind(d, q.kind) && (!q.tag || d.tags.includes(q.tag)) && (!q.imageOnly || visibleAssets(d).size > 0) && matchesSearch(d, q.search))
    .sort(compare(q.sort));
}
