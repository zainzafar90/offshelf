export function safeUrl(value: string | null | undefined, base?: string): string | undefined {
    if (!value)
        return undefined;

    try {
        const url = new URL(value, base);

        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
            return undefined;

        return url.href;
    }
    catch {
        return undefined;
    }
}

export function imageUrl(value: string | null | undefined, base?: string): string | undefined {
    if (value?.startsWith('data:') && /^data:image\/(?:png|jpe?g|gif|webp|avif|bmp);base64,[a-z\d+/=\s]+$/i.test(value))
        return value;

    return safeUrl(value, base);
}

export function canonicalUrl(value: string): string {
    const url = new URL(value);

    url.hash = '';

    if (/^(www\.)?(twitter|x)\.com$/.test(url.hostname)) {
        url.hostname = 'x.com';
        const post = url.pathname.match(/^\/([^/]+)\/status\/(\d+)/);

        if (post)
            url.pathname = `/${post[1]}/status/${post[2]}`;

        url.search = '';
    }

    for (const key of [...url.searchParams.keys()]) {
        if (/^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$)/i.test(key))
            url.searchParams.delete(key);
    }

    return url.href;
}

export function hostname(value: string): string {
    try {
        return new URL(value).hostname.replace(/^www\./, '');
    }
    catch {
        return 'Saved locally';
    }
}

export function originPattern(url: string): string | undefined {
    const safe = safeUrl(url);

    if (!safe)
        return undefined;

    const parsed = new URL(safe);

    return `${parsed.protocol}//${parsed.hostname}/*`;
}
