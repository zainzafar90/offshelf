/* Minimal fake `chrome` global covering only what src/background and src/capture call. */
import { vi } from "vitest";

const EXTENSION_ID = "test-extension-id";
export const EXTENSION_ORIGIN = `chrome-extension://${EXTENSION_ID}/`;

type Listener = (...args: any[]) => unknown;
type FakeTab = { id: number; url?: string; title?: string };
export type FakeSender = { id?: string; url?: string; frameId?: number; tab?: { id: number } };

function fakeEvent() {
  const listeners: Listener[] = [];
  return {
    listeners,
    addListener: vi.fn((listener: Listener) => { listeners.push(listener); }),
    removeListener: vi.fn((listener: Listener) => { listeners.splice(listeners.indexOf(listener), 1); }),
    hasListener: vi.fn((listener: Listener) => listeners.includes(listener)),
    fire: (...args: unknown[]) => listeners.map(listener => listener(...args)),
  };
}

function createFakeChrome(version = "1.0.0") {
  const tabs = new Map<number, FakeTab>();
  const stored: Record<string, unknown> = {};
  const fake = {
    runtime: {
      id: EXTENSION_ID,
      getManifest: vi.fn(() => ({ version })),
      getURL: vi.fn((path = "") => `${EXTENSION_ORIGIN}${path}`),
      onMessage: fakeEvent(),
      onInstalled: fakeEvent(),
      onStartup: fakeEvent(),
      sendMessage: vi.fn(async (_message: unknown): Promise<unknown> => ({ ok: true })),
    },
    storage: {
      local: {
        get: vi.fn(async (key?: string) => (key ? { [key]: stored[key] } : { ...stored })),
        set: vi.fn(async (items: Record<string, unknown>) => { Object.assign(stored, items); }),
      },
      onChanged: fakeEvent(),
    },
    tabs: {
      get: vi.fn(async (id: number) => {
        const tab = tabs.get(id);
        if (!tab) throw new Error(`No tab with id: ${id}.`);
        return tab;
      }),
      query: vi.fn(async (_query: unknown): Promise<FakeTab[]> => []),
      create: vi.fn(async (props: { url?: string }) => ({ id: 900, ...props })),
      update: vi.fn(async (id: number, props: { url?: string }) => ({ id, ...props })),
      sendMessage: vi.fn(async (_id: number, _message: unknown): Promise<unknown> => ({ ok: true })),
      onRemoved: fakeEvent(),
    },
    scripting: { executeScript: vi.fn(async (_injection: unknown) => []) },
    action: {
      setBadgeText: vi.fn(async (_details: unknown) => {}),
      setBadgeBackgroundColor: vi.fn(async (_details: unknown) => {}),
    },
    alarms: { create: vi.fn(async (_name: string, _info: unknown) => {}), onAlarm: fakeEvent() },
    contextMenus: {
      create: vi.fn((_props: unknown) => "menu"),
      removeAll: vi.fn(async () => {}),
      onClicked: fakeEvent(),
    },
    commands: { onCommand: fakeEvent() },
    permissions: {
      contains: vi.fn(async (_query: unknown) => true),
      request: vi.fn(async (_query: unknown) => true),
      getAll: vi.fn(async () => ({ origins: [] as string[], permissions: [] as string[] })),
      remove: vi.fn(async (_query: unknown) => true),
    },
  };
  return { chrome: fake, tabs, stored };
}

type FakeChrome = ReturnType<typeof createFakeChrome>["chrome"];

export type ChromeHarness = {
  chrome: FakeChrome;
  addTab: (tab: FakeTab) => void;
  sendWorkerMessage: (message: unknown, sender?: FakeSender) => Promise<unknown>;
  /* resolves after the next storage.local.set (notifyChanged) */
  nextNotify: (action: () => unknown) => Promise<void>;
};

export const extensionSender = (path = "library.html"): FakeSender => ({ id: EXTENSION_ID, url: `${EXTENSION_ORIGIN}${path}` });
export const tabSender = (tabId: number, url: string, frameId = 0): FakeSender => ({ id: EXTENSION_ID, tab: { id: tabId }, url, frameId });

/* Stubs the global `chrome`; pair with uninstallChrome in afterEach. */
export function installChrome(version?: string): ChromeHarness {
  const { chrome, tabs } = createFakeChrome(version);
  vi.stubGlobal("chrome", chrome);
  const sendWorkerMessage = (message: unknown, sender: FakeSender = extensionSender()) =>
    new Promise<unknown>((resolve, reject) => {
      const listener = chrome.runtime.onMessage.listeners.at(-1);
      if (!listener) return reject(new Error("No onMessage listener installed."));
      /* `true` means the reply arrives later through the callback */
      const handled = listener(message, sender, resolve);
      if (handled !== true) resolve(undefined);
    });
  const nextNotify = async (action: () => unknown) => {
    const before = chrome.storage.local.set.mock.calls.length;
    await action();
    await vi.waitFor(() => expect(chrome.storage.local.set.mock.calls.length).toBeGreaterThan(before));
  };
  return { chrome, addTab: tab => { tabs.set(tab.id, tab); }, sendWorkerMessage, nextNotify };
}

export function uninstallChrome(): void {
  vi.unstubAllGlobals();
}
