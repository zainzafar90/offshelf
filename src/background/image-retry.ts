import type { Asset } from '../core/model';
import { LIMITS } from '../core/model';
import { createHostGate, hostKey } from './host-gate';
import { fetchImage } from './image-fetch';
import type { ImageAttempt } from './image-fetch';
import { retryDelayMs } from './image-failure';

export type RetryDeps = { isActive: () => Promise<boolean>; sleep?: (ms: number) => Promise<void> };

const hostGate = createHostGate(LIMITS.maxRequestsPerHost);
const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

async function attemptOnce(asset: Asset): Promise<ImageAttempt> {
    const host = hostKey(asset.sourceUrl);
    const release = host ? await hostGate.acquire(host) : undefined;

    try {
        return await fetchImage(asset);
    }
    finally {
        release?.();
    }
}

/* Resolves undefined when the job stopped mid-retry. */
export async function downloadWithRetry(asset: Asset, { isActive, sleep = wait }: RetryDeps): Promise<Asset | undefined> {
    let attempt = await attemptOnce(asset);

    for (let retry = 0; attempt.failure === 'transient' && retry < LIMITS.imageRetries; retry++) {
        if (!await isActive())
            return undefined;

        await sleep(retryDelayMs(retry, attempt.retryAfterMs));

        if (!await isActive())
            return undefined;

        attempt = await attemptOnce(attempt.asset);
    }

    return attempt.asset;
}
