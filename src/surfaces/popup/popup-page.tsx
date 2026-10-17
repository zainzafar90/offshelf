import { useState } from "react";
import type { CaptureMode } from "../../core/model";
import { errorMessage } from "../../core/errors";
import { openLibraryPage, openReaderPage, openSettingsPage } from "../../storage/extension-pages";
import { sendToWorker } from "../../storage/worker-client";
import { toast } from "../shared/toast";
import { PopupView } from "./popup-states";
import { usePopupState } from "./use-popup-state";

export function PopupPage() {
  const { tab, job, savedCount, loading, error, refresh } = usePopupState();
  const [mode, setMode] = useState<CaptureMode>("auto");
  const [starting, setStarting] = useState(false);

  const onSave = async () => {
    if (!tab?.id) return;

    setStarting(true);

    try {
      await sendToWorker({ type: "offshelf:start", tabId: tab.id, mode });
      await refresh();

      if (mode === "area") window.close();
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setStarting(false);
    }
  };

  const onCancel = async () => {
    if (!job) return;

    try {
      await sendToWorker({ type: "offshelf:cancel-job", jobId: job.id });
      await refresh();
    } catch (error) {
      toast(errorMessage(error), "error");
    }
  };

  const onRead = () => {
    if (job) void openReaderPage(job.documentId);
  };

  const onOpenLibrary = () => void openLibraryPage();
  const onSettings = () => void openSettingsPage();

  return (
    <PopupView
      tab={tab}
      job={job}
      savedCount={savedCount}
      mode={mode}
      onMode={setMode}
      onSave={() => void onSave()}
      onCancel={() => void onCancel()}
      onRead={onRead}
      onOpenLibrary={onOpenLibrary}
      onSettings={onSettings}
      starting={starting}
      loading={loading}
      error={error}
      onRetry={() => void refresh()}
    />
  );
}
