import { useCallback, useEffect, useRef, useState } from "react";
import type { Asset, CaptureJob, SavedDocument, Settings } from "../../core/model";
import { DEFAULT_SETTINGS } from "../../core/model";
import { errorMessage } from "../../core/errors";
import { getSettings, listAssets, listDocuments, putSettings, updateDocument } from "../../storage/library-store";
import { listJobs } from "../../storage/job-store";
import { onLibraryChanged } from "../../storage/library-changes";
import { sendToWorker } from "../../storage/worker-client";
import { toast } from "./toast";

type LibraryData = {
  documents: SavedDocument[];
  assets: Map<string, Asset>;
  jobs: CaptureJob[];
  settings: Settings;
  loading: boolean;
  error?: string;
};

export type ProgressPatch = { progress: number; read?: boolean };

export type UseLibrary = LibraryData & {
  refresh(): Promise<void>;
  update(id: string, patch: Partial<SavedDocument>): Promise<boolean>;
  saveProgress(id: string, patch: ProgressPatch): Promise<void>;
  remove(id: string): Promise<boolean>;
  saveSettings(patch: Partial<Settings>): Promise<void>;
};

const INITIAL: LibraryData = { documents: [], assets: new Map(), jobs: [], settings: DEFAULT_SETTINGS, loading: true };

export function useLibrary(): UseLibrary {
  const [state, setState] = useState<LibraryData>(INITIAL);
  const documentsRef = useRef<SavedDocument[]>(INITIAL.documents);

  documentsRef.current = state.documents;
  const loadedRef = useRef(false);
  const settingsQueueRef = useRef<Promise<void>>(Promise.resolve());
  // Bumped on every refresh() call and on unmount; a stale call whose Promise.all
  // resolves after a newer one (or after unmount) sees a mismatch and skips setState.
  const generationRef = useRef(0);

  /* After first load, errors toast only; the library stays visible. */
  const fail = useCallback((error: unknown) => {
    const message = errorMessage(error);

    toast(message, "error");

    if (loadedRef.current) return;

    setState(previous => ({ ...previous, error: message }));
  }, []);

  const refresh = useCallback(async () => {
    const generation = ++generationRef.current;

    try {
      const [documents, assets, jobs, settings] = await Promise.all([listDocuments(), listAssets(), listJobs(), getSettings()]);

      if (generation !== generationRef.current)
        return;

      loadedRef.current = true;
      setState({ documents, assets: new Map(assets.map(asset => [asset.id, asset])), jobs, settings, loading: false });
    } catch (error) {
      if (generation !== generationRef.current)
        return;

      fail(error);
      setState(previous => ({ ...previous, loading: false }));
    }
  }, [fail]);

  useEffect(() => {
    void refresh();
    const revisionTimer = { current: undefined as ReturnType<typeof setTimeout> | undefined };
    const stopListening = onLibraryChanged(() => {
      clearTimeout(revisionTimer.current);
      revisionTimer.current = setTimeout(() => void refresh(), 100);
    });

    return () => {
      clearTimeout(revisionTimer.current);
      stopListening();
      generationRef.current++;
    };
  }, [refresh]);

  const update = useCallback(async (id: string, patch: Partial<SavedDocument>): Promise<boolean> => {
    try {
      await updateDocument(id, patch);
      await refresh();

      return true;
    } catch (error) {
      fail(error);

      return false;
    }
  }, [refresh, fail]);

  /* Progress patches one document in state; no refresh, no asset reload. */
  const saveProgress = useCallback(async (id: string, patch: ProgressPatch) => {
    if (!documentsRef.current.some(doc => doc.id === id)) return;

    try {
      const saved = await updateDocument(id, patch);

      setState(previous => ({ ...previous, documents: previous.documents.map(doc => (doc.id === id ? saved : doc)) }));
    } catch (error) {
      toast(errorMessage(error), "error");
    }
  }, []);

  // A failed delete is not a library-load failure: it toasts, but must not
  // set state.error (that would replace the whole library view with the
  // error panel over a single document's delete failing).
  const remove = useCallback(async (id: string): Promise<boolean> => {
    try {
      await sendToWorker({ type: "offshelf:delete", documentId: id });
      await refresh();

      return true;
    } catch (error) {
      toast(errorMessage(error), "error");

      return false;
    }
  }, [refresh]);

  /* Queued; each write merges onto the latest stored settings. */
  const saveSettings = useCallback((patch: Partial<Settings>): Promise<void> => {
    const write = async () => {
      try {
        await putSettings({ ...await getSettings(), ...patch });
        await refresh();
      } catch (error) {
        fail(error);
      }
    };

    settingsQueueRef.current = settingsQueueRef.current.then(write);

    return settingsQueueRef.current;
  }, [refresh, fail]);

  return { ...state, refresh, update, saveProgress, remove, saveSettings };
}
