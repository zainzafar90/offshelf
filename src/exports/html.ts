import type { Block, Inline, SavedDocument } from '../core/model';
import { dateLabel } from '../core/format';
import { escapeHtml as e } from './html-escape';
import { safeUrl } from '../core/url';

export const EXPORT_CSS = `
:root{color-scheme:light}*{box-sizing:border-box}html{background:#fff;color:#252c29;font-family:Georgia,'Times New Roman',serif}body{margin:0 auto;padding:64px 30px;max-width:820px;font-size:19px;line-height:1.8}h1,h2,h3,h4{line-height:1.25;color:#1d2922}h1{font-size:44px;letter-spacing:-1.3px;margin:20px 0}h2{font-size:29px;margin-top:42px}h3{font-size:23px}p{margin:0 0 23px}a{color:#355f4a;text-underline-offset:3px;overflow-wrap:anywhere}figure{margin:32px 0;break-inside:avoid}img{max-width:100%;max-height:780px;display:block;margin:auto;object-fit:contain;border-radius:5px}figcaption{font:13px/1.6 system-ui;color:#68716b;text-align:center;margin:12px 0}blockquote{margin:25px 0;padding:2px 0 2px 23px;border-left:3px solid #afbcaa;color:#4b554e}blockquote p:last-child{margin-bottom:0}pre{font:14px/1.65 ui-monospace,monospace;background:#f5f5f0;padding:22px;border-radius:8px;white-space:pre-wrap;overflow-wrap:anywhere}code{font:85% ui-monospace,monospace;background:#f2f2ed;padding:2px 4px;border-radius:3px}pre code{padding:0;background:none}table{width:100%;border-collapse:collapse;font:14px/1.6 system-ui;margin:24px 0;table-layout:fixed;overflow-wrap:anywhere}th,td{border:1px solid #ddd;padding:10px;text-align:left;vertical-align:top}th{background:#f5f6f2}li{padding-left:4px}li p{margin:5px 0}hr{border:0;border-top:1px solid #e4e7e0;margin:40px 0}.metadata,.post-meta,.quote-meta,.footer{font:12px/1.7 system-ui;color:#72796f}.quote-meta{margin:0 0 8px}.metadata{letter-spacing:.02em}.post-meta{padding-top:26px;margin-top:35px;border-top:1px solid #e2e5dd}.capture-note,.missing-image{font:13px/1.6 system-ui;padding:14px 17px;border:1px solid #e4dcc4;background:#faf8f1;border-radius:7px;margin:18px 0}.footer{border-top:1px solid #ddd;margin-top:60px;padding-top:18px}.print-controls{position:sticky;top:12px;background:#fff;border:1px solid #ddd;padding:12px;margin-bottom:30px;font:14px system-ui;border-radius:8px;display:flex;align-items:center;gap:12px}.print-controls button{font:inherit;border:0;background:#355f4a;color:#fff;border-radius:6px;padding:9px 14px;cursor:pointer}@page{size:auto;margin:19mm 17mm}@media print{body{max-width:none;padding:0;font-size:12pt}h1{font-size:28pt}h2{font-size:19pt}h3{font-size:15pt}h1,h2,h3,h4{break-after:avoid}p{orphans:3;widows:3}img{max-height:210mm}pre,table{font-size:9pt}.print-controls{display:none!important}.post-meta{break-after:avoid}a{color:inherit}figure{break-inside:avoid}blockquote{break-inside:auto}.capture-note{font-size:9pt}}
`;

function htmlInline(parts: Inline[]): string {
    return parts.map(part => {
        let value = e(part.text).replace(/\n/g, '<br>');

        if (part.code)
            value = `<code>${value}</code>`;

        if (part.bold)
            value = `<strong>${value}</strong>`;

        if (part.italic)
            value = `<em>${value}</em>`;

        if (part.strike)
            value = `<s>${value}</s>`;

        const href = safeUrl(part.href);

        if (href)
            value = `<a href="${e(href)}" target="_blank" rel="noopener noreferrer">${value}</a>`;

        return value;
    }).join('');
}

