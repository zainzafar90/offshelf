export type HostGate = { acquire: (host: string) => Promise<() => void> };

export function createHostGate(limit: number): HostGate {
    const active = new Map<string, number>();
    const waiting = new Map<string, Array<() => void>>();
    const release = (host: string) => {
        const next = waiting.get(host)?.shift();

        if (next)
            return next();

        active.set(host, (active.get(host) ?? 1) - 1);
    };
    const acquire = async (host: string): Promise<() => void> => {
        if ((active.get(host) ?? 0) >= limit)
            await new Promise<void>(resolve => waiting.set(host, [...(waiting.get(host) ?? []), resolve]));
        else
            active.set(host, (active.get(host) ?? 0) + 1);

        let released = false;

        return () => {
            if (released)
                return;

            released = true;
            release(host);
        };
    };

    return { acquire };
}

export function hostKey(url: string): string | undefined {
    try {
        const parsed = new URL(url);

        return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.hostname : undefined;
    }
    catch {
        return undefined;
    }
}
