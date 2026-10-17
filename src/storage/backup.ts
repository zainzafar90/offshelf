import { LIMITS } from '../core/model';
import type { Asset } from '../core/model';
import { sniffImage } from '../core/image-format';
import { stableId } from '../core/identity';
import { now } from '../core/time';
import { imageUrl } from '../core/url';
import { validateDocument } from '../core/validate';
import { db } from './connection';
import { blobToDataUrl, downloadBlob } from './file-download';
import { listAssets, listDocuments } from './library-store';

type BackupAsset = { id?: unknown; sourceUrl?: unknown; alt?: unknown; data?: unknown } | null;

export const estimateBackupBytes = (imageBytes: number): number => Math.ceil(imageBytes / 3) * 4;

export async function exportBackup(): Promise<void> {
    const documents = await listDocuments();
    const assets = await listAssets();
    const bytes = assets.reduce((sum, asset) => sum + asset.bytes, 0);

    if (estimateBackupBytes(bytes) > LIMITS.maxBackupBytes)
        throw new Error('This library is too large for a single JSON backup. Export documents individually as HTML or Markdown ZIP.');

    const encoded: (Omit<Asset, 'blob'> & { data?: string })[] = [];

    for (const asset of assets) {
        const { blob, ...metadata } = asset;

        encoded.push({ ...metadata, data: blob ? await blobToDataUrl(blob) : undefined });
    }

    const backup = { format: 'offshelf-backup', version: 1, exportedAt: now(), documents, assets: encoded };
    const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });

    if (blob.size > LIMITS.maxBackupBytes)
        throw new Error('This library is too large for a single JSON backup. Export documents individually as HTML or Markdown ZIP.');

    downloadBlob(blob, `offshelf-backup-${new Date().toISOString().slice(0, 10)}.offshelf.json`);
}

export async function importBackup(file: File): Promise<{ added: number; skipped: number }> {
    if (file.size > LIMITS.maxBackupBytes)
        throw new Error('This backup exceeds the 250 MB import limit.');

    const raw = JSON.parse(await file.text()) as { format?: unknown; version?: unknown; documents?: unknown[]; assets?: BackupAsset[] } | null;

    if (raw?.format !== 'offshelf-backup' || raw.version !== 1 || !Array.isArray(raw.documents) || !Array.isArray(raw.assets))
        throw new Error('Select an Offshelf library backup (.offshelf.json).');

    if (raw.documents.length > 5000 || raw.assets.length > 20_000)
        throw new Error('Backup collection limit exceeded.');

    const documents = raw.documents.map(value => validateDocument(value));
    const assets: Asset[] = [];

    for (const item of raw.assets) {
        if (!item || typeof item.sourceUrl !== 'string' || item.sourceUrl.length > 30_000_000 || imageUrl(item.sourceUrl) !== item.sourceUrl || item.id !== stableId(item.sourceUrl))
            throw new Error('The backup contains an invalid image reference.');

        const asset: Asset = { id: item.id as string, sourceUrl: item.sourceUrl, alt: typeof item.alt === 'string' ? item.alt.slice(0, 5000) : '', status: 'failed', bytes: 0, attempts: 0, updatedAt: now(), error: 'Image was not present in the backup.' };

        if (item.data !== undefined) {
            if (typeof item.data !== 'string' || item.data.length > 28_000_000 || !/^data:image\/(png|jpeg|webp|gif|avif|bmp);base64,[a-z\d+/=\r\n]+$/i.test(item.data))
                throw new Error('Unsupported image data in backup.');

            const encoded = item.data.slice(item.data.indexOf(',') + 1);
            const binary = atob(encoded);
            const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
            const mime = sniffImage(bytes);

            if (!mime)
                throw new Error('An image in the backup has an invalid file signature.');

            asset.blob = new Blob([bytes], { type: mime });
            asset.bytes = bytes.length;
            asset.mime = mime;
            asset.status = 'saved';
            asset.error = undefined;
        }

        assets.push(asset);
    }

    const assetIds = new Set(assets.map(asset => asset.id));

    if (documents.some(doc => doc.assetIds.some(id => !assetIds.has(id))))
        throw new Error('The backup image manifest is incomplete.');

    const database = await db();
    const transaction = database.transaction(['documents', 'assets'], 'readwrite');
    const finished = new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onabort = transaction.onerror = () => reject(transaction.error || new Error('Backup import failed.'));
    });
    const read = <T>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const needed = new Set<string>();
    let added = 0, skipped = 0;

    for (const document of documents) {
        if (await read(transaction.objectStore('documents').get(document.id))) {
            skipped++;
            continue;
        }

        transaction.objectStore('documents').put(document);
        document.assetIds.forEach(id => needed.add(id));
        added++;
    }

    for (const asset of assets) {
        if (!needed.has(asset.id))
            continue;

        const existing = await read<Asset | undefined>(transaction.objectStore('assets').get(asset.id));

        if (existing?.status === 'saved')
            continue;

        transaction.objectStore('assets').put(asset);
    }

    await finished;

    return { added, skipped };
}
