export type PostIdentity = { handle: string; id: string };

export const isXHost = (host: string): boolean => /^(www\.)?(x|twitter)\.com$/.test(host);

export function getPostIdentity(url: string): PostIdentity | undefined {
    try {
        const parsed = new URL(url);

        if (!isXHost(parsed.hostname))
            return undefined;

        const match = parsed.pathname.match(/^\/([^/]+)\/status\/(\d+)/);

        if (!match)
            return undefined;

        return { handle: match[1], id: match[2] };
    }
    catch {
        return undefined;
    }
}
