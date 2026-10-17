import "../../src/styles/print.css";
import { getDocument, assetsForDocument } from '../../src/storage/library-store';
import { htmlBody, EXPORT_CSS } from '../../src/exports/html';
import { errorMessage } from '../../src/core/errors';
import { append, button, el, ObjectUrls } from './dom';
import { validateDocument } from '../../src/core/validate';

const root = document.getElementById('app')!;

async function main() {
    const id = new URLSearchParams(location.search).get('id');
    const stored = id ? await getDocument(id) : undefined;

    if (!stored)
        throw new Error('This document could not be found in your Offshelf library.');

    const doc = validateDocument(stored);
    const assets = await assetsForDocument(doc);
    const urls = new ObjectUrls();
    const images = new Map<string, string>();

    assets.forEach(asset => {
        const url = urls.get(asset);

        if (url)
            images.set(asset.id, url);
    });

    const style = el('style');

    style.textContent = EXPORT_CSS;
    document.head.append(style);
    document.title = doc.title;
    const controls = el('div', 'print-controls');
    const printButton = button('Print / Save as PDF', () => window.print());

    printButton.disabled = true;
    append(controls, printButton, el('span', '', 'Choose “Save as PDF” as the destination. Text remains selectable.'));
    root.append(controls);
    const body = el('div');

    // htmlBody emits only escaped model fields and renderer-created blob image URLs, never captured HTML.
    body.innerHTML = htmlBody(doc, images);
    root.append(body);
    await Promise.all([...body.querySelectorAll('img')].map(img => img.decode().catch(() => {
        img.replaceWith(el('div', 'missing-image', 'This saved image could not be decoded for printing.'));
    })));
    await document.fonts.ready;
    printButton.disabled = false;
    document.documentElement.dataset.ready = 'true';

    if (new URLSearchParams(location.search).get('print') === '1')
        setTimeout(() => window.print(), 200);

    window.addEventListener('pagehide', () => urls.clear(), { once: true });
}

void main().catch(error => { root.textContent = errorMessage(error); });
