import { LIMITS } from '../core/model';

export type ImageFailureKind = 'permission' | 'transient' | 'permanent';

export type ImageFailure =
    | { type: 'timeout' }
    | { type: 'network' }
    | { type: 'http'; status: number }
    | { type: 'invalid' };

const TRANSIENT_STATUSES = new Set([408, 425, 429]);

export function classifyImageFailure(failure: ImageFailure, hasPermission: boolean): ImageFailureKind {
    switch (failure.type) {
        case 'timeout':
            return 'transient';
        case 'network':
            return hasPermission ? 'transient' : 'permission';
        case 'http':
            return TRANSIENT_STATUSES.has(failure.status) || failure.status >= 500 ? 'transient' : 'permanent';
        case 'invalid':
            return 'permanent';
    }
}

export function parseRetryAfterMs(header: string | null): number | undefined {
    if (!header || !/^\d+$/.test(header.trim()))
        return undefined;

    return Math.min(Number(header.trim()) * 1000, LIMITS.retryAfterCapMs);
}

export function retryDelayMs(retry: number, retryAfterMs?: number): number {
    if (retryAfterMs !== undefined)
        return Math.min(retryAfterMs, LIMITS.retryAfterCapMs);

    const table: readonly number[] = LIMITS.imageBackoffMs;

    return table[retry] ?? table.at(-1) ?? 0;
}
