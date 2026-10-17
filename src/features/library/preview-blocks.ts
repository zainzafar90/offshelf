import type { Block, SavedDocument } from "../../core/model";

function previewBlocks(doc: SavedDocument): Block[] {
    const blocks = doc.sections.find(section => !section.excluded)?.blocks ?? [];
    // A library preview is bounded; the full saved document remains in the reader.
    const selected = blocks.slice(0, doc.kind === 'thread' ? 8 : 3);

    if (!selected.some(block => block.type === 'image' || block.type === 'embed')) {
        const media = blocks.find(block => block.type === 'image' || block.type === 'embed');

        if (media)
            selected.push(media);
    }

    return selected;
}

export { previewBlocks };
