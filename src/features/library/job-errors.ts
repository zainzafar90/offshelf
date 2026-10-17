import type { CaptureJob, SavedDocument } from "../../core/model";
import { isActiveJob } from "../../core/job-status";

/* Newest failed job whose document never got saved. */
export function latestUnsavedFailure(jobs: CaptureJob[], documents: SavedDocument[]): CaptureJob[] {
  return jobs
    .filter(job => ["failed", "interrupted"].includes(job.status) && !documents.some(doc => doc.id === job.documentId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 1);
}

export function visibleJobRows(jobs: CaptureJob[], documents: SavedDocument[]): CaptureJob[] {
  return [...jobs.filter(job => isActiveJob(job.status)), ...latestUnsavedFailure(jobs, documents)];
}
