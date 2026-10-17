import type { CaptureJob } from "../../core/model";
import { isActiveJob } from "../../core/job-status";
import { canonicalUrl } from "../../core/url";

type PageTab = { id?: number; url?: string };

function pageKey(url: string | undefined): string | undefined {
  if (!url) return undefined;

  try {
    return canonicalUrl(url);
  } catch {
    return undefined;
  }
}

/* Running jobs follow the tab; finished jobs need a URL match. */
export function jobForActivePage(jobs: CaptureJob[], tab: PageTab | undefined): CaptureJob | undefined {
  if (tab?.id === undefined) return undefined;

  const tabJobs = jobs.filter(job => job.tabId === tab.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const running = tabJobs.find(job => isActiveJob(job.status));

  if (running) return running;

  const page = pageKey(tab.url);

  return tabJobs.find(job => job.sourceUrl === page);
}
