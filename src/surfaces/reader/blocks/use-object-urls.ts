import { useCallback, useEffect, useRef } from "react";
import type { Asset } from "../../../core/model";

export function useObjectUrls(): (asset: Asset | undefined) => string | undefined {
  const urls = useRef(new Map<string, string>());

  useEffect(() => () => { urls.current.forEach(url => URL.revokeObjectURL(url)); urls.current.clear(); }, []);

  return useCallback((asset: Asset | undefined) => {
    if (!asset?.blob || asset.status !== "saved") return undefined;

    let url = urls.current.get(asset.id);

    if (!url) { url = URL.createObjectURL(asset.blob); urls.current.set(asset.id, url); }

    return url;
  }, []);
}
