import type { CaptureJob, CaptureMode } from './model';

const CAPTURE_MODES: readonly CaptureMode[] = ['auto', 'article', 'thread', 'selection', 'area'];

export type WorkerRequest =
    | { type: 'offshelf:start'; tabId: number; mode?: CaptureMode }
    | { type: 'offshelf:open-library' }
    | { type: 'offshelf:cancel-job'; jobId: string }
    | { type: 'offshelf:delete'; documentId: string }
    | { type: 'offshelf:retry-images'; documentId: string }
    | { type: 'offshelf:changed' }
    | { type: 'offshelf:checkpoint'; jobId: string; snapshot: unknown; message?: string }
    | { type: 'offshelf:finish'; jobId: string }
    | { type: 'offshelf:capture-error'; jobId: string; error?: string; cancelled: boolean };

export type CaptureRequest = Extract<WorkerRequest, { type: 'offshelf:checkpoint' | 'offshelf:finish' | 'offshelf:capture-error' }>;

export type WorkerReply = {
    'offshelf:start': { job: CaptureJob };
    'offshelf:open-library': object;
    'offshelf:cancel-job': object;
    'offshelf:delete': object;
    'offshelf:retry-images': { job: CaptureJob };
    'offshelf:changed': object;
    'offshelf:checkpoint': object;
    'offshelf:finish': object;
    'offshelf:capture-error': object;
};

type Raw = Record<string, unknown>;

export function hasMessageType(value: unknown): value is { type: string } {
    return typeof value === 'object' && value !== null && typeof (value as Raw).type === 'string';
}

function identifier(value: unknown, message: string): string {
    if (typeof value !== 'string')
        throw new Error(message);

    return value;
}

function optionalString(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
}

function parseStart(raw: Raw): WorkerRequest {
    const { tabId } = raw;
    const mode = raw.mode ?? undefined;

    if (typeof tabId !== 'number' || !Number.isInteger(tabId) || (mode !== undefined && !CAPTURE_MODES.includes(mode as CaptureMode)))
        throw new Error('Invalid capture request.');

    return { type: 'offshelf:start', tabId, mode: mode as CaptureMode | undefined };
}

function parseCapture(raw: Raw, type: CaptureRequest['type']): CaptureRequest {
    const jobId = identifier(raw.jobId, 'Missing capture identifier.');

    if (type === 'offshelf:checkpoint')
        return { type, jobId, snapshot: raw.snapshot, message: optionalString(raw.message) };

    if (type === 'offshelf:finish')
        return { type, jobId };

    return { type, jobId, error: optionalString(raw.error), cancelled: raw.cancelled === true };
}

export function parseWorkerRequest(value: unknown): WorkerRequest {
    if (!hasMessageType(value))
        throw new Error('Unknown Offshelf action.');

    const raw = value as Raw;

    switch (value.type) {
        case 'offshelf:start':
            return parseStart(raw);
        case 'offshelf:open-library':
        case 'offshelf:changed':
            return { type: value.type };
        case 'offshelf:cancel-job':
            return { type: value.type, jobId: identifier(raw.jobId, 'Missing identifier.') };
        case 'offshelf:delete':
        case 'offshelf:retry-images':
            return { type: value.type, documentId: identifier(raw.documentId, 'Missing identifier.') };
        case 'offshelf:checkpoint':
        case 'offshelf:finish':
        case 'offshelf:capture-error':
            return parseCapture(raw, value.type);
        default:
            throw new Error('Unknown Offshelf action.');
    }
}
