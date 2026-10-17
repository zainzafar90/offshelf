import { errorMessage } from '../core/errors';
import { isActiveJob } from '../core/job-status';
import { now } from '../core/time';
import { listJobs, mutateJob } from '../storage/job-store';
import { markDocumentPartial } from '../storage/library-store';
import { startDownload } from './capture-jobs';
import { notifyChanged } from './notify';

export async function recoverJobs(): Promise<void> {
    const jobs = await listJobs();
    let changed = false;

    for (const job of jobs) {
        if (!isActiveJob(job.status) || Date.now() - Date.parse(job.updatedAt) < 120_000)
            continue;

        if (job.status === 'downloading') {
            startDownload(job.id, async () => { });
            changed = true;
            continue;
        }

        const stopped = await mutateJob(job.id, current => current.status === 'capturing' && Date.now() - Date.parse(current.updatedAt) >= 120_000 ? { ...current, status: 'interrupted', updatedAt: now(), message: 'The capture stopped responding. Saved checkpoints are still available.' } : undefined);

        if (!stopped)
            continue;

        changed = true;
        await markDocumentPartial(job.documentId, { code: 'interrupted', message: 'Capture was interrupted. Reopen the source page to capture it again.' });
    }

    if (changed)
        await notifyChanged();
}

export function handleTabRemoved(tabId: number): void {
    void listJobs().then(async (jobs) => {
        for (const job of jobs.filter(item => item.tabId === tabId && item.status === 'capturing')) {
            const stopped = await mutateJob(job.id, current => current.status === 'capturing' ? { ...current, status: 'interrupted', updatedAt: now(), message: 'The source tab was closed. Saved checkpoints were retained.' } : undefined);

            if (!stopped)
                continue;

            await markDocumentPartial(job.documentId, { code: 'source-closed', message: 'The source tab closed before capture completed.' });
        }

        await notifyChanged();
    }).catch(error => console.error('[offshelf] tab close handling failed', { tabId, error: errorMessage(error) }));
}
