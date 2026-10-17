import type { Asset, CaptureJob, SavedDocument } from '../core/model';
import { isActiveJob } from '../core/job-status';
import { now } from '../core/time';
import { all, completed, db, get, put, request } from './connection';

export const getJob = (id: string) => get<CaptureJob>('jobs', id);

export const putJob = (job: CaptureJob) => put('jobs', job);

export const listJobs = () => all<CaptureJob>('jobs');

// Job state and document/image writes share transactions, so cancellation cannot be
// undone by an in-flight checkpoint or a slower parallel image download.
export async function mutateJob(id: string, change: (job: CaptureJob) => CaptureJob | undefined): Promise<CaptureJob | undefined> {
    const database = await db();
    const tx = database.transaction('jobs', 'readwrite');
    const done = completed(tx);
    const current = await request<CaptureJob | undefined>(tx.objectStore('jobs').get(id));
    const next = current ? change(current) : undefined;

    if (next)
        tx.objectStore('jobs').put(next);

    await done;

    return next;
}

export async function createJobIfTabIdle(job: CaptureJob): Promise<boolean> {
    const database = await db();
    const tx = database.transaction('jobs', 'readwrite');
    const done = completed(tx);
    const jobs = await request<CaptureJob[]>(tx.objectStore('jobs').getAll());
    const busy = jobs.some(item => item.tabId === job.tabId && isActiveJob(item.status));

    if (!busy)
        tx.objectStore('jobs').put(job);

    await done;

    return !busy;
}

export async function saveCaptureCheckpoint(jobId: string, doc: SavedDocument, assets: Asset[], message: string): Promise<void> {
    const database = await db();
    const tx = database.transaction(['documents', 'assets', 'jobs'], 'readwrite');
    const done = completed(tx);
    const job = await request<CaptureJob | undefined>(tx.objectStore('jobs').get(jobId));

    if (!job || job.status !== 'capturing' || job.sourceUrl !== doc.sourceUrl) {
        tx.abort();
        await done.catch(() => { });
        throw new Error('This capture has already stopped.');
    }

    const old = await request<SavedDocument | undefined>(tx.objectStore('documents').get(doc.id));

    if (old && old.sourceUrl !== doc.sourceUrl) {
        tx.abort();
        await done.catch(() => { });
        throw new Error('Document identifier collision.');
    }

    const excluded = new Set(old?.sections.filter(section => section.excluded).map(section => section.id));

    tx.objectStore('documents').put({ ...doc, starred: old?.starred ?? doc.starred, archived: old?.archived ?? doc.archived,
        read: old?.read ?? doc.read, progress: old?.progress ?? doc.progress, tags: old?.tags ?? doc.tags,
        capturedAt: old?.capturedAt ?? doc.capturedAt,
        sections: doc.sections.map(section => ({ ...section, excluded: excluded.has(section.id) })) });

    for (const asset of assets) {
        const oldAsset = await request<Asset | undefined>(tx.objectStore('assets').get(asset.id));

        if (oldAsset && oldAsset.sourceUrl !== asset.sourceUrl) {
            tx.abort();
            await done.catch(() => { });
            throw new Error('Image identifier collision.');
        }

        if (!oldAsset)
            tx.objectStore('assets').put(asset);
    }

    tx.objectStore('jobs').put({ ...job, documentId: doc.id, title: doc.title, updatedAt: now(), posts: doc.sections.length,
        images: assets.length, message });
    await done;
}

export async function saveDownloadedAsset(jobId: string, asset: Asset, count: number, total: number): Promise<boolean> {
    const database = await db();
    const tx = database.transaction(['jobs', 'assets', 'documents'], 'readwrite');
    const done = completed(tx);
    const job = await request<CaptureJob | undefined>(tx.objectStore('jobs').get(jobId));

    if (!job || job.status !== 'downloading') {
        await done;

        return false;
    }

    const doc = await request<SavedDocument | undefined>(tx.objectStore('documents').get(job.documentId));

    if (!doc) {
        await done;

        return false;
    }

    tx.objectStore('assets').put(asset);
    const savedImages = Math.max(count, job.savedImages);

    tx.objectStore('jobs').put({ ...job, updatedAt: now(), savedImages, images: total,
        message: `Saving images · ${savedImages} of ${total} available offline` });
    await done;

    return true;
}

