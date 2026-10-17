export function extensionUrl(path: string): string {
    return chrome.runtime.getURL(path);
}

async function openExtensionPage(path: string): Promise<void> {
    await chrome.tabs.create({ url: extensionUrl(path) });
}

export const openLibraryPage = (): Promise<void> => openExtensionPage('library.html');

export const openReaderPage = (documentId: string): Promise<void> => openExtensionPage(`library.html?id=${documentId}`);

export const openSettingsPage = (): Promise<void> => openExtensionPage('library.html?settings=reading');

export const printPageUrl = (documentId: string): string => extensionUrl(`print.html?id=${encodeURIComponent(documentId)}&print=1`);
