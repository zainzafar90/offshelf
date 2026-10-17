import type { AssetDescriptor, Block, Section } from '../core/model';
import { stableId } from '../core/identity';
import { canonicalUrl } from '../core/url';
import { bestImageUrl } from './image-source';
import { normalizeElement } from './normalize';
import { getPostIdentity } from './x-identity';
import type { PostIdentity } from './x-identity';

function insideQuote(element: Element, article: Element): boolean {
    const card = element.closest('[role="link"]:not(a)');

    return !!card && card !== article && article.contains(card);
}

export function postUrl(article: Element): string | undefined {
    // A quoted post renders its own <time> inside a role="link" card nested in the post, often before
    // the post's own timestamp. X also puts role="link" on the post wrapper and on <a> tags, so only
    // non-anchor cards nested inside the post count as quotes.
    const linked = [...article.querySelectorAll('time')]
        .map(time => ({ time, href: time.closest('a')?.href }))
        .filter((item): item is { time: HTMLTimeElement; href: string } => !!item.href && /\/status\/\d+/.test(item.href));

    return (linked.find(({ time }) => !insideQuote(time, article)) ?? linked[0])?.href;
}

function avatarIn(root: Element, keep: (image: Element) => boolean, baseUrl: string): AssetDescriptor | undefined {
    const img = [...root.querySelectorAll<HTMLImageElement>('[data-testid="Tweet-User-Avatar"] img')].find(keep);
    const src = img ? bestImageUrl(img, baseUrl) : undefined;

    if (!src || src.startsWith('data:'))
        return undefined;

    const sourceUrl = src.replace(/_normal(\.\w+)$/, '_bigger$1');

    return { id: stableId(sourceUrl), sourceUrl, alt: '' };
}

export type VisiblePost = { article: Element; url: string; identity: PostIdentity };

export function visiblePosts(page: Document): VisiblePost[] {
    const primary = page.querySelector('[data-testid="primaryColumn"]') ?? page;

    return [...primary.querySelectorAll('article[data-testid="tweet"]')].flatMap(article => {
        if (article.closest('[data-testid="placementTracking"]') || article.querySelector('[data-testid="promotedIndicator"]'))
            return [];

        const url = postUrl(article);
        const identity = url ? getPostIdentity(url) : undefined;

        return url && identity ? [{ article, url, identity }] : [];
    });
}

function quoteCard(article: Element): Element | undefined {
    return [...article.querySelectorAll('[role="link"]:not(a)')].find(card => card.querySelector('[data-testid="User-Name"]'));
}

function postContent(page: Document, root: Element, quote: Element | undefined): HTMLElement {
    const own = (element: Element) => !quote || !quote.contains(element);
    const wrapper = page.createElement('div');
    const [text, ...unmatchedQuotes] = [...root.querySelectorAll('[data-testid="tweetText"]')].filter(own);

    if (text) {
        const p = page.createElement('p');

        p.append(...[...text.childNodes].map(node => node.cloneNode(true)));
        wrapper.append(p);
    }

    if (unmatchedQuotes.length) {
        const blockquote = page.createElement('blockquote');

        unmatchedQuotes.forEach(quoted => {
            const p = page.createElement('p');

            p.textContent = quoted.textContent;
            blockquote.append(p);
        });

        wrapper.append(blockquote);
    }

    [...root.querySelectorAll('[data-testid="tweetPhoto"] img')].filter(own).forEach(image => wrapper.append(image.cloneNode(true)));
    const video = [...root.querySelectorAll('video')].find(own);

    if (video)
        wrapper.append(video.cloneNode(true));

    const link = [...root.querySelectorAll('[data-testid="card.wrapper"] a[href]')].find(own);

    if (link) {
        const p = page.createElement('p');

        p.append(link.cloneNode(true));
        wrapper.append(p);
    }

    return wrapper;
}

function readQuote(page: Document, card: Element, url: string): { block: Block; assets: AssetDescriptor[] } | undefined {
    const normalized = normalizeElement(postContent(page, card, undefined), url);

    if (!normalized.blocks.length)
        return undefined;

    const name = card.querySelector('[data-testid="User-Name"]')?.textContent ?? '';
    const avatar = avatarIn(card, () => true, url);
    const cite = { author: name.split('@')[0]?.trim() || 'Quoted post', handle: [...card.querySelectorAll('[data-testid="User-Name"] *')].map(el => el.textContent?.trim() ?? '').find(t => /^@\w{1,15}$/.test(t))?.slice(1), avatarAssetId: avatar?.id };

    return { block: { type: 'quote', cite, blocks: normalized.blocks }, assets: [...(avatar ? [avatar] : []), ...normalized.assets] };
}

export function readPost(page: Document, { article, url, identity }: VisiblePost, selectedId: string): { section: Section; assets: AssetDescriptor[] } | undefined {
    const card = quoteCard(article);
    const normalized = normalizeElement(postContent(page, article, card), url);
    const quote = card ? readQuote(page, card, url) : undefined;
    const blocks = [...normalized.blocks, ...(quote ? [quote.block] : [])];

    if (!blocks.length)
        return undefined;

    const author = article.querySelector('[data-testid="User-Name"]')?.textContent?.split('@')[0]?.trim() || identity.handle;
    const avatar = avatarIn(article, image => !insideQuote(image, article), url);
    const section: Section = {
        id: identity.id, sourceUrl: canonicalUrl(url), author, handle: identity.handle,
        publishedAt: [...article.querySelectorAll('time')].find(time => !card?.contains(time))?.getAttribute('datetime') || undefined,
        relation: identity.id === selectedId ? 'selected' : 'candidate', avatarAssetId: avatar?.id, blocks,
    };

    return { section, assets: [...(avatar ? [avatar] : []), ...normalized.assets, ...(quote?.assets ?? [])] };
}
