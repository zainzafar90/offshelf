export type StoreName = 'documents' | 'assets' | 'jobs' | 'settings';

const DATABASE = 'offshelf-library';
let connection: Promise<IDBDatabase> | undefined;

export function request<T>(req: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error('Local storage request failed.'));
    });
}

export function completed(tx: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('Local storage transaction failed.'));
        tx.onabort = () => reject(tx.error ?? new Error('Local storage transaction was cancelled.'));
    });
}

export function db(): Promise<IDBDatabase> {
    if (connection)
        return connection;

    connection = new Promise((resolve, reject) => {
        const open = indexedDB.open(DATABASE, 1);

        open.onupgradeneeded = event => {
            const database = open.result;

            if (event.oldVersion < 1) {
                database.createObjectStore('documents', { keyPath: 'id' });
                database.createObjectStore('assets', { keyPath: 'id' });
                database.createObjectStore('jobs', { keyPath: 'id' });
                database.createObjectStore('settings');
            }
        };

        open.onerror = () => { connection = undefined; reject(open.error); };

        open.onblocked = () => { connection = undefined; reject(new Error('Close older Offshelf tabs, then try again.')); };

        open.onsuccess = () => {
            open.result.onversionchange = () => { open.result.close(); connection = undefined; };

            resolve(open.result);
        };
    });

    return connection;
}

export async function get<T>(store: StoreName, key: string): Promise<T | undefined> {
    const database = await db();

    return request<T | undefined>(database.transaction(store).objectStore(store).get(key));
}

export async function all<T>(store: StoreName): Promise<T[]> {
    const database = await db();

    return request<T[]>(database.transaction(store).objectStore(store).getAll());
}

export async function put(store: StoreName, value: unknown, key?: string): Promise<void> {
    const database = await db();
    const tx = database.transaction(store, 'readwrite');
    const done = completed(tx);

    if (key)
        tx.objectStore(store).put(value, key);
    else
        tx.objectStore(store).put(value);

    await done;
}
