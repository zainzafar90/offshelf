import type { Inline } from '../core/model';
import { safeUrl } from '../core/url';
import { shouldOmit } from './omit-rules';

type Marks = Omit<Inline, 'text'>;

const MARK_KEYS: (keyof Inline)[] = ['bold', 'italic', 'code', 'strike', 'href'];

function mergeInline(parts: Inline[]): Inline[] {
    const merged: Inline[] = [];

    for (const part of parts) {
        if (!part.text)
            continue;

        const prev = merged.at(-1);
        const same = prev && MARK_KEYS.every(key => prev[key] === part[key]);

        if (same)
            prev.text += part.text;
        else
            merged.push({ ...part });
    }

    return merged;
}

export function inlineNodes(nodes: Iterable<Node>, baseUrl: string, marks: Marks = {}, depth = 0): Inline[] {
    if (depth > 40)
        return [];

    const parts: Inline[] = [];

    for (const node of nodes) {
        if (node.nodeType === Node.TEXT_NODE) {
            parts.push({ ...marks, text: (node.textContent ?? '').replace(/[\t\r\n ]+/g, ' ') });
            continue;
        }

        if (!(node instanceof Element) || shouldOmit(node))
            continue;

        const tag = node.tagName;

        if (tag === 'BR') {
            parts.push({ ...marks, text: '\n' });
            continue;
        }

        if (tag === 'IMG') {
            if (/emoji|twemoji/.test((node.getAttribute('class') ?? '') + (node.getAttribute('src') ?? '')))
                parts.push({ ...marks, text: node.getAttribute('alt') ?? '' });

            continue;
        }

        const next: Marks = { ...marks };

        if (tag === 'B' || tag === 'STRONG')
            next.bold = true;

        if (tag === 'I' || tag === 'EM')
            next.italic = true;

        if (tag === 'CODE' || tag === 'KBD')
            next.code = true;

        if (tag === 'S' || tag === 'DEL')
            next.strike = true;

        if (tag === 'A')
            next.href = safeUrl(node.getAttribute('href'), baseUrl);

        parts.push(...inlineNodes(node.childNodes, baseUrl, next, depth + 1));
    }

    return mergeInline(parts);
}
