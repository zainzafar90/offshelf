import type { SavedDocument } from "../../core/model";

export function readOpenId(search: string): string | null {
  return new URLSearchParams(search).get("id");
}

export function readerUrl(id: string): string {
  return `?id=${encodeURIComponent(id)}`;
}

export function wantsReadingSettings(search: string): boolean {
  return new URLSearchParams(search).get("settings") === "reading";
}

export function withoutSettingsParam(search: string, pathname: string): string {
  const params = new URLSearchParams(search);

  params.delete("settings");

  return params.toString() ? `?${params}` : pathname;
}

type StaleLinkInput = { loading: boolean; openId: string | null; deletingId: string | null; documents: SavedDocument[] };

export function isStaleLink({ loading, openId, deletingId, documents }: StaleLinkInput): boolean {
  if (loading || !openId || openId === deletingId) return false;

  return !documents.some(doc => doc.id === openId);
}
