import { DEFAULT_SETTINGS, LIMITS, SETTING_RANGES } from '../core/model';
import type { AssetDescriptor, Block, Completeness, DocumentKind, Inline, QuoteCite, SavedDocument, Section, Settings, Snapshot } from '../core/model';
import { sectionAssetIds } from './asset-refs';
import { measureDocument } from './document-text';
import { stableId } from './identity';
import { clamp } from './number-range';
import { imageUrl, safeUrl } from './url';

type Raw = Record<string, unknown>;

type Budget = { blocks: number; chars: number };

const KINDS: DocumentKind[] = ['article', 'thread', 'x-article', 'selection'];
const COMPLETENESS: Completeness[] = ['page-snapshot', 'partial'];

function object(value: unknown): Raw {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('Invalid document structure.');

    return value as Raw;
}

function text(value: unknown, max = 600_000): string {
    if (typeof value !== 'string' || value.length > max)
        throw new Error('Invalid or oversized text field.');

    return value;
}

function optionalText(value: unknown, max = 500): string | undefined { return value === undefined ? undefined : text(value, max); }

function array(value: unknown, max: number): unknown[] {
    if (!Array.isArray(value) || value.length > max)
        throw new Error('Invalid or oversized document collection.');

    return value;
}

function url(value: unknown): string {
    const checked = safeUrl(text(value, 20_000));

    if (!checked)
        throw new Error('The document contains an unsafe source URL.');

    return checked;
}

function inline(value: unknown): Inline[] {
    return array(value, 12_000).map(raw => {
        const part = object(raw);

        return { text: text(part.text), bold: part.bold === true, italic: part.italic === true, code: part.code === true,
            strike: part.strike === true, href: typeof part.href === 'string' ? safeUrl(part.href) : undefined };
    });
}

function cite(value: unknown): QuoteCite {
    const raw = object(value);

    return { author: text(raw.author, 500), handle: optionalText(raw.handle, 100), avatarAssetId: optionalText(raw.avatarAssetId, 100) };
}

function spendChars(budget: Budget, count: number): void {
    budget.chars += count;

    if (budget.chars > LIMITS.maxTextChars)
        throw new Error('Document text limit exceeded.');
}

function blocks(value: unknown, budget: Budget, depth = 0): Block[] {
    if (depth > 35)
        throw new Error('Document nesting limit exceeded.');

    return array(value, LIMITS.maxBlocks).map((raw): Block => {
        if (++budget.blocks > LIMITS.maxBlocks)
            throw new Error('Document block limit exceeded.');

        const block = object(raw);
        const type = text(block.type, 30);

        if (type === 'paragraph' || type === 'heading') {
            const content = inline(block.content);

            spendChars(budget, content.reduce((sum, part) => sum + part.text.length, 0));

            if (type === 'paragraph')
                return { type, content };

            const level = Number(block.level);

            if (!Number.isInteger(level) || level < 1 || level > 6)
                throw new Error('Invalid heading.');

            return { type, content, level: level as 1 | 2 | 3 | 4 | 5 | 6, anchor: text(block.anchor, 200).replace(/[^\w-]/g, '') };
        }

        if (type === 'image')
            return { type, assetId: text(block.assetId, 100), alt: text(block.alt, 5000), caption: optionalText(block.caption, 10_000) };

        if (type === 'quote')
            return { type, blocks: blocks(block.blocks, budget, depth + 1), cite: block.cite === undefined ? undefined : cite(block.cite) };

        if (type === 'list')
            return { type, ordered: block.ordered === true, start: Math.min(100_000, Math.max(1, Number(block.start) || 1)), items: array(block.items, 1000).map(item => blocks(item, budget, depth + 1)) };

        if (type === 'code') {
            const code = text(block.text);

            spendChars(budget, code.length);

            return { type, text: code, language: optionalText(block.language, 100) };
        }

        if (type === 'table') {
            const rows = array(block.rows, 400).map(row => array(row, 100).map(cell => inline(cell)));

            spendChars(budget, rows.flat(2).reduce((sum, item) => sum + item.text.length, 0));

            return { type, rows, header: block.header === true };
        }

        if (type === 'embed')
            return { type, url: url(block.url), label: text(block.label, 5000), posterAssetId: optionalText(block.posterAssetId, 100) };

        if (type === 'rule')
            return { type };

        throw new Error(`Unsupported content block: ${type}`);
    });
}

