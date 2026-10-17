import type { Asset, SavedDocument } from "../../core/model";
import { originPattern } from "../../core/url";
import { visibleAssets } from "../../core/asset-refs";

export type MissingMedia = { missing: Asset[]; origins: string[]; total: number; saved: number };

export function missingAssets(doc: SavedDocument, assets: Map<string, Asset>): Asset[] {
  return [...visibleAssets(doc)].map(id => assets.get(id)).filter((asset): asset is Asset => !!asset && asset.status !== "saved");
}

export function originsOf(missing: Asset[]): string[] {
  return [...new Set(missing.map(asset => originPattern(asset.sourceUrl)).filter((origin): origin is string => !!origin))];
}

export function missingMedia(doc: SavedDocument, assets: Map<string, Asset>): MissingMedia {
  const missing = missingAssets(doc, assets);
  const total = visibleAssets(doc).size;

  return { missing, origins: originsOf(missing), total, saved: total - missing.length };
}
