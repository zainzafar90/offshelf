import type { AssetDescriptor, Section } from '../core/model';
import { LIMITS } from '../core/model';
import { sectionAssetIds } from '../core/asset-refs';
import { readPost, visiblePosts } from './x-posts';
import type { VisiblePost } from './x-posts';

// X unmounts posts far from the viewport, so later passes may not contain the selected post. A pass only
// collects from the selected post or a post already kept, and the thread ends at the first post by
// someone else; the author's replies further down are replies to comments, not thread posts.
function threadPosts(posts: VisiblePost[], targetHandle: string, selectedId: string, known: Set<string>): VisiblePost[] {
    const byAuthor = (post: VisiblePost) => post.identity.handle.toLowerCase() === targetHandle.toLowerCase();
    const selectedIndex = posts.findIndex(post => post.identity.id === selectedId);
    const anchor = selectedIndex >= 0 ? selectedIndex : posts.findIndex(post => known.has(post.identity.id));

    if (anchor < 0)
        return [];

    const before = selectedIndex >= 0 ? posts.slice(0, anchor).filter(byAuthor) : [];
    const after = posts.slice(anchor);
    const end = after.findIndex(post => !byAuthor(post));

    return [...before, ...(end < 0 ? after : after.slice(0, end))];
}

export function collectVisiblePosts(page: Document, targetHandle: string, selectedId: string, known: Set<string> = new Set()): { sections: Section[]; assets: AssetDescriptor[]; truncated: boolean } {
    const sections: Section[] = [];
    const assets = new Map<string, AssetDescriptor>();
    let truncated = false;

    for (const post of threadPosts(visiblePosts(page), targetHandle, selectedId, known)) {
        if (post.article.querySelector('[data-testid="tweet-text-show-more-link"]'))
            truncated = true;

        const read = readPost(page, post, selectedId);

        if (!read)
            continue;

        sections.push(read.section);
        read.assets.forEach(asset => assets.set(asset.id, asset));
    }

    return { sections, assets: [...assets.values()], truncated };
}

export function mergePosts(sections: Map<string, Section>, assets: Map<string, AssetDescriptor>, batch: { sections: Section[]; assets: AssetDescriptor[] }): boolean {
    const offered = new Map(batch.assets.map(asset => [asset.id, asset]));
    let limited = false;

    for (const section of batch.sections) {
        const missing = sectionAssetIds(section).filter(id => !assets.has(id));
        const tooManyPosts = !sections.has(section.id) && sections.size >= LIMITS.maxPosts;

        if (tooManyPosts || assets.size + missing.length > LIMITS.maxAssets || missing.some(id => !offered.has(id))) {
            limited = true;
            continue;
        }

        missing.forEach(id => assets.set(id, offered.get(id)!));
        sections.set(section.id, section);
    }

    return limited;
}
