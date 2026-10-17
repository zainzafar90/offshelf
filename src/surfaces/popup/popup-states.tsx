import { ArrowRight, Library, Settings } from "lucide-react";
import type { CaptureJob, CaptureMode } from "../../core/model";
import { popupPhase } from "../../features/popup/popup-phase";
import type { ActiveTab } from "../../storage/active-tab";
import { Button } from "../../ui/button";
import { Logo } from "../shared/logo";
import { ActiveCard, IdleCard } from "./popup-capture-cards";
import { ErrorCard, FailedCard, LoadingCard, SavedCard } from "./popup-cards";

type PopupViewProps = {
  tab?: ActiveTab;
  job?: CaptureJob;
  savedCount: number;
  mode: CaptureMode;
  onMode: (mode: CaptureMode) => void;
  onSave: () => void;
  onCancel: () => void;
  onRead: () => void;
  onOpenLibrary: () => void;
  onSettings: () => void;
  starting: boolean;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
};

function PopupContent(props: PopupViewProps) {
  const { tab, job, mode, starting, error, onMode, onSave, onCancel, onRead, onRetry } = props;

  switch (popupPhase({ loading: props.loading, error, job, starting })) {
    case "loading": return <LoadingCard />;
    case "error": return error && <ErrorCard message={error} onRetry={onRetry} />;
    case "saved": return job && <SavedCard job={job} onRead={onRead} />;
    case "failed": return job && <FailedCard tab={tab} job={job} starting={starting} onSave={onSave} />;
    case "active": return job && <ActiveCard tab={tab} job={job} onCancel={onCancel} />;
    case "starting":
    case "idle": return <IdleCard tab={tab} mode={mode} starting={starting} onMode={onMode} onSave={onSave} />;
  }
}

export function PopupView(props: PopupViewProps) {
  const { savedCount, loading, onOpenLibrary, onSettings } = props;

  return (
    <div className="w-[360px] overflow-hidden bg-background">
      <header className="flex items-center gap-2 border-b border-border px-3.5 py-3 text-foreground">
        <Logo size={18} />
        <span className="font-serif text-[19px] leading-none">Offshelf</span>
        <div className="ml-auto flex gap-0.5">
          <Button variant="ghost" size="icon" aria-label="Library" onClick={onOpenLibrary}>
            <Library className="size-[15px]" aria-hidden />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Settings" onClick={onSettings}>
            <Settings className="size-[15px]" aria-hidden />
          </Button>
        </div>
      </header>
      <div className="flex flex-col gap-3 p-3.5">
        <PopupContent {...props} />
      </div>
      <footer className="flex items-center border-t border-border px-3.5 py-2.5 text-[12px] text-muted-foreground">
        {loading ? "Loading library…" : `${savedCount} saved on this device`}
        <Button variant="accent" className="ml-auto" onClick={onOpenLibrary}>
          Open library <ArrowRight aria-hidden />
        </Button>
      </footer>
    </div>
  );
}
