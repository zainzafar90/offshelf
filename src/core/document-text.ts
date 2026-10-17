import type { Block, Inline, SavedDocument } from './model';

export const inlineText = (content: Inline[]): string => content.map(part => part.text).join('');

export function blocksText(blocks: Block[]): string {
    return blocks.map(block => {
        if (block.type === 'paragraph' || block.type === 'heading')
            return inlineText(block.content);

        if (block.type === 'code')
            return block.text;

        if (block.type === 'quote')
            return blocksText(block.blocks);

        if (block.type === 'list')
            return block.items.map(blocksText).join('\n');

        if (block.type === 'table')
            return block.rows.map(row => row.map(inlineText).join('\t')).join('\n');

        if (block.type === 'image')
            return block.caption ?? block.alt;

        if (block.type === 'embed')
            return block.label;

        return '';
    }).join('\n\n');
}

export function documentText(doc: SavedDocument): string {
    return doc.sections.filter(section => !section.excluded).map(section => blocksText(section.blocks)).join('\n\n');
}

export function measureDocument(doc: SavedDocument): SavedDocument {
    const text = documentText(doc);
    const count = text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)?.length ?? 0;

    return { ...doc, wordCount: count, readingMinutes: Math.max(1, Math.ceil(count / 220)), excerpt: text.replace(/\s+/g, ' ').slice(0, 230) };
}
