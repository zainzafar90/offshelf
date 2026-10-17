export async function notifyChanged(): Promise<void> { await chrome.storage.local.set({ offshelfRevision: `${Date.now()}-${Math.random()}` }); }
