export async function openLibrary(): Promise<void> { await chrome.tabs.create({ url: chrome.runtime.getURL('library.html') }); }
