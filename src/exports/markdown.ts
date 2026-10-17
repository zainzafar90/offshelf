import type { Asset, Block, Inline, SavedDocument } from '../core/model';
import { safeUrl } from '../core/url';

function plain(value: string): string { return value.replace(/\\/g, '\\\\').replace(/([`*_{}\[\]#!|>~])/g, '\\$1').replace(/</g, '&lt;'); }

function linkUrl(value: string): string { return value.replace(/[<>\s]/g, char => encodeURIComponent(char)); }

export function markdownInline(content: Inline[]): string {
    return content.map(part => {
        let value = plain(part.text).replace(/\n/g, '  \n');

        if (part.code) {
            const length = Math.max(0, ...[...part.text.matchAll(/`+/g)].map(match => match[0].length)) + 1;
            const fence = '`'.repeat(length);

            value = `${fence} ${part.text.replace(/\n/g, ' ')} ${fence}`;
        }

        if (part.bold)
            value = `**${value}**`;

        if (part.italic)
            value = `_${value}_`;

        if (part.strike)
            value = `~~${value}~~`;

        const href = safeUrl(part.href);

        if (href)
            value = `[${value}](<${linkUrl(href)}>)`;

        return value;
    }).join('');
}

const EXTENSIONS: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/avif': 'avif', 'image/bmp': 'bmp' };

export function assetExtension(asset: Asset): string {
    return EXTENSIONS[asset.mime ?? ''] || 'img';
}

function markdownBlocks(blocks: Block[], images: Map<string, string>): string {
    return blocks.map(block => {
        if (block.type === 'paragraph')
            return markdownInline(block.content);

        if (block.type === 'heading')
            return `${'#'.repeat(block.level)} ${markdownInline(block.content)}`;

        if (block.type === 'image') {
            const src = images.get(block.assetId);

            if (!src)
                return `> Image not saved${block.alt ? `: ${plain(block.alt)}` : '.'}`;

            const caption = block.caption ? `\n\n_${plain(block.caption)}_` : '';

            return `![${plain(block.alt)}](<${linkUrl(src)}>)${caption}`;
        }

        if (block.type === 'quote') {
            const cite = block.cite ? `**${plain(block.cite.author)}**${block.cite.handle ? ` @${plain(block.cite.handle)}` : ''}\n\n` : '';

            return (cite + markdownBlocks(block.blocks, images)).split('\n').map(line => `> ${line}`).join('\n');
        }

        if (block.type === 'list') {
            return block.items.map((item, index) => {
                const marker = block.ordered ? `${block.start + index}. ` : '- ';
                const lines = markdownBlocks(item, images).split('\n');

                return `${marker}${lines[0] ?? ''}\n${lines.slice(1).map(line => `${' '.repeat(marker.length)}${line}`).join('\n')}`.trimEnd();
            }).join('\n');
        }

        if (block.type === 'code') {
            const width = Math.max(2, ...[...block.text.matchAll(/`+/g)].map(match => match[0].length)) + 1;
            const fence = '`'.repeat(width);

            return `${fence}${(block.language ?? '').replace(/[^\w+-]/g, '')}\n${block.text}\n${fence}`;
        }

        if (block.type === 'table') {
            const count = Math.max(1, ...block.rows.map(row => row.length));
            const rowString = (row: Inline[][]) => `| ${Array.from({ length: count }, (_, i) => markdownInline(row[i] ?? []).replace(/\n/g, '<br>')).join(' | ')} |`;
            const header = block.header ? block.rows[0] ?? [] : [];
            const body = block.header ? block.rows.slice(1) : block.rows;

            return [rowString(header), `| ${Array(count).fill('---').join(' | ')} |`, ...body.map(rowString)].join('\n');
        }

        if (block.type === 'embed')
            return `[${plain(block.label)}](<${linkUrl(safeUrl(block.url) || '#')}>)`;

        return '---';
    }).filter(Boolean).join('\n\n');
}

export function toMarkdown(doc: SavedDocument, images: Map<string, string>): string {
    const metadata = { title: doc.title, author: doc.author, source: doc.sourceUrl, captured_at: doc.capturedAt, type: doc.kind, capture_status: doc.completeness };
    const frontmatter = Object.entries(metadata).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n');
    const warnings = doc.warnings.map(warning => `> Capture note: ${plain(warning.message)}`).join('\n>\n');
    const sections = doc.sections.filter(section => !section.excluded).map((section, index) => {
        const body = markdownBlocks(section.blocks, images);

        if (doc.kind !== 'thread')
            return body;

        const attribution = `[Post ${index + 1}](<${linkUrl(section.sourceUrl)}>) · ${plain(section.author || doc.author)}${section.handle ? ` (@${plain(section.handle)})` : ''}${section.publishedAt ? ` · ${section.publishedAt}` : ''}`;

        return `${attribution}\n\n${body}`;
    }).join('\n\n---\n\n');

    return `---\n${frontmatter}\n---\n\n# ${plain(doc.title)}\n\n${warnings ? `${warnings}\n\n` : ''}${sections}\n\n---\n\n[Original source](<${linkUrl(doc.sourceUrl)}>) · Saved with Offshelf\n`;
}
