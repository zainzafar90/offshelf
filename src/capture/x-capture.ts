import type { AssetDescriptor, Section, Snapshot, Warning } from '../core/model';
import { LIMITS } from '../core/model';
import { stableId } from '../core/identity';
import { measureDocument } from '../core/document-text';
import { sleep, now } from '../core/time';
import { canonicalUrl } from '../core/url';
import { getPostIdentity } from './x-identity';
import type { PostIdentity } from './x-identity';
import { postUrl } from './x-posts';
import { collectVisiblePosts, mergePosts } from './x-thread';

export type ThreadOptions = { autoScroll: boolean; maxPasses: number };

function buildThreadSnapshot(identity: PostIdentity, startUrl: string, sections: Map<string, Section>, assets: Map<string, AssetDescriptor>, truncated: boolean, reachedLimit: boolean): Snapshot {
    const ordered = [...sections.values()].sort((a, b) => BigInt(a.id) < BigInt(b.id) ? -1 : 1);
    const selected = sections.get(identity.id);
    const firstParagraph = selected?.blocks.find(block => block.type === 'paragraph');
    const title = firstParagraph?.type === 'paragraph' ? firstParagraph.content.map(part => part.text).join('').slice(0, 110) : `Thread by @${identity.handle}`;
    const warnings: Warning[] = [
        { code: 'thread-unverified', message: 'Thread completeness and reply relationships cannot be verified from the rendered page. Review candidate posts; unrelated replies are excluded conservatively.' },
        { code: 'starting-post', message: 'Only posts encountered on this page were saved. Earlier or hidden continuation posts may be missing.' },
    ];

    if (truncated)
        warnings.push({ code: 'truncated-post', message: 'Some posts displayed a “Show more” control. Check for truncated text.' });

    if (reachedLimit)
        warnings.push({ code: 'capture-limit', message: 'Capture stopped at the configured time, scroll, post, or image limit.' });

    return { document: measureDocument({
            schemaVersion: 1, id: stableId(startUrl), sourceUrl: startUrl, title, author: selected?.author || identity.handle,
            siteName: 'X', kind: 'thread', excerpt: '', capturedAt: now(), updatedAt: now(),
            publishedAt: selected?.publishedAt, sections: ordered, assetIds: [...assets.keys()], warnings,
            completeness: reachedLimit ? 'partial' : 'unverified', wordCount: 0, readingMinutes: 1,
            starred: false, archived: false, read: false, progress: 0, tags: [],
        }), assets: [...assets.values()] };
}

function expandShowMore(page: Document, handle: string): void {
    // Only the inline post-expansion control is clicked; reply buttons and navigation links are never automated.
    const primary = page.querySelector('[data-testid="primaryColumn"]') ?? page;

    for (const button of primary.querySelectorAll<HTMLElement>('[data-testid="tweet-text-show-more-link"]')) {
        const article = button.closest('article[data-testid="tweet"]');
        const url = article ? postUrl(article) : undefined;

        if (url && getPostIdentity(url)?.handle.toLowerCase() === handle.toLowerCase())
            button.click();
    }
}

export async function captureThread(page: Document, source: string, options: ThreadOptions, signal: AbortSignal, checkpoint: (snapshot: Snapshot, message: string) => Promise<void>): Promise<Snapshot> {
    const identity = getPostIdentity(source);

    if (!identity)
        throw new Error('Open a specific X post or thread before saving it.');

    const startUrl = canonicalUrl(source);
    const sections = new Map<string, Section>();
    const assets = new Map<string, AssetDescriptor>();
    const started = Date.now();
    const originalScroll = { x: window.scrollX, y: window.scrollY };
    let truncated = false;
    let reachedLimit = false;
    const collect = () => {
        const batch = collectVisiblePosts(page, identity.handle, identity.id, new Set(sections.keys()));

        reachedLimit ||= mergePosts(sections, assets, batch);
        truncated ||= batch.truncated;
    };
    const snapshot = (): Snapshot => buildThreadSnapshot(identity, startUrl, sections, assets, truncated, reachedLimit);
    const check = () => {
        if (signal.aborted)
            throw new Error('Capture cancelled.');

        if (canonicalUrl(location.href) !== startUrl)
            throw new Error('The source page changed during capture. The last checkpoint was kept.');
    };

    try {
        check();
        collect();

        if (options.autoScroll) {
            for (let i = 0; i < 3 && window.scrollY > 0; i++) {
                check();
                window.scrollBy(0, -window.innerHeight * 0.8);
                await sleep(500);
                collect();
            }
        }

        let idle = 0;
        const passes = options.autoScroll ? options.maxPasses : 1;

        for (let pass = 0; pass < passes; pass++) {
            check();

            if (Date.now() - started > LIMITS.maxCaptureMs || sections.size >= LIMITS.maxPosts || assets.size >= LIMITS.maxAssets) {
                reachedLimit = true;
                break;
            }

            const previous = sections.size;

            expandShowMore(page, identity.handle);
            await sleep(options.autoScroll ? 650 : 150);
            collect();

            if (sections.size)
                await checkpoint(snapshot(), `Collected ${sections.size} post${sections.size === 1 ? '' : 's'} · pass ${pass + 1}`);

            idle = sections.size === previous ? idle + 1 : 0;

            if (!options.autoScroll || idle >= 5)
                break;

            window.scrollBy(0, Math.max(600, window.innerHeight * 0.85));

            if (pass === passes - 1)
                reachedLimit = true;
        }

        if (!sections.has(identity.id))
            throw new Error('The selected post was not found in the rendered page. Open it fully and try again.');

        return snapshot();
    }
    finally {
        window.scrollTo(originalScroll.x, originalScroll.y);
    }
}
