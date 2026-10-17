import type { CaptureJob } from "../../core/model";
import { isActiveJob } from "../../core/job-status";

export type PopupPhase = "loading" | "error" | "saved" | "failed" | "active" | "starting" | "idle";

type PhaseInput = { loading?: boolean; error?: string; job?: CaptureJob; starting: boolean };

export function popupPhase({ loading, error, job, starting }: PhaseInput): PopupPhase {
  if (loading) return "loading";

  if (error) return "error";

  if (job?.status === "done") return "saved";

  if (job && !isActiveJob(job.status)) return "failed";

  if (job) return "active";

  return starting ? "starting" : "idle";
}

export function canSavePage(url: string | undefined, starting: boolean): boolean {
  return !starting && /^https?:\/\//.test(url ?? "");
}
