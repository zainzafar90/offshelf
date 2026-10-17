import type { DocumentKind, SavedDocument, Snapshot } from '../core/model';
import { LIMITS } from '../core/model';
import { canonicalUrl, hostname, safeUrl } from '../core/url';
import { inlineText, measureDocument } from '../core/document-text';
import { now } from '../core/time';
import { stableId } from '../core/identity';
import { normalizeElement } from './normalize';
import { shouldOmit } from './omit-rules';

const CONTENT = 'article, main, [role="main"], [itemprop="articleBody"], .entry-content, .post-content, .article-content, .article-body, .post-body, #article-body';

function score(element: Element): number {
    const text = element.textContent?.trim() ?? '';

    if (text.length < 140 || shouldOmit(element))
        return -1;

    const links = [...element.querySelectorAll('a')].reduce((sum, node) => sum + (node.textContent?.length ?? 0), 0);
    const paragraphs = element.querySelectorAll('p').length;
    const headings = element.querySelectorAll('h1, h2, h3').length;
    const density = links / Math.max(text.length, 1);
    const semanticBonus = element.matches('article, [itemprop="articleBody"], .entry-content, .post-content, .article-body') ? 1.3 : 1;

    return Math.min(text.length, 100_000) * Math.max(0.05, 1 - density * 1.6) * semanticBonus + paragraphs * 120 + headings * 50;
}

function findArticleRoot(page: Document): Element {
    const candidates = new Set<Element>(page.querySelectorAll(CONTENT));

    if (!candidates.size) {
        page.querySelectorAll('p').forEach(p => {
            if ((p.textContent?.length ?? 0) > 70 && p.parentElement)
                candidates.add(p.parentElement);
        });
    }

    const best = [...candidates].sort((a, b) => score(b) - score(a))[0];

    if (!best || score(best) < 50)
        throw new Error('No clear article was found. Try “Select an area” or highlight the text you want to save.');

    return best;
}

const meta = (page: Document, key: string): string | undefined => page.querySelector<HTMLMetaElement>(`meta[property="${key}"], meta[name="${key}"]`)?.content?.trim();

export function createArticleSnapshot(page: Document, source: string, selected?: Element, kind: DocumentKind = 'article'): Snapshot {
    const sourceUrl = canonicalUrl(source);
    const root = selected ?? findArticleRoot(page);

    if ((root.textContent?.length ?? 0) > LIMITS.maxTextChars)
        throw new Error('The page exceeds the text limit. Capture a smaller area instead.');

    const normalized = normalizeElement(root, sourceUrl);
    let title = root.querySelector('h1')?.textContent?.trim() || meta(page, 'og:title') || page.title || 'Untitled article';

    if (kind === 'selection')
        title = (root.textContent?.trim().replace(/\s+/g, ' ').slice(0, 95) || title);

    const first = normalized.blocks[0];

    if (first?.type === 'heading' && inlineText(first.content).trim() === title.trim())
        normalized.blocks.shift();

    if (!normalized.blocks.length)
        throw new Error('This area contains no readable text or supported images.');

    const date = meta(page, 'article:published_time') || page.querySelector('time[datetime]')?.getAttribute('datetime') || undefined;
    const publishedAt = date && !Number.isNaN(Date.parse(date)) ? new Date(date).toISOString() : undefined;
    const author = meta(page, 'author') || meta(page, 'article:author') || page.querySelector('[rel="author"], [itemprop="author"], .byline')?.textContent?.trim() || '';
    const snapshot: SavedDocument = {
        schemaVersion: 1, id: stableId(sourceUrl + (kind === 'selection' ? `#selection-${stableId(root.textContent ?? '')}` : '')),
        sourceUrl, title: title.slice(0, 500), author: author.slice(0, 200), siteName: meta(page, 'og:site_name') || hostname(sourceUrl), kind,
        excerpt: '', capturedAt: now(), updatedAt: now(), publishedAt,
        sections: [{ id: 'article', sourceUrl, blocks: normalized.blocks }], assetIds: normalized.assets.map(asset => asset.id),
        warnings: [], completeness: 'page-snapshot', wordCount: 0, readingMinutes: 1,
        starred: false, archived: false, read: false, progress: 0, tags: [],
    };
    const embeds = root.querySelectorAll('iframe');

    if (embeds.length) {
        embeds.forEach(frame => {
            const url = safeUrl(frame.getAttribute('src'), sourceUrl);

            if (url)
                snapshot.sections[0].blocks.push({ type: 'embed', url, label: frame.getAttribute('title') || 'Embedded content — open original' });
        });
        snapshot.warnings.push({ code: 'embeds', message: 'Interactive embeds are saved as source links, not offline players.' });
    }

    if (root.querySelector('svg, canvas'))
        snapshot.warnings.push({ code: 'interactive-graphics', message: 'Inline SVG/canvas graphics are not captured. External raster images are preserved.' });

    if (page.querySelector('[class*="paywall"], [id*="paywall"], [data-testid*="paywall"]')) {
        snapshot.completeness = 'partial';
        snapshot.warnings.push({ code: 'paywall', message: 'A paywall marker was detected. Only currently accessible content was saved.' });
    }

    if (normalized.assets.length >= LIMITS.maxAssets)
        snapshot.warnings.push({ code: 'image-limit', message: `The ${LIMITS.maxAssets}-image capture limit was reached.` });

    const measured = measureDocument(snapshot);

    if (measured.wordCount < 100)
        measured.warnings.push({ code: 'short', message: 'Only a small amount of text was found. Check the saved content or select a different area.' });

    return { document: measured, assets: normalized.assets };
}
