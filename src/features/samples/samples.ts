import type { Block, SavedDocument } from '../../core/model';
import { measureDocument } from '../../core/document-text';
import { now } from '../../core/time';
import { stableId } from '../../core/identity';
import { validateDocument } from '../../core/validate';
import { extensionUrl } from '../../storage/extension-pages';
import { getDocument, putAsset, putDocument } from '../../storage/library-store';

const saveSample = (doc: SavedDocument): Promise<void> => putDocument(validateDocument(doc));

export async function addSamples() {
    const sourceUrl = 'https://example.com/offshelf-sample';
    const imageSource = 'https://example.com/offshelf-sample-cover.png';
    const assetId = stableId(imageSource);
    const response = await fetch(extensionUrl('sample-cover.png'));

    if (!response.ok)
        throw new Error(`The sample cover image could not be loaded (HTTP ${response.status}).`);

    const image = await response.blob();

    await putAsset({ id: assetId, sourceUrl: imageSource, alt: 'An abstract illustration of collected pages', status: 'saved', blob: image, bytes: image.size, mime: 'image/png', attempts: 0, updatedAt: now() });
    const doc = measureDocument({
        schemaVersion: 1, id: stableId(sourceUrl), sourceUrl, title: 'The internet is a library. Make a little room for yours.',
        author: 'The Offshelf guide', siteName: 'Offshelf · bundled sample', kind: 'article', excerpt: '', capturedAt: now(), updatedAt: now(),
        sections: [{ id: 'sample', sourceUrl, blocks: [
                    { type: 'paragraph', content: [{ text: 'Some things deserve more than an open tab. The essay you want to sit with. The thread that finally explained it. The diagram you know you’ll need again.' }] },
                    { type: 'paragraph', content: [{ text: 'Offshelf is a small, quiet place for those things. Save a page once, keep its images beside the words, and come back when you have the space to read.' }] },
                    { type: 'image', assetId, alt: 'Collected pages, arranged in a quiet editorial composition', caption: 'A place for the things worth coming back to. Illustration bundled with this sample.' },
                    { type: 'heading', level: 2, anchor: 'capture', content: [{ text: 'From a busy page to a clear read' }] },
                    { type: 'paragraph', content: [{ text: 'Open an article or a specific X post. Click the Offshelf icon in your toolbar, then choose Save this page. You can also use ' }, { text: 'Alt + Shift + S', code: true }, { text: '. The work continues even after you close the popup.' }] },
                    { type: 'quote', blocks: [{ type: 'paragraph', content: [{ text: 'A saved link is a promise to come back. A saved page gives you something to come back to.' }] }] },
                    { type: 'heading', level: 2, anchor: 'offline', content: [{ text: 'Keep the picture with the story' }] },
                    { type: 'paragraph', content: [{ text: 'Images are downloaded and stored in this browser, not quietly loaded from the web every time you read. When an image cannot be saved, you’ll see that clearly. A permission request is limited to the image host you choose to allow.' }] },
                    { type: 'heading', level: 2, anchor: 'export', content: [{ text: 'Your reading, in your format' }] },
                    { type: 'list', ordered: false, start: 1, items: [
                            [{ type: 'paragraph', content: [{ text: 'HTML', bold: true }, { text: ' is a single offline file with its images embedded.' }] }],
                            [{ type: 'paragraph', content: [{ text: 'Markdown', bold: true }, { text: ' is a ZIP containing article.md and an assets folder.' }] }],
                            [{ type: 'paragraph', content: [{ text: 'PDF', bold: true }, { text: ' uses Chrome’s print layout. Choose Save as PDF in the print dialog.' }] }],
                        ] },
                    { type: 'paragraph', content: [{ text: 'This is an original, bundled example—not an article captured from a live website. Delete it whenever you’re ready to make this space your own.', italic: true }] },
                ] }],
        assetIds: [assetId], warnings: [], completeness: 'page-snapshot', wordCount: 0, readingMinutes: 1,
        starred: true, archived: false, read: false, progress: 0, tags: ['Sample', 'Reading'],
    });

    if (!await getDocument(doc.id))
        await saveSample(doc);

    const threadSource = 'https://example.com/offshelf-thread-sample';
    const thread = measureDocument({
        ...doc, id: stableId(threadSource), sourceUrl: threadSource, title: 'A thread, without the endless scrolling.',
        kind: 'thread', author: 'Offshelf', siteName: 'Offshelf · bundled sample', assetIds: [], starred: false, tags: ['Sample'],
        completeness: 'unverified', warnings: [{ code: 'sample-thread', message: 'This bundled sample shows the thread reader. Live X captures always need a completeness check.' }],
        sections: [
            { id: '1', sourceUrl: threadSource, author: 'Offshelf', handle: 'offshelf_example', relation: 'selected', blocks: [{ type: 'paragraph', content: [{ text: '01 / A good thread should read like a good conversation. Save the posts together, keep their order, and leave the surrounding noise behind.' }] }] },
            { id: '2', sourceUrl: threadSource, author: 'Offshelf', handle: 'offshelf_example', relation: 'candidate', blocks: [{ type: 'paragraph', content: [{ text: '02 / The reader can’t prove a thread is complete just because scrolling stopped. Candidate posts are labeled, and the Review posts control lets you exclude anything that doesn’t belong.' }] }] },
            { id: '3', sourceUrl: threadSource, author: 'Offshelf', handle: 'offshelf_example', relation: 'candidate', blocks: [{ type: 'paragraph', content: [{ text: '03 / Prefer the original rhythm? Open Appearance and switch from continuous reading to individual post cards. It’s the same saved content, in a different layout.' }] }] },
        ],
    });

    if (!await getDocument(thread.id))
        await saveSample(thread);

    const notes = [
        { slug: 'design', title: 'Good interfaces leave room to think.', topic: 'Design', paragraphs: [
                'The most useful part of a reading interface is often the part you do not notice. A clear title, a comfortable line length, and a way back to your library are usually enough.',
                'Keep the page for the content. Move the settings out of the way, but not out of reach. Let the reader choose the text size instead of assuming one comfortable size fits everyone.',
                'A little structure helps a long document feel less demanding. An outline can show where you are without turning the whole experience into a dashboard.',
            ] },
        { slug: 'local', title: 'A saved link is not a saved page.', topic: 'Reading', paragraphs: [
                'A bookmark keeps an address. A local copy keeps the part you came for: the words, the headings, the diagram, and the explanation underneath it.',
                'When you save a page, check the image status. Text can be available offline while a picture is still waiting for permission or a retry. Those are different states, and the reader should tell you which one you have.',
                'Export a backup before removing the extension or clearing browser data. A library on one device is useful, but it is still only one copy.',
            ] },
        { slug: 'formats', title: 'One good read. Three ways to keep it.', topic: 'Workflow', paragraphs: [
                'Use HTML when you want one portable file with its images inside. Use Markdown when you want plain text that can live alongside your own notes.',
                'The Markdown ZIP includes an assets folder. Keep it beside the Markdown document so relative image references still work when you move the archive.',
                'Use the PDF action for a printed-page layout. It opens the browser print dialog, where you can choose Save as PDF and review the page breaks before saving.',
            ] },
        { slug: 'threads', title: 'Keep the conversation. Leave the feed.', topic: 'Threads', paragraphs: [
                'The starting post is only the beginning. A useful thread capture keeps connected posts in order, preserves their images, and makes it easy to return to the original.',
                'A scrolling page does not give a reliable guarantee that a thread is complete. Review the captured candidates, remove unrelated posts, and keep the completeness warning in mind.',
                'Use continuous reading for a quieter flow. Switch to post cards when you want each contribution to feel separate. The underlying saved content stays the same.',
            ] },
    ];

    for (const [index, note] of notes.entries()) {
        const url = `https://example.com/offshelf-sample-${note.slug}`;
        const id = stableId(url);

        if (await getDocument(id))
            continue;

        const date = new Date(Date.now() - (index + 1) * 86400000).toISOString();
        const paragraphs = note.paragraphs.map((text): Block => ({ type: 'paragraph', content: [{ text }] }));
        const blocks: Block[] = [
            ...paragraphs,
            { type: 'rule' },
            { type: 'paragraph', content: [{ text: 'This is an original Offshelf sample, not a captured article from a live website.', italic: true }] },
        ];

        await saveSample(measureDocument({
            ...doc, id, sourceUrl: url, title: note.title, author: 'The Offshelf guide',
            capturedAt: date, updatedAt: date, assetIds: [], starred: index === 0,
            tags: ['Sample', note.topic], sections: [{ id: 'note', sourceUrl: url, blocks }],
        }));
    }
}
