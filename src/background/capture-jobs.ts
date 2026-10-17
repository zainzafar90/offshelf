import { SETTING_RANGES } from '../core/model';
import type { CaptureJob, CaptureMode } from '../core/model';
import { errorMessage } from '../core/errors';
import { stableId } from '../core/identity';
import { isActiveJob } from '../core/job-status';
import { clamp } from '../core/number-range';
import { now } from '../core/time';
import { canonicalUrl, safeUrl } from '../core/url';
import { validateSnapshot } from '../core/validate';
import { createJobIfTabIdle, getJob, mutateJob, putJob, saveCaptureCheckpoint } from '../storage/job-store';
import { getSettings, markDocumentPartial } from '../storage/library-store';
import { downloadJob } from './download-job';
import { notifyChanged } from './notify';
import type { CaptureRequest } from '../core/worker-contract';

type Sender = chrome.runtime.MessageSender;

export function startDownload(jobId: string, afterDone: (job: CaptureJob) => Promise<void>): void {
    downloadJob(jobId, notifyChanged, afterDone).catch(error => console.error('[offshelf] download failed', { jobId, error: errorMessage(error) }));
}

class TabBusyError extends Error {
    constructor() { super('This tab already has a capture in progress.'); }
}

export function reportCaptureFailure(tabId: number, error: unknown): void {
    console.error('[offshelf] capture failed', { tabId, error: errorMessage(error) });

    if (error instanceof TabBusyError)
        return;

    void chrome.action.setBadgeText({ tabId, text: '!' }).catch(() => { });
}

async function openReader(job: CaptureJob): Promise<void> {
    const settings = await getSettings();

    if (!settings.openReader)
        return;

    const url = chrome.runtime.getURL(`library.html?id=${encodeURIComponent(job.documentId)}`);
    const tabs = await chrome.tabs.query({ url: chrome.runtime.getURL('library.html*') });
    const existing = tabs[0];

    if (existing?.id)
        await chrome.tabs.update(existing.id, { url, active: true });
    else
        await chrome.tabs.create({ url });
}

export async function startCapture(tabId: number, mode: CaptureMode = 'auto'): Promise<CaptureJob> {
    const tab = await chrome.tabs.get(tabId);
    const checked = safeUrl(tab.url);

    if (!checked)
        throw new Error('Open an http or https article first. Chrome internal pages, PDFs, and extension pages cannot be captured.');

    if (/^https:\/\/(chromewebstore\.google\.com|chrome\.google\.com\/webstore)/.test(checked))
        throw new Error('Chrome does not allow capture on its extension store.');

    const settings = await getSettings();
    const sourceUrl = canonicalUrl(checked);
    const job: CaptureJob = {
        id: crypto.randomUUID(), tabId, sourceUrl, documentId: stableId(sourceUrl), title: tab.title || 'Current page',
        status: 'capturing', message: mode === 'area' ? 'Choose an area on the source page' : 'Reading the page…',
        createdAt: now(), updatedAt: now(), posts: 0, images: 0, savedImages: 0,
        options: { mode, autoScroll: settings.autoScroll, maxPasses: clamp(settings.maxPasses, SETTING_RANGES.maxPasses.min, SETTING_RANGES.maxPasses.max) },
    };

    if (!await createJobIfTabIdle(job))
        throw new TabBusyError();

    await chrome.action.setBadgeBackgroundColor({ color: '#3c6451' });
    await chrome.action.setBadgeText({ tabId, text: '…' });
    await notifyChanged();

    try {
        await chrome.scripting.executeScript({ target: { tabId }, files: ['capture.js'] });
        await chrome.tabs.sendMessage(tabId, { type: 'offshelf:run', job });
    }
    catch (error) {
        const message = `Cannot access this page. Click the Offshelf toolbar icon on the source tab and try again. ${errorMessage(error)}`;

        await putJob({ ...job, status: 'failed', updatedAt: now(), error: message, message: 'Capture could not start' });
        await notifyChanged();
        throw new Error(message);
    }

    return job;
}

async function authorizedJob(id: string, sender: Sender): Promise<CaptureJob> {
    const job = await getJob(id);

    if (!job || sender.tab?.id !== job.tabId || sender.frameId !== 0)
        throw new Error('This tab is not authorized for that capture.');

    if (!sender.url || canonicalUrl(sender.url) !== job.sourceUrl)
        throw new Error('The source page changed. Capture was not saved over the original.');

    return job;
}

export async function handleCaptureMessage(message: CaptureRequest, sender: Sender): Promise<{ ok: true }> {
    const job = await authorizedJob(message.jobId, sender);

    if (job.status !== 'capturing')
        throw new Error('This capture has already stopped.');

    if (message.type === 'offshelf:checkpoint') {
        const snapshot = validateSnapshot(message.snapshot, job.sourceUrl);

        await saveCaptureCheckpoint(job.id, snapshot.document, snapshot.assets.map(asset => ({ ...asset, status: 'pending', bytes: 0, attempts: 0, updatedAt: now() })), message.message?.slice(0, 300) ?? 'Saved capture checkpoint');
        await notifyChanged();

        return { ok: true };
    }

    if (message.type === 'offshelf:finish') {
        const changed = await mutateJob(job.id, current => current.status === 'capturing' ? { ...current, status: 'downloading', updatedAt: now(), message: 'Saving images for offline reading…' } : undefined);

        if (!changed)
            throw new Error('This capture has already stopped.');

        startDownload(job.id, openReader);
        await notifyChanged();

        return { ok: true };
    }

    const cancelled = message.cancelled;
    const error = message.error?.slice(0, 1000) ?? 'Capture failed.';
    const stopped = await mutateJob(job.id, current => current.status === 'capturing' ? { ...current, status: cancelled ? 'cancelled' : 'failed', updatedAt: now(), error, message: cancelled ? 'Capture cancelled' : 'Capture stopped' } : undefined);

    if (!stopped)
        return { ok: true };

    await markDocumentPartial(job.documentId, { code: 'interrupted', message: `Capture stopped before completion: ${error}` });
    await chrome.action.setBadgeText({ tabId: job.tabId, text: '!' }).catch(() => { });
    await notifyChanged();

    return { ok: true };
}

export async function cancelJob(id: string): Promise<void> {
    const job = await getJob(id);

    if (!job || !isActiveJob(job.status))
        return;

    const stopped = await mutateJob(id, current => isActiveJob(current.status) ? { ...current, status: 'cancelled', updatedAt: now(), message: 'Capture cancelled. Saved checkpoints were retained.' } : undefined);

    if (!stopped)
        return;

    await chrome.tabs.sendMessage(job.tabId, { type: 'offshelf:cancel', jobId: id }).catch(() => { });
    await markDocumentPartial(job.documentId, { code: 'cancelled', message: 'Capture was cancelled. Only the content collected so far was saved.' });
    await notifyChanged();
}
