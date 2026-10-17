import { LoaderCircle, X } from "lucide-react";
import type { CaptureJob, CaptureMode } from "../../core/model";
import { hostname } from "../../core/url";
import { isXHost } from "../../capture/x-identity";
import { canSavePage } from "../../features/popup/popup-phase";
import type { ActiveTab } from "../../storage/active-tab";
import { Button } from "../../ui/button";
import { Kbd } from "../../ui/kbd";
import { Segmented } from "../../ui/segmented";

const MODES: [CaptureMode, string][] = [
  ["auto", "Auto"], ["article", "Article"], ["thread", "Thread"], ["selection", "Selection"], ["area", "Area"],
];

function PageCard({ tab }: { tab?: ActiveTab }) {
  const host = tab?.url ? hostname(tab.url) : undefined;
  const kind = host && isXHost(host) ? "thread detected" : "article detected";

  return (
    <div className="flex items-center gap-2.5 rounded-[9px] border border-border bg-card p-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-[13px] font-semibold text-muted-foreground">
        {(host?.[0] ?? "?").toUpperCase()}
      </span>
      <div className="min-w-0">
        <b className="block truncate text-[13px] font-medium text-foreground">{tab?.title || "Choose a web page"}</b>
        <small className="text-[12px] text-muted-foreground">{host ? `${host} · ${kind}` : "Open an article or X thread"}</small>
      </div>
    </div>
  );
}

type IdleCardProps = {
  tab?: ActiveTab;
  mode: CaptureMode;
  starting: boolean;
  onMode: (mode: CaptureMode) => void;
  onSave: () => void;
};

export function IdleCard({ tab, mode, starting, onMode, onSave }: IdleCardProps) {
  return (
    <>
      <PageCard tab={tab} />
      <Segmented value={mode} options={MODES} onChange={(value) => onMode(value as CaptureMode)} ariaLabel="Capture mode" />
      <Button variant="default" size="md" className="w-full justify-center gap-2" onClick={onSave} disabled={!canSavePage(tab?.url, starting)}>
        {starting ? "Starting capture…" : "Save this page"} <Kbd className="border-primary-foreground/30 bg-transparent text-primary-foreground/70">⌥⇧S</Kbd>
      </Button>
    </>
  );
}

type ActiveCardProps = { tab?: ActiveTab; job: CaptureJob; onCancel: () => void };

export function ActiveCard({ tab, job, onCancel }: ActiveCardProps) {
  return (
    <>
      <PageCard tab={tab} />
      <div className="flex flex-col gap-2 rounded-[9px] border border-border bg-card p-3">
        <div className="flex items-center gap-2">
          <LoaderCircle className="size-3.5 shrink-0 animate-spin text-foreground" aria-hidden />
          <b className="font-medium text-foreground">{job.message}</b>
        </div>
        <Button variant="outline" size="sm" className="h-9 w-full justify-center gap-1.5" onClick={onCancel}>
          <X className="size-[15px]" aria-hidden />Cancel
        </Button>
      </div>
      <span className="text-[12px] text-secondary">Keep this tab open until saving finishes. You can close the popup.</span>
    </>
  );
}
