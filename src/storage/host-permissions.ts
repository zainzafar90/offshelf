/* Not async: user gesture must reach permissions.request. */
export function requestHostAccess(origins: string[]): Promise<boolean> {
    return chrome.permissions.request({ origins });
}

export async function listHostAccess(): Promise<string[]> {
    const granted = await chrome.permissions.getAll();

    return granted.origins ?? [];
}

export async function revokeHostAccess(origin: string): Promise<void> {
    await chrome.permissions.remove({ origins: [origin] });
}
