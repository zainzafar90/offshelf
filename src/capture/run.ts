import type { CaptureJob, Snapshot } from '../core/model';
import { errorMessage } from '../core/errors';
import type { WorkerRequest } from '../core/worker-contract';
import { createArticleSnapshot } from './article';
import { pickArea } from './area-picker';
import { findXArticle, readXArticle } from './x-article';
import { captureThread } from './x-capture';
import { isXHost } from './x-identity';

type CaptureState = { version: string; controllers: Map<string, AbortController> };

type ContentMessage = { type?: string; jobId?: string; job?: CaptureJob };

type WorkerReply = { ok?: boolean; error?: string } | undefined;

declare global {
    interface Window { __offshelfCapture?: CaptureState }
}

export function installCapture(): void {
    const version = chrome.runtime.getManifest().version;

    if (window.__offshelfCapture?.version === version)
        return;

    const state: CaptureState = { version, controllers: new Map() };

    window.__offshelfCapture = state;
    chrome.runtime.onMessage.addListener((message: ContentMessage, sender, reply) => {
        if (sender.id !== chrome.runtime.id)
            return;

        if (message.type === 'offshelf:ping') {
            reply({ ok: true });

            return;
        }

        if (message.type === 'offshelf:cancel') {
            state.controllers.get(message.jobId ?? '')?.abort();
            reply({ ok: true });

            return;
        }

        if (message.type !== 'offshelf:run' || !message.job || state.controllers.has(message.job.id))
            return;

        const job = message.job;
        const controller = new AbortController();

        state.controllers.set(job.id, controller);
        reply({ ok: true });
        void runCapture(job, controller.signal).finally(() => state.controllers.delete(job.id));
    });
}

async function runCapture(job: CaptureJob, signal: AbortSignal): Promise<void> {
    const checkpoint = async (snapshot: Snapshot, message = 'Text captured'): Promise<void> => {
        const result: WorkerReply = await chrome.runtime.sendMessage({ type: 'offshelf:checkpoint', jobId: job.id, snapshot, message } satisfies WorkerRequest);

        if (!result?.ok)
            throw new Error(result?.error || 'Capture checkpoint could not be saved.');
    };

    try {
        let snapshot: Snapshot;
        const mode = job.options.mode;

        if (mode === 'area') {
            const root = await pickArea(signal);

            snapshot = createArticleSnapshot(document, job.sourceUrl, root, 'selection');
        }
        else if (mode === 'selection') {
            const selection = window.getSelection();

            if (!selection?.rangeCount || selection.isCollapsed)
                throw new Error('Highlight some article text first, or choose “Select an area”.');

            const root = document.createElement('article');

            root.append(selection.getRangeAt(0).cloneContents());
            snapshot = createArticleSnapshot(document, job.sourceUrl, root, 'selection');
        }
        else if (isXHost(location.hostname) && mode !== 'article' && findXArticle(document)) {
            snapshot = readXArticle(document, job.sourceUrl);
        }
        else if (mode === 'thread' || (mode === 'auto' && isXHost(location.hostname))) {
            snapshot = await captureThread(document, job.sourceUrl, job.options, signal, checkpoint);
        }
        else
            snapshot = createArticleSnapshot(document, job.sourceUrl);

        if (signal.aborted)
            throw new Error('Capture cancelled.');

        await checkpoint(snapshot);
        const result: WorkerReply = await chrome.runtime.sendMessage({ type: 'offshelf:finish', jobId: job.id } satisfies WorkerRequest);

        if (!result?.ok)
            throw new Error(result?.error || 'Capture could not be finalized.');
    }
    catch (error) {
        await chrome.runtime.sendMessage({ type: 'offshelf:capture-error', jobId: job.id, error: errorMessage(error), cancelled: signal.aborted } satisfies WorkerRequest).catch(() => { });
    }
}
