import type { Asset, SavedDocument } from '../core/model';
import { visibleAssets } from '../core/asset-refs';
import { printPageUrl } from '../storage/extension-pages';
import { blobToDataUrl, downloadBlob } from '../storage/file-download';
import { fileName } from './file-name';
import { assetExtension, toMarkdown } from './markdown';
import { toHtml } from './html';
import { createZip } from './zip';
import type { ZipEntry } from './zip';

export async function exportHtml(doc: SavedDocument, assets: Map<string, Asset>): Promise<void> {
    const images = new Map<string, string>();

    for (const id of visibleAssets(doc)) {
        const asset = assets.get(id);

        if (asset?.blob && asset.status === 'saved')
            images.set(id, await blobToDataUrl(asset.blob));
    }

    downloadBlob(new Blob([toHtml(doc, images)], { type: 'text/html;charset=utf-8' }), `${fileName(doc.title)}.html`);
}

export async function exportMarkdownZip(doc: SavedDocument, assets: Map<string, Asset>): Promise<void> {
    const images = new Map<string, string>();
    const entries: ZipEntry[] = [];
    let count = 0;

    for (const id of visibleAssets(doc)) {
        const asset = assets.get(id);

        if (!asset?.blob || asset.status !== 'saved')
            continue;

        const name = `assets/image-${String(++count).padStart(2, '0')}.${assetExtension(asset)}`;

        images.set(id, name);
        entries.push({ name, bytes: new Uint8Array(await asset.blob.arrayBuffer()) });
    }

    entries.unshift({ name: 'article.md', bytes: new TextEncoder().encode(toMarkdown(doc, images)) });
    entries.push({ name: 'README.txt', bytes: new TextEncoder().encode('Open article.md in a Markdown reader with local image support. Keep the assets folder beside it. Only successfully saved images are included. Source links require internet access.\n') });
    downloadBlob(createZip(entries), `${fileName(doc.title)}.zip`);
}

export async function copyMarkdown(doc: SavedDocument, assets: Map<string, Asset>): Promise<void> {
    const images = new Map<string, string>();

    for (const id of visibleAssets(doc)) {
        const asset = assets.get(id);

        if (asset)
            images.set(id, asset.sourceUrl);
    }

    await navigator.clipboard.writeText(toMarkdown(doc, images));
}

export function exportPdf(doc: SavedDocument): void {
    window.open(printPageUrl(doc.id), '_blank', 'noopener');
}
