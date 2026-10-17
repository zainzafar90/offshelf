import { useEffect, useRef, useState } from "react";
import type { SavedDocument } from "../../core/model";
import { isStaleLink, readOpenId, readerUrl, wantsReadingSettings, withoutSettingsParam } from "../../features/library/reader-route";
import { toast } from "../shared/toast";

type ReaderRouteOptions = {
  documents: SavedDocument[];
  loading: boolean;
  remove: (id: string) => Promise<boolean>;
  onSettingsLink: () => void;
};

export function useReaderRoute({ documents, loading, remove, onSettingsLink }: ReaderRouteOptions) {
  const [openId, setOpenId] = useState<string | null>(() => readOpenId(location.search));
  const deletingIdRef = useRef<string | null>(null);

  /* Param is dropped so Back/refresh can't re-apply it. */
  useEffect(() => {
    if (!wantsReadingSettings(location.search)) return;

    onSettingsLink();
    history.replaceState(null, "", withoutSettingsParam(location.search, location.pathname));
  }, []);

  useEffect(() => {
    const onPopState = () => setOpenId(readOpenId(location.search));

    window.addEventListener("popstate", onPopState);

    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  /* A `?id=` naming no document is stale; drop it. */
  useEffect(() => {
    if (!isStaleLink({ loading, openId, deletingId: deletingIdRef.current, documents })) return;

    setOpenId(null);
    history.replaceState(null, "", location.pathname);
    toast("This document is no longer in your library.", "error");
  }, [loading, openId, documents]);

  const openDoc = (id: string) => {
    setOpenId(id);
    history.pushState(null, "", readerUrl(id));
  };
  const closeReader = () => {
    setOpenId(null);
    history.pushState(null, "", location.pathname);
  };
  /* replaceState, so Back can't reach a deleted `?id=`. */
  const closeReaderAfterDelete = () => {
    deletingIdRef.current = null;
    setOpenId(null);
    history.replaceState(null, "", location.pathname);
  };
  /* The refresh after delete must not read as a stale link. */
  const removeDocument = async (id: string) => {
    deletingIdRef.current = id;
    const removed = await remove(id);

    if (!removed) deletingIdRef.current = null;

    return removed;
  };

  return { openId, openDoc, closeReader, closeReaderAfterDelete, removeDocument };
}
