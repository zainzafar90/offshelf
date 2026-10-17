export function onLibraryChanged(callback: () => void): () => void {
    const listener = (_changes: object, area: string): void => {
        if (area === 'local')
            callback();
    };

    chrome.storage.onChanged.addListener(listener);

    return () => chrome.storage.onChanged.removeListener(listener);
}
