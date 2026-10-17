import type { SavedDocument } from "../../core/model";

const UNFINISHED = new Set(["interrupted", "cancelled", "source-closed"]);

export function saveProblem(doc: SavedDocument): string | undefined {
  return doc.warnings.find(warning => UNFINISHED.has(warning.code))?.message;
}
