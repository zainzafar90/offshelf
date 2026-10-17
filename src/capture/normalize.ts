import type { AssetDescriptor, Block } from '../core/model';
import { LIMITS } from '../core/model';
import { stableId } from '../core/identity';
import { inlineText } from '../core/document-text';
import { imageUrl, safeUrl } from '../core/url';
import { addImage } from './image-source';
import type { ImageContext } from './image-source';
import { inlineNodes } from './inline-content';
import { shouldOmit } from './omit-rules';

const INLINE_TAGS = new Set(['A', 'ABBR', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'DEL', 'CODE', 'KBD', 'SPAN', 'SMALL', 'SUB', 'SUP', 'BR', 'TIME', 'MARK', 'CITE']);

type Context = ImageContext & { blocks: number };

function childrenAsBlocks(root: Element, context: Context, depth = 0): Block[] {
    if (depth > 35)
        return [];

    const blocks: Block[] = [];
    let inline: Node[] = [];
    const append = (block: Block | undefined): void => {
        if (!block)
            return;

        if (++context.blocks > LIMITS.maxBlocks)
            throw new Error('This page is too large to capture safely. Use “Select an area” for a smaller section.');

        blocks.push(block);
    };
    const flush = () => {
        const content = inlineNodes(inline, context.baseUrl);

        if (inlineText(content).trim())
            append({ type: 'paragraph', content });

        inline = [];
    };

    for (const node of root.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
            inline.push(node);
            continue;
        }

        if (!(node instanceof Element) || shouldOmit(node))
            continue;

        const tag = node.tagName;

        if (INLINE_TAGS.has(tag) && !node.querySelector('img, video, table, p, h1, h2, h3')) {
            inline.push(node);
            continue;
        }

        flush();

        if (/^H[1-6]$/.test(tag)) {
            const content = inlineNodes(node.childNodes, context.baseUrl);

            if (inlineText(content).trim())
                append({ type: 'heading', level: Number(tag[1]) as 1 | 2 | 3 | 4 | 5 | 6, content, anchor: `heading-${context.blocks}` });

            continue;
        }

        if (tag === 'IMG') {
            append(addImage(node as HTMLImageElement, context));
            continue;
        }

        if (tag === 'FIGURE') {
            const caption = node.querySelector('figcaption')?.textContent?.trim();
            const figureBlocks = childrenAsBlocks(node, context, depth + 1);

            figureBlocks.forEach(block => {
                if (block.type === 'image' && caption)
                    block.caption = caption;

                blocks.push(block);
            });

            continue;
        }

        if (tag === 'FIGCAPTION')
            continue;

        if (tag === 'BLOCKQUOTE') {
            append({ type: 'quote', blocks: childrenAsBlocks(node, context, depth + 1) });
            continue;
        }

        if (tag === 'UL' || tag === 'OL') {
            const items = [...node.children].filter(child => child.tagName === 'LI').map(item => childrenAsBlocks(item, context, depth + 1)).filter(item => item.length);

            if (items.length)
                append({ type: 'list', ordered: tag === 'OL', start: Math.max(1, parseInt(node.getAttribute('start') ?? '1', 10) || 1), items });

            continue;
        }

        if (tag === 'PRE') {
            const text = (node.textContent ?? '').replace(/^\n|\n$/g, '');
            const language = node.querySelector('code')?.className.match(/language-([\w-]+)/)?.[1];

            if (text.trim())
                append({ type: 'code', text, language });

            continue;
        }

        if (tag === 'TABLE') {
            const rows = [...node.querySelectorAll('tr')].filter(row => row.closest('table') === node).slice(0, 400).map(row => [...row.children].filter(cell => ['TH', 'TD'].includes(cell.tagName)).map(cell => inlineNodes(cell.childNodes, context.baseUrl)));

            if (rows.length)
                append({ type: 'table', rows, header: !!node.querySelector('tr th') });

            continue;
        }

        if (tag === 'VIDEO' || tag === 'AUDIO') {
            const raw = node.getAttribute('src') || node.querySelector('source')?.getAttribute('src');
            const url = safeUrl(raw, context.baseUrl) || context.baseUrl;
            const poster = imageUrl(node.getAttribute('poster'), context.baseUrl);
            let posterAssetId: string | undefined;
            const posterId = poster ? stableId(poster) : undefined;

            if (poster && posterId && (context.assets.has(posterId) || context.assets.size < LIMITS.maxAssets)) {
                posterAssetId = posterId;
                context.assets.set(posterId, { id: posterId, sourceUrl: poster, alt: 'Video preview' });
            }

            append({ type: 'embed', url, label: `${tag === 'VIDEO' ? 'Video' : 'Audio'} — open the original to play`, posterAssetId });
            continue;
        }

        if (tag === 'HR') {
            append({ type: 'rule' });
            continue;
        }

        blocks.push(...childrenAsBlocks(node, context, depth + 1));
    }

    flush();

    return blocks;
}

export function normalizeElement(root: Element, baseUrl: string): { blocks: Block[]; assets: AssetDescriptor[] } {
    const context: Context = { baseUrl, assets: new Map(), blocks: 0 };
    let blocks: Block[];

    if (root.tagName === 'IMG') {
        const block = addImage(root as HTMLImageElement, context);

        blocks = block ? [block] : [];
    }
    else
        blocks = childrenAsBlocks(root, context);

    return { blocks, assets: [...context.assets.values()] };
}
