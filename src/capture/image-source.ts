import type { AssetDescriptor, Block } from '../core/model';
import { LIMITS } from '../core/model';
import { stableId } from '../core/identity';
import { imageUrl } from '../core/url';

export type ImageContext = { baseUrl: string; assets: Map<string, AssetDescriptor> };

export function bestImageUrl(img: HTMLImageElement, baseUrl: string): string | undefined {
    const lazy = img.getAttribute('data-src') || img.getAttribute('data-original') || img.getAttribute('data-lazy-src');
    const srcset = img.getAttribute('data-srcset') || img.getAttribute('srcset');
    let src = lazy || img.currentSrc || img.getAttribute('src') || '';

    if (srcset && !srcset.includes('data:')) {
        const candidates = srcset.split(',').map(item => {
            const [url, size] = item.trim().split(/\s+/);

            return { url, size: parseFloat(size ?? '1') || 1 };
        }).sort((a, b) => b.size - a.size);

        src = candidates[0]?.url || src;
    }

    const safe = imageUrl(src, baseUrl);

    if (!safe || safe.startsWith('data:'))
        return safe;

    const url = new URL(safe);

    if (url.hostname === 'pbs.twimg.com' && url.pathname.startsWith('/media/'))
        url.searchParams.set('name', 'orig');

    return url.href;
}

export function addImage(img: HTMLImageElement, context: ImageContext, caption?: string): Block | undefined {
    const alt = img.getAttribute('alt')?.trim() ?? '';

    if (/emoji|twemoji/.test((img.className ?? '') + (img.getAttribute('src') ?? '')))
        return undefined;

    if ((img.width > 0 && img.width <= 3) || (img.height > 0 && img.height <= 3))
        return undefined;

    const url = bestImageUrl(img, context.baseUrl);

    if (!url)
        return undefined;

    if (context.assets.size >= LIMITS.maxAssets)
        return undefined;

    const id = stableId(url);

    context.assets.set(id, { id, sourceUrl: url, alt });

    return { type: 'image', assetId: id, alt, caption };
}
