import type { CaptureJob } from '../core/model';
import { isActiveJob } from '../core/job-status';
import { now } from '../core/time';
import { parseWorkerRequest } from '../core/worker-contract';
import type { WorkerRequest } from '../core/worker-contract';
import { extensionUrl } from '../storage/extension-pages';
import { deleteDocument, getDocument } from '../storage/library-store';
import { listJobs, putJob } from '../storage/job-store';
import { cancelJob, handleCaptureMessage, startCapture, startDownload } from './capture-jobs';
import { openLibrary } from './library-tab';
import { notifyChanged } from './notify';

type Sender = chrome.runtime.MessageSender;

type PageRequest = Exclude<WorkerRequest, { type: 'offshelf:checkpoint' | 'offshelf:finish' | 'offshelf:capture-error' }>;

type WorkerResult = { ok: true; job?: CaptureJob };

async function deleteSavedDocument(documentId: string): Promise<void> {
    const jobs = await listJobs();

    for (const job of jobs.filter(item => item.documentId === documentId))
        await cancelJob(job.id);

    await deleteDocument(documentId);
    await notifyChanged();
}

async function retryImages(documentId: string): Promise<CaptureJob> {
    const doc = await getDocument(documentId);

    if (!doc)
        throw new Error('Document not found.');

    const previous = (await listJobs()).filter(job => job.documentId === doc.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

    if (previous && isActiveJob(previous.status))
        throw new Error('A save is already in progress for this document.');

    const job: CaptureJob = {
        id: crypto.randomUUID(), tabId: previous?.tabId ?? -1, sourceUrl: doc.sourceUrl, documentId: doc.id, title: doc.title,
        status: 'downloading', message: 'Retrying missing images…', createdAt: now(), updatedAt: now(),
        posts: doc.sections.length, images: doc.assetIds.length, savedImages: 0,
        options: { mode: 'auto', autoScroll: false, maxPasses: 1 },
    };

    await putJob(job);
    startDownload(job.id, async () => { });
    await notifyChanged();

    return job;
}

async function handlePageRequest(request: PageRequest): Promise<WorkerResult> {
    switch (request.type) {
        case 'offshelf:start':
            return { ok: true, job: await startCapture(request.tabId, request.mode) };
        case 'offshelf:open-library':
            await openLibrary();

            return { ok: true };
        case 'offshelf:cancel-job':
            await cancelJob(request.jobId);

            return { ok: true };
        case 'offshelf:delete':
            await deleteSavedDocument(request.documentId);

            return { ok: true };
        case 'offshelf:retry-images':
            return { ok: true, job: await retryImages(request.documentId) };
        case 'offshelf:changed':
            await notifyChanged();

            return { ok: true };
    }
}

export async function handleWorkerMessage(message: unknown, sender: Sender): Promise<WorkerResult> {
    const request = parseWorkerRequest(message);

    switch (request.type) {
        case 'offshelf:checkpoint':
        case 'offshelf:finish':
        case 'offshelf:capture-error':
            return handleCaptureMessage(request, sender);
    }

    if (!sender.url?.startsWith(extensionUrl('')))
        throw new Error('This action is only available from Offshelf.');

    return handlePageRequest(request);
}
