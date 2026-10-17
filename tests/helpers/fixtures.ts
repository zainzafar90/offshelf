import type { SavedDocument } from "../../src/core/model";

export function sampleDocument(overrides: Partial<SavedDocument> = {}): SavedDocument {
  return {
    schemaVersion: 1, id: "doc-1", sourceUrl: "https://example.com/post", title: "A title", author: "Ada",
    siteName: "Example", kind: "article", excerpt: "", capturedAt: "2026-09-01T10:00:00.000Z",
    updatedAt: "2026-09-01T10:00:00.000Z", sections: [{
      id: "s1", sourceUrl: "https://example.com/post", relation: "selected", excluded: false,
      blocks: [
        { type: "heading", level: 2, anchor: "intro", content: [{ text: "Intro" }] },
        { type: "paragraph", content: [{ text: "Hello " }, { text: "world", bold: true, href: "https://example.com/w" }] },
        { type: "paragraph", content: [{ text: "bad link", href: "javascript:alert(1)" }] },
      ],
    }],
    assetIds: [], warnings: [], completeness: "unverified", wordCount: 0, readingMinutes: 1,
    starred: false, archived: false, read: false, progress: 0, tags: [], ...overrides,
  };
}
