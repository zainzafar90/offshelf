import type { Asset, CaptureJob } from '../core/model';
import { LIMITS } from '../core/model';
import { errorMessage } from '../core/errors';
import { now } from '../core/time';
import { getJob, mutateJob, saveDownloadedAsset } from '../storage/job-store';
import { assetsForDocument, getDocument } from '../storage/library-store';
import { downloadWithRetry } from './image-retry';

const downloads = new Set<string>();

function attentionMessage(failed: number): string {
    return failed === 1 ? 'Text saved · 1 image needs attention' : `Text saved · ${failed} images need attention`;
}

async function isDownloading(jobId: string): Promise<boolean> {
    return (await getJob(jobId))?.status === 'downloading';
}

export async function downloadJob(jobId: string, notify: () => Promise<void>, openReader: (job: CaptureJob) => Promise<void>, sleep?: (ms: number) => Promise<void>): Promise<void> {
    if (downloads.has(jobId))
        return;

    downloads.add(jobId);

    try {
        const job = await getJob(jobId);

        if (!job || job.status !== 'downloading')
            return;

        const doc = await getDocument(job.documentId);

        if (!doc)
            throw new Error('The saved document was removed.');

        const assets = await assetsForDocument(doc);
        const pending = [...assets.values()].filter(asset => asset.status !== 'saved');
        let totalBytes = [...assets.values()].reduce((sum, asset) => sum + asset.bytes, 0);
        let nextIndex = 0;
        const worker = async () => {
            while (nextIndex < pending.length) {
                const current = await getJob(jobId);

                if (!current || current.status !== 'downloading')
                    return;

                const asset = pending[nextIndex++];

                if (!asset)
                    return;

                let result: Asset | undefined;

                if (totalBytes >= LIMITS.maxCaptureBytes)
                    result = { ...asset, status: 'failed', error: 'The 180 MB per-capture image budget was reached.', updatedAt: now() };
                else
                    result = await downloadWithRetry(asset, { isActive: () => isDownloading(jobId), sleep });

                if (!result)
                    return;

                if (result.status === 'saved' && totalBytes + result.bytes > LIMITS.maxCaptureBytes)
                    result = { ...result, status: 'failed', blob: undefined, bytes: 0, error: 'The 180 MB per-capture image budget was reached.' };

                totalBytes += result.bytes;
                assets.set(result.id, result);
                const count = [...assets.values()].filter(value => value.status === 'saved').length;

                if (!await saveDownloadedAsset(jobId, result, count, assets.size))
                    return;

                await notify();
            }
        };

        await Promise.all([worker(), worker(), worker()]);
        const count = [...assets.values()].filter(asset => asset.status === 'saved').length;
        const done = await mutateJob(jobId, current => current.status === 'downloading' ? { ...current, status: 'done', updatedAt: now(), savedImages: count, images: assets.size,
            message: count === assets.size ? 'Saved to your library' : attentionMessage(assets.size - count) } : undefined);

        if (!done)
            return;

        await chrome.action.setBadgeText({ tabId: job.tabId, text: count === assets.size ? '✓' : '!' }).catch(() => { });
        await notify();
        await openReader(done);
    }
    catch (error) {
        await mutateJob(jobId, current => current.status === 'downloading' ? { ...current, status: 'interrupted', updatedAt: now(), error: errorMessage(error), message: 'Text is saved. Retry the remaining images.' } : undefined);
        await notify();
    }
    finally {
        downloads.delete(jobId);
    }
}

