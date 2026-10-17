import { LoaderCircle, TriangleAlert } from "lucide-react";
import type { CaptureJob, SavedDocument } from "../../core/model";
import { errorMessage } from "../../core/errors";
import { isActiveJob } from "../../core/job-status";
import { visibleJobRows } from "../../features/library/job-errors";
import { Button } from "../../ui/button";
import { sendToWorker } from "../../storage/worker-client";
import { toast } from "../shared/toast";

type JobRowsProps = {
  jobs: CaptureJob[];
  documents: SavedDocument[];
  onRefresh: () => void;
};

export function JobRows({ jobs, documents, onRefresh }: JobRowsProps) {
  const rows = visibleJobRows(jobs, documents);

  if (!rows.length) return null;

  return (
    <div className="flex flex-col gap-1.5">
      {rows.map(job => (
        <div key={job.id} className="flex items-center gap-2.5 rounded-[8px] border border-border bg-card px-3 py-2 text-[12px]">
          {isActiveJob(job.status)
            ? <LoaderCircle className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
            : <TriangleAlert className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium text-foreground">{job.title}</div>
            <div className="truncate text-muted-foreground">{job.error || job.message}</div>
          </div>
          {isActiveJob(job.status) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                try {
                  await sendToWorker({ type: "offshelf:cancel-job", jobId: job.id });
                } catch (error) {
                  toast(errorMessage(error), "error");
                } finally {
                  onRefresh();
                }
              }}
            >
              Cancel
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
