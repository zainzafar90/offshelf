import type { Asset, CaptureJob, SavedDocument, Snapshot } from "../../src/core/model";
import { canonicalUrl } from "../../src/core/url";
import { stableId } from "../../src/core/identity";
import { sampleDocument } from "./fixtures";

export const PAGE_URL = "https://example.com/post";
export const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
export const IMAGE_URL = "https://img.example.com/a.png";

export const agoIso = (ms: number): string => new Date(Date.now() - ms).toISOString();

export function makeJob(overrides: Partial<CaptureJob> = {}): CaptureJob {
  const sourceUrl = overrides.sourceUrl ?? PAGE_URL;
  return {
    id: "job-1", tabId: 7, sourceUrl, documentId: stableId(canonicalUrl(sourceUrl)), title: "A title",
    status: "capturing", message: "Reading the page…", createdAt: agoIso(1000), updatedAt: agoIso(1000),
    posts: 0, images: 0, savedImages: 0, options: { mode: "auto", autoScroll: true, maxPasses: 24 }, ...overrides,
  };
}

export function makeDoc(overrides: Partial<SavedDocument> = {}): SavedDocument {
  return sampleDocument({ id: stableId(PAGE_URL), sourceUrl: PAGE_URL, ...overrides });
}

export function makeAsset(sourceUrl = IMAGE_URL, overrides: Partial<Asset> = {}): Asset {
  return { id: stableId(sourceUrl), sourceUrl, alt: "", status: "pending", bytes: 0, attempts: 0, updatedAt: agoIso(5000), ...overrides };
}

/* A snapshot the worker's validateSnapshot accepts for PAGE_URL. */
export function makeSnapshot(imageUrls: string[] = [], overrides: Partial<SavedDocument> = {}): Snapshot {
  const assets = imageUrls.map(url => ({ id: stableId(url), sourceUrl: url, alt: "pic" }));
  return { document: makeDoc({ assetIds: assets.map(asset => asset.id), ...overrides }), assets };
}

export function pngResponse(bytes: Uint8Array = PNG_BYTES, init: ResponseInit = {}): Response {
  return new Response(bytes as BodyInit, { status: 200, ...init });
}
