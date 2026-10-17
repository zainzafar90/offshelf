import type { WorkerReply, WorkerRequest } from '../core/worker-contract';

const NO_REPLY_MESSAGE = 'The Offshelf background worker did not respond.';

const FAILED_MESSAGE = 'The Offshelf background worker failed.';

type Envelope = { ok: boolean; error?: unknown };

function isEnvelope(value: unknown): value is Envelope {
    return typeof value === 'object' && value !== null && typeof (value as Envelope).ok === 'boolean';
}

export async function sendToWorker<R extends WorkerRequest>(request: R): Promise<WorkerReply[R['type']]> {
    const result: unknown = await chrome.runtime.sendMessage(request);

    if (!isEnvelope(result))
        throw new Error(NO_REPLY_MESSAGE);

    if (!result.ok)
        throw new Error(typeof result.error === 'string' ? result.error : FAILED_MESSAGE);

    return result as WorkerReply[R['type']];
}
