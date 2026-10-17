import type { Asset, CaptureJob, SavedDocument, Settings, Warning } from '../core/model';
import { now } from '../core/time';
import { validateDocument, validateSettings } from '../core/validate';
import { all, completed, db, get, put, request } from './connection';

export const getDocument = (id: string) => get<SavedDocument>('documents', id);

export const listDocuments = () => all<SavedDocument>('documents');

export const putDocument = (doc: SavedDocument) => put('documents', doc);

export const getAsset = (id: string) => get<Asset>('assets', id);

export const putAsset = (asset: Asset) => put('assets', asset);

export const listAssets = () => all<Asset>('assets');

export const getSettings = async (): Promise<Settings> => validateSettings(await get<unknown>('settings', 'reader'));

export const putSettings = (settings: Settings) => put('settings', validateSettings(settings), 'reader');

export async function updateDocument(id: string, patch: Partial<SavedDocument>): Promise<SavedDocument> {
    const database = await db();
    const tx = database.transaction('documents', 'readwrite');
    const done = completed(tx);
    const old = await request<SavedDocument | undefined>(tx.objectStore('documents').get(id));

    if (!old) {
        tx.abort();
        await done.catch(() => { });
        throw new Error('This document is no longer in your library.');
    }

    let updated: SavedDocument;

    try {
        updated = validateDocument({ ...old, ...patch, id: old.id, sourceUrl: old.sourceUrl, updatedAt: now() });
    }
    catch (error) {
        tx.abort();
        await done.catch(() => { });
        throw error;
    }

    tx.objectStore('documents').put(updated);
    await done;

    return updated;
}

export async function deleteDocument(id: string): Promise<void> {
    const database = await db();
    const tx = database.transaction(['documents', 'assets', 'jobs'], 'readwrite');
    const done = completed(tx);
    const docs = await request<SavedDocument[]>(tx.objectStore('documents').getAll());
    const keepAssets = new Set(docs.filter(doc => doc.id !== id).flatMap(doc => doc.assetIds));
    const removed = docs.find(doc => doc.id === id);

    tx.objectStore('documents').delete(id);

    for (const assetId of removed?.assetIds ?? []) {
        if (!keepAssets.has(assetId))
            tx.objectStore('assets').delete(assetId);
    }

    const jobs = await request<CaptureJob[]>(tx.objectStore('jobs').getAll());

    jobs.filter(job => job.documentId === id).forEach(job => tx.objectStore('jobs').delete(job.id));
    await done;
}

export async function assetsForDocument(doc: SavedDocument): Promise<Map<string, Asset>> {
    const values = await Promise.all(doc.assetIds.map(getAsset));

    return new Map(values.filter((asset): asset is Asset => !!asset).map(asset => [asset.id, asset]));
}

export async function markDocumentPartial(documentId: string, warning: Warning): Promise<void> {
    const doc = await getDocument(documentId);

    if (doc)
        await updateDocument(doc.id, { completeness: 'partial', warnings: [...doc.warnings.filter(item => item.code !== warning.code), warning] });
}
