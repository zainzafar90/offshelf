import type { Asset, SavedDocument } from "../../core/model";
import { visibleAssets } from "../../core/asset-refs";

export function mediaCounts(doc: SavedDocument, assets: Map<string, Asset>): { total: number; saved: number } {
  const ids = visibleAssets(doc);
  const saved = [...ids].filter(id => assets.get(id)?.status === "saved").length;

  return { total: ids.size, saved };
}
