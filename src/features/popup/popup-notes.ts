import type { CaptureJob } from "../../core/model";

export function savedNote(job: CaptureJob): string {
  const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

  return `${job.posts > 1 ? `${count(job.posts, "post")} · ` : ""}${count(job.savedImages, "image")} stored offline`;
}

export function missingImageNote(job: CaptureJob): string | undefined {
  const missing = job.images - job.savedImages;

  if (missing <= 0) return undefined;

  return `${missing} ${missing === 1 ? "image needs" : "images need"} permission from its host. Fix it from the reader.`;
}
