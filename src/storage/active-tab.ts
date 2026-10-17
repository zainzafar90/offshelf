export type ActiveTab = chrome.tabs.Tab;

export async function getActiveTab(): Promise<ActiveTab | undefined> {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });

    return tabs[0];
}
