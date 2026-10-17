import { useCallback, useEffect, useState } from "react";
import type { CaptureJob } from "../../core/model";
import { errorMessage } from "../../core/errors";
import { jobForActivePage } from "../../features/popup/popup-job";
import { listDocuments } from "../../storage/library-store";
import { getActiveTab } from "../../storage/active-tab";
import type { ActiveTab } from "../../storage/active-tab";
import { listJobs } from "../../storage/job-store";
import { onLibraryChanged } from "../../storage/library-changes";
import { toast } from "../shared/toast";

export type PopupState = {
  tab?: ActiveTab;
  job?: CaptureJob;
  savedCount: number;
  loading: boolean;
  error?: string;
  refresh(): Promise<void>;
};

type LoadedState = Omit<PopupState, "refresh">;

export function usePopupState(): PopupState {
  const [state, setState] = useState<LoadedState>({ savedCount: 0, loading: true });

  const refresh = useCallback(async () => {
    try {
      const [tab, documents, jobs] = await Promise.all([
        getActiveTab(),
        listDocuments(),
        listJobs(),
      ]);
      const job = jobForActivePage(jobs, tab);

      setState({ tab, job, savedCount: documents.length, loading: false });
    } catch (error) {
      const message = errorMessage(error);

      console.error("Popup refresh failed:", message);
      /* After first load, keep the data and toast. */
      setState(previous => (previous.loading ? { ...previous, loading: false, error: message } : previous));
      toast(message, "error");
    }
  }, []);

  useEffect(() => {
    void refresh();

    return onLibraryChanged(() => void refresh());
  }, [refresh]);

  return { ...state, refresh };
}
