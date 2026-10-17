import type { Asset } from '../../src/core/model';

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);

    if (className)
        node.className = className;

    if (text !== undefined)
        node.textContent = text;

    return node;
}

export function append<T extends Node>(parent: T, ...children: (Node | string)[]): T {
    children.forEach(child => parent.appendChild(typeof child === 'string' ? document.createTextNode(child) : child));

    return parent;
}

export function button(label: string, action: () => unknown): HTMLButtonElement {
    const node = el('button', 'button', label);

    node.type = 'button';
    node.addEventListener('click', action);

    return node;
}

export class ObjectUrls {
    private urls = new Map<string, string>();
    get(asset: Asset | undefined): string | undefined {
        if (!asset?.blob || asset.status !== 'saved')
            return undefined;

        let url = this.urls.get(asset.id);

        if (!url) {
            url = URL.createObjectURL(asset.blob);
            this.urls.set(asset.id, url);
        }

        return url;
    }
    clear(): void { this.urls.forEach(url => URL.revokeObjectURL(url)); this.urls.clear(); }
}
