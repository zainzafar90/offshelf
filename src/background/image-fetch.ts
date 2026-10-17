import type { Asset } from '../core/model';
import { LIMITS } from '../core/model';
import { errorMessage } from '../core/errors';
import { sniffImage } from '../core/image-format';
import { now } from '../core/time';
import { originPattern } from '../core/url';
import { classifyImageFailure, parseRetryAfterMs } from './image-failure';
import type { ImageFailure, ImageFailureKind } from './image-failure';

export type ImageAttempt = { asset: Asset; failure?: ImageFailureKind; retryAfterMs?: number };

type TaggedError = Error & { failure: ImageFailure; retryAfterMs?: number };

const TIMEOUT_MESSAGE = 'Image download timed out. You can retry it.';
const PERMISSION_MESSAGE = 'Allow access to this image host to save the image offline.';
const SIZE_MESSAGE = 'This image exceeds the 20 MB limit.';

function tagged(failure: ImageFailure, message: string, retryAfterMs?: number): TaggedError {
    return Object.assign(new Error(message), { failure, retryAfterMs });
}

function isTagged(error: unknown): error is TaggedError {
    return error instanceof Error && 'failure' in error;
}

function isAbort(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';
}

async function hostPermitted(asset: Asset): Promise<boolean> {
    const origin = originPattern(asset.sourceUrl);

    if (!origin)
        return asset.sourceUrl.startsWith('data:');

    try {
        return await chrome.permissions.contains({ origins: [origin] });
    }
    catch (error) {
        console.error('[offshelf] permission check failed', { assetId: asset.id, error: errorMessage(error) });

        return false;
    }
}

async function readImage(url: string, signal: AbortSignal): Promise<Blob> {
    const response = await fetch(url, { signal, credentials: 'omit', redirect: 'follow', referrerPolicy: 'no-referrer' });

    if (!response.ok) {
        await response.body?.cancel().catch(() => { });
        const retryAfterMs = response.status === 429 ? parseRetryAfterMs(response.headers.get('retry-after')) : undefined;

        throw tagged({ type: 'http', status: response.status }, `The image server returned HTTP ${response.status}.`, retryAfterMs);
    }

    if (Number(response.headers.get('content-length')) > LIMITS.maxAssetBytes) {
        await response.body?.cancel().catch(() => { });
        throw tagged({ type: 'invalid' }, SIZE_MESSAGE);
    }

    const reader = response.body?.getReader();

    if (!reader)
        throw tagged({ type: 'invalid' }, 'The image response was empty.');

    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let size = 0;

    while (true) {
        const { done, value } = await reader.read();

        if (done)
            break;

        size += value.byteLength;

        if (size > LIMITS.maxAssetBytes) {
            await reader.cancel();
            throw tagged({ type: 'invalid' }, SIZE_MESSAGE);
        }

        chunks.push(new Uint8Array(value));
    }

    const prefix = new Uint8Array(Math.min(size, 40));
    let offset = 0;

    for (const chunk of chunks) {
        const part = chunk.subarray(0, prefix.length - offset);

        prefix.set(part, offset);
        offset += part.length;

        if (offset === prefix.length)
            break;
    }

    const mime = sniffImage(prefix);

    if (!mime)
        throw tagged({ type: 'invalid' }, 'Unsupported image format. SVG and HTML responses are not saved as executable files.');

    return new Blob(chunks, { type: mime });
}

function failureOf(error: unknown, aborted: boolean): { failure: ImageFailure; message: string; retryAfterMs?: number } {
    if (isTagged(error) && !aborted)
        return { failure: error.failure, message: error.message, retryAfterMs: error.retryAfterMs };

    if (aborted || isAbort(error))
        return { failure: { type: 'timeout' }, message: TIMEOUT_MESSAGE };

    return { failure: { type: 'network' }, message: errorMessage(error) };
}

export async function fetchImage(asset: Asset): Promise<ImageAttempt> {
    const next: Asset = { ...asset, attempts: asset.attempts + 1, updatedAt: now(), error: undefined };
    const hasPermission = await hostPermitted(asset);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LIMITS.fetchTimeoutMs);

    try {
        const blob = await readImage(asset.sourceUrl, controller.signal);

        return { asset: { ...next, status: 'saved', blob, bytes: blob.size, mime: blob.type } };
    }
    catch (error) {
        const { failure, message, retryAfterMs } = failureOf(error, controller.signal.aborted);
        const kind = classifyImageFailure(failure, hasPermission);
        const text = kind === 'permission' ? PERMISSION_MESSAGE : message;

        return { asset: { ...next, status: kind === 'permission' ? 'permission' : 'failed', bytes: 0, blob: undefined, error: text }, failure: kind, retryAfterMs };
    }
    finally {
        clearTimeout(timer);
    }
}

export async function downloadImage(asset: Asset): Promise<Asset> {
    return (await fetchImage(asset)).asset;
}
