import type { SavedDocument } from "../../core/model";
import { measureDocument } from "../../core/document-text";

export type ReviewPatch = Pick<SavedDocument, "sections" | "wordCount" | "readingMinutes" | "excerpt">;

export function includedIds(doc: SavedDocument): Set<string> {
  return new Set(doc.sections.filter(section => !section.excluded).map(section => section.id));
}

export function buildReviewPatch(doc: SavedDocument, included: Set<string>): ReviewPatch {
  const next = measureDocument({ ...doc, sections: doc.sections.map(section => ({ ...section, excluded: !included.has(section.id) })) });

  return { sections: next.sections, wordCount: next.wordCount, readingMinutes: next.readingMinutes, excerpt: next.excerpt };
}
