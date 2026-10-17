import type { Block, SavedDocument, Section } from './model';

export function collectAssetIds(blocks: Block[]): string[] {
    const ids = new Set<string>();
    const walk = (values: Block[]): void => values.forEach(block => {
        if (block.type === 'image')
            ids.add(block.assetId);

        if (block.type === 'embed' && block.posterAssetId)
            ids.add(block.posterAssetId);

        if (block.type === 'quote')
            walk(block.blocks);

        if (block.type === 'list')
            block.items.forEach(walk);
    });

    walk(blocks);

    return [...ids];
}

export function sectionAssetIds(section: Section): string[] {
    const ids = new Set(collectAssetIds(section.blocks));

    if (section.avatarAssetId)
        ids.add(section.avatarAssetId);

    const walk = (values: Block[]): void => values.forEach(block => {
        if (block.type === 'quote') {
            if (block.cite?.avatarAssetId)
                ids.add(block.cite.avatarAssetId);

            walk(block.blocks);
        }

        if (block.type === 'list')
            block.items.forEach(walk);
    });

    walk(section.blocks);

    return [...ids];
}

export function visibleAssets(doc: SavedDocument): Set<string> {
    return new Set(doc.sections.filter(section => !section.excluded).flatMap(section => collectAssetIds(section.blocks)));
}
