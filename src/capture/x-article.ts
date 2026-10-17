import type { Snapshot } from '../core/model';
import { createArticleSnapshot } from './article';

export function findXArticle(page: Document): Element | null {
    return page.querySelector('[data-testid="twitterArticleReadView"], [data-testid="twitterArticleRichTextView"], [data-testid="articleBody"]');
}

export function readXArticle(page: Document, url: string): Snapshot {
    const root = findXArticle(page);

    if (!root)
        throw new Error('The X Article body is not loaded. Open the full article, then capture it again.');

    const snapshot = createArticleSnapshot(page, url, root, 'x-article');

    snapshot.document.warnings.push({ code: 'x-snapshot', message: 'Saved the rendered X Article. Expand any hidden content before capture.' });

    return snapshot;
}