export function validateDocument(value: unknown): SavedDocument {
    const doc = object(value);

    if (doc.schemaVersion !== 1)
        throw new Error('This document version is not supported.');

    if (!KINDS.includes(String(doc.kind) as DocumentKind))
        throw new Error('Unsupported source type.');

    const budget: Budget = { blocks: 0, chars: 0 };
    const sections = array(doc.sections, LIMITS.maxPosts).map((raw): Section => {
        const section = object(raw);

        return { id: text(section.id, 200), sourceUrl: url(section.sourceUrl), author: optionalText(section.author, 500),
            handle: optionalText(section.handle, 100), publishedAt: optionalText(section.publishedAt, 100),
            relation: section.relation === 'selected' ? 'selected' : 'candidate', excluded: section.excluded === true,
            avatarAssetId: optionalText(section.avatarAssetId, 100), blocks: blocks(section.blocks, budget) };
    });
    const sourceUrl = url(doc.sourceUrl);
    const capturedAt = text(doc.capturedAt, 100);
    const updatedAt = text(doc.updatedAt, 100);

    if (Number.isNaN(Date.parse(capturedAt)) || Number.isNaN(Date.parse(updatedAt)))
        throw new Error('Invalid capture date.');

    const assetIds = array(doc.assetIds, LIMITS.maxAssets).map(id => text(id, 100));
    const declared = new Set(assetIds);

    if (declared.size !== assetIds.length || sections.some(section => sectionAssetIds(section).some(id => !declared.has(id))))
        throw new Error('Document contains an undeclared image reference.');

    const completeness: Completeness = COMPLETENESS.find(value => value === doc.completeness) ?? 'unverified';

    return measureDocument({
        schemaVersion: 1, id: text(doc.id, 100), sourceUrl, title: text(doc.title, 500), author: text(doc.author, 500),
        siteName: text(doc.siteName, 500), kind: doc.kind as DocumentKind, excerpt: '', capturedAt, updatedAt,
        publishedAt: optionalText(doc.publishedAt, 100), sections,
        assetIds,
        warnings: array(doc.warnings, 100).map(raw => {
            const warning = object(raw);

            return { code: text(warning.code, 100), message: text(warning.message, 2000) };
        }),
        completeness,
        wordCount: 0, readingMinutes: 1, starred: doc.starred === true, archived: doc.archived === true, read: doc.read === true,
        progress: Math.min(1, Math.max(0, Number(doc.progress) || 0)), tags: array(doc.tags, 30).map(tag => text(tag, 80)),
    });
}

export function validateSnapshot(value: unknown, expectedUrl: string): Snapshot {
    const snapshot = object(value);
    const doc = validateDocument(snapshot.document);

    if (doc.sourceUrl !== expectedUrl)
        throw new Error('Capture source does not match the authorized tab.');

    if (doc.kind !== 'selection' && doc.id !== stableId(expectedUrl))
        throw new Error('Invalid document identifier.');

    const assets = array(snapshot.assets, LIMITS.maxAssets).map((raw): AssetDescriptor => {
        const asset = object(raw);
        const source = text(asset.sourceUrl, LIMITS.maxAssetBytes * 1.5);
        const checked = imageUrl(source);

        if (!checked || asset.id !== stableId(checked))
            throw new Error('Invalid image descriptor.');

        return { id: text(asset.id, 100), sourceUrl: checked, alt: text(asset.alt, 5000) };
    });
    const ids = new Set(assets.map(asset => asset.id));

    if (ids.size !== assets.length || doc.assetIds.some(id => !ids.has(id)))
        throw new Error('Image manifest is inconsistent.');

    return { document: doc, assets };
}

function choice<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
    return allowed.includes(value as T) ? value as T : fallback;
}

function flag(value: unknown, fallback: boolean): boolean { return typeof value === 'boolean' ? value : fallback; }

function ranged(value: unknown, range: { min: number; max: number }, fallback: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value))
        return fallback;

    return clamp(Math.round(value), range.min, range.max);
}

export function validateSettings(value: unknown): Settings {
    const raw: Raw = value && typeof value === 'object' && !Array.isArray(value) ? value as Raw : {};
    const base = DEFAULT_SETTINGS;

    return {
        theme: choice(raw.theme, ['light', 'dark', 'system'], base.theme),
        readerFont: choice(raw.readerFont, ['serif', 'sans'], base.readerFont),
        fontSize: ranged(raw.fontSize, SETTING_RANGES.fontSize, base.fontSize),
        readerWidth: choice(raw.readerWidth, ['comfortable', 'wide'], base.readerWidth),
        threadStyle: choice(raw.threadStyle, ['continuous', 'cards'], base.threadStyle),
        autoScroll: flag(raw.autoScroll, base.autoScroll),
        maxPasses: ranged(raw.maxPasses, SETTING_RANGES.maxPasses, base.maxPasses),
        openReader: flag(raw.openReader, base.openReader),
    };
}