function htmlBlocks(blocks: Block[], images: Map<string, string>): string {
    return blocks.map(block => {
        if (block.type === 'paragraph')
            return `<p>${htmlInline(block.content)}</p>`;

        if (block.type === 'heading')
            return `<h${block.level} id="${e(block.anchor)}">${htmlInline(block.content)}</h${block.level}>`;

        if (block.type === 'image') {
            const src = images.get(block.assetId);

            if (!src)
                return `<div class="missing-image">Image unavailable${block.alt ? `: ${e(block.alt)}` : '.'}</div>`;

            // Only renderer-created data/blob URLs or package-relative asset paths may become image sources.
            if (!/^(data:image\/(png|jpeg|gif|webp|avif|bmp);base64,|blob:|assets\/)/.test(src))
                return '<div class="missing-image">Image not stored offline.</div>';

            return `<figure><img src="${e(src)}" alt="${e(block.alt)}">${block.caption ? `<figcaption>${e(block.caption)}</figcaption>` : ''}</figure>`;
        }

        if (block.type === 'quote')
            return `<blockquote>${block.cite ? `<p class="quote-meta"><b>${e(block.cite.author)}</b>${block.cite.handle ? ` @${e(block.cite.handle)}` : ''}</p>` : ''}${htmlBlocks(block.blocks, images)}</blockquote>`;

        if (block.type === 'list') {
            const tag = block.ordered ? 'ol' : 'ul';

            return `<${tag}${block.ordered ? ` start="${block.start}"` : ''}>${block.items.map(item => `<li>${htmlBlocks(item, images)}</li>`).join('')}</${tag}>`;
        }

        if (block.type === 'code')
            return `<pre><code>${e(block.text)}</code></pre>`;

        if (block.type === 'table')
            return `<table>${block.rows.map((row, index) => `<tr>${row.map(cell => {
                const tag = block.header && index === 0 ? 'th' : 'td';

                return `<${tag}>${htmlInline(cell)}</${tag}>`;
            }).join('')}</tr>`).join('')}</table>`;

        if (block.type === 'embed') {
            const url = safeUrl(block.url);

            return url ? `<p><a href="${e(url)}" target="_blank" rel="noopener noreferrer">${e(block.label)} ↗</a></p>` : `<p>${e(block.label)}</p>`;
        }

        return '<hr>';
    }).join('\n');
}

export function htmlBody(doc: SavedDocument, images: Map<string, string>): string {
    const sections = doc.sections.filter(section => !section.excluded).map((section, index) => {
        const meta = doc.kind === 'thread' ? `<div class="post-meta">POST ${index + 1} · ${e(section.author || doc.author)} ${section.handle ? `@${e(section.handle)}` : ''} · <a href="${e(section.sourceUrl)}" target="_blank" rel="noopener noreferrer">Original post</a>${section.publishedAt ? ` · ${e(dateLabel(section.publishedAt))}` : ''}</div>` : '';

        return `<section>${meta}${htmlBlocks(section.blocks, images)}</section>`;
    }).join('\n');

    return `<header><div class="metadata">${e(doc.siteName)} · ${doc.readingMinutes} MIN READ · SAVED ${e(dateLabel(doc.capturedAt))}</div><h1>${e(doc.title)}</h1>${doc.author ? `<p class="metadata">By ${e(doc.author)}</p>` : ''}</header>${doc.warnings.map(warning => `<div class="capture-note">${e(warning.message)}</div>`).join('')}<main>${sections}</main><footer class="footer">Saved with Offshelf. <a href="${e(doc.sourceUrl)}" target="_blank" rel="noopener noreferrer">Original source</a><br>Capture: ${e(doc.completeness)} · ${e(doc.capturedAt)}</footer>`;
}

export function toHtml(doc: SavedDocument, images: Map<string, string>): string {
    return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><meta name="referrer" content="no-referrer"><title>${e(doc.title)}</title><style>${EXPORT_CSS}</style></head><body>${htmlBody(doc, images)}</body></html>`;
}
