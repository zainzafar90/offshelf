import { AlertTriangle, ArrowRight, Check, ImageOff, LoaderCircle } from "lucide-react";
import type { CaptureJob } from "../../core/model";
import { canSavePage } from "../../features/popup/popup-phase";
import { missingImageNote, savedNote } from "../../features/popup/popup-notes";
import type { ActiveTab } from "../../storage/active-tab";
import { Button } from "../../ui/button";

export function LoadingCard() {
  return (
    <span role="status" className="flex items-center gap-2 text-[12px] text-muted-foreground">
      <LoaderCircle className="size-3.5 shrink-0 animate-spin" aria-hidden />Loading…
    </span>
  );
}

type ErrorCardProps = { message: string; onRetry?: () => void };

export function ErrorCard({ message, onRetry }: ErrorCardProps) {
  return (
    <>
      <span role="alert" className="flex items-start gap-1.5 text-[12px] text-secondary">
        <AlertTriangle className="mt-px size-[15px] shrink-0" aria-hidden />
        Offshelf could not read your library: {message}
      </span>
      {onRetry && <Button variant="default" size="md" className="w-full justify-center" onClick={onRetry}>Try again</Button>}
    </>
  );
}

function ImageNote({ job }: { job: CaptureJob }) {
  const note = missingImageNote(job);

  if (!note) return null;

  return (
    <span className="flex items-start gap-1.5 text-[12px] text-secondary">
      <ImageOff className="mt-px size-[15px] shrink-0" aria-hidden />
      {note}
    </span>
  );
}

export function SavedCard({ job, onRead }: { job: CaptureJob; onRead: () => void }) {
  return (
    <>
      <div className="flex flex-col gap-2 rounded-[9px] border border-border bg-card p-3">
        <div className="flex items-center gap-2">
          <span className="grid size-[18px] shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="size-[11px]" aria-hidden /></span>
          <b className="font-medium text-foreground">Saved to your library</b>
        </div>
        <span className="text-[12px] text-muted-foreground">{savedNote(job)}</span>
      </div>
      <Button variant="default" size="md" className="w-full justify-center gap-2" onClick={onRead}>
        Read it now <ArrowRight className="size-[15px]" aria-hidden />
      </Button>
      <ImageNote job={job} />
    </>
  );
}

type FailedCardProps = { tab?: ActiveTab; job: CaptureJob; starting: boolean; onSave: () => void };

export function FailedCard({ tab, job, starting, onSave }: FailedCardProps) {
  return (
    <>
      <span className="flex items-start gap-1.5 text-[12px] text-secondary">
        <AlertTriangle className="mt-px size-[15px] shrink-0" aria-hidden />
        {job.error || job.message}
      </span>
      <Button variant="default" size="md" className="w-full justify-center gap-2" onClick={onSave} disabled={!canSavePage(tab?.url, starting)}>
        Save again
      </Button>
    </>
  );
}
