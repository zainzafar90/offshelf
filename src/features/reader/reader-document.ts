import type { SavedDocument, Section } from "../../core/model";

export function primarySection(doc: SavedDocument): Section | undefined {
  return doc.sections.find(section => !section.excluded);
}

export function includedPostCount(doc: SavedDocument): number {
  return doc.sections.filter(section => !section.excluded).length;
}

export type ReaderByline = { author: string; handle?: string; site?: string; avatarAssetId?: string };

export function readerByline(doc: SavedDocument): ReaderByline {
  const section = primarySection(doc);
  const handle = doc.kind === "thread" && section?.handle ? `@${section.handle}` : undefined;
  const site = !handle && doc.kind !== "thread" ? doc.siteName : undefined;

  return { author: section?.author || doc.author, handle, site, avatarAssetId: section?.avatarAssetId };
}
