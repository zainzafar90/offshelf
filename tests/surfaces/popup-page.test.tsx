import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CaptureJob } from "../../src/core/model";
import { PopupPage } from "../../src/surfaces/popup/popup-page";
import { Toaster } from "../../src/surfaces/shared/toast";
import { db } from "../../src/storage/connection";
import { putDocument, listDocuments, deleteDocument } from "../../src/storage/library-store";
import { putJob, listJobs } from "../../src/storage/job-store";
import { sampleDocument } from "../helpers/fixtures";

const tab = { id: 7, title: "The case for slow software", url: "https://craft.blog/slow" } as chrome.tabs.Tab;
const job = (id: string, over: Partial<CaptureJob>): CaptureJob => ({
  id, tabId: 7, sourceUrl: tab.url!, documentId: `doc-${id}`, title: "T", status: "done", message: "Collecting posts",
  createdAt: "2026-09-01T10:00:00.000Z", updatedAt: "", posts: 1, images: 0, savedImages: 0,
  options: { mode: "auto", autoScroll: true, maxPasses: 24 }, ...over,
});

/* the button stays disabled until the tab query resolves */
const enabledSave = () => waitFor(() => expect(screen.getByRole("button", { name: /Save this page/ })).toBeEnabled()).then(() => screen.getByRole("button", { name: /Save this page/ }));

let tabs: chrome.tabs.Tab[];
let sendMessage: ReturnType<typeof vi.fn>;
let create: ReturnType<typeof vi.fn>;

function stubChrome() {
  sendMessage = vi.fn(async () => ({ ok: true }));
  create = vi.fn();
  vi.stubGlobal("chrome", {
    tabs: { query: vi.fn(async () => tabs), create },
    storage: { onChanged: { addListener() {}, removeListener() {} } },
    runtime: { sendMessage, getURL: (path: string) => `chrome-extension://id/${path}` },
  });
}

beforeEach(async () => {
  tabs = [tab];
  stubChrome();
  await Promise.all((await listDocuments()).map(doc => deleteDocument(doc.id)));
  const database = await db();
  await new Promise<void>(resolve => { const tx = database.transaction("jobs", "readwrite"); tx.objectStore("jobs").clear(); tx.oncomplete = () => resolve(); });
});

/* unmount before the chrome stub goes away */
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test("an idle active tab shows the page and the saved count from the library", async () => {
  await putDocument(sampleDocument({ id: "a" }));
  await putDocument(sampleDocument({ id: "b" }));
  render(<PopupPage />);
  expect(await screen.findByText(/2 saved on this device/)).toBeInTheDocument();
  expect(screen.getByText("The case for slow software")).toBeInTheDocument();
  await enabledSave();
});

test("shows the newest job for the active tab and ignores other tabs' jobs", async () => {
  await putJob(job("old", { status: "failed", error: "Old failure", createdAt: "2026-09-01T09:00:00.000Z" }));
  await putJob(job("new", { status: "capturing", message: "Newest job running", createdAt: "2026-09-01T11:00:00.000Z" }));
  await putJob(job("other", { tabId: 99, status: "capturing", message: "Another tab's job", createdAt: "2026-09-01T12:00:00.000Z" }));
  render(<PopupPage />);
  expect(await screen.findByText("Newest job running")).toBeInTheDocument();
  expect(screen.queryByText("Another tab's job")).toBeNull();
  expect(screen.queryByText("Old failure")).toBeNull();
});

test("a save from another page in the same tab does not show as saved", async () => {
  await putJob(job("earlier", { status: "done", sourceUrl: "https://craft.blog/other-post", message: "Saved to your library" }));
  render(<PopupPage />);
  await enabledSave();
  expect(screen.queryByText("Saved to your library")).toBeNull();
});

test("a tab with no job of its own shows the idle state", async () => {
  await putJob(job("other", { tabId: 99, status: "capturing", message: "Another tab's job" }));
  render(<PopupPage />);
  await enabledSave();
  expect(screen.queryByText("Another tab's job")).toBeNull();
});

test("the Library header button opens the library in a new tab", async () => {
  render(<PopupPage />);
  await userEvent.click(await screen.findByRole("button", { name: "Library" }));
  expect(create).toHaveBeenCalledWith({ url: "chrome-extension://id/library.html" });
});

test("the Open library footer button opens the library in a new tab", async () => {
  render(<PopupPage />);
  await userEvent.click(await screen.findByRole("button", { name: /Open library/ }));
  expect(create).toHaveBeenCalledWith({ url: "chrome-extension://id/library.html" });
});

test("the Settings button opens the library on the reading settings", async () => {
  render(<PopupPage />);
  await userEvent.click(await screen.findByRole("button", { name: "Settings" }));
  expect(create).toHaveBeenCalledWith({ url: "chrome-extension://id/library.html?settings=reading" });
});

test("Read it now opens the saved document in the reader", async () => {
  await putJob(job("done", { status: "done", documentId: "doc-xyz" }));
  render(<PopupPage />);
  await userEvent.click(await screen.findByRole("button", { name: /Read it now/ }));
  expect(create).toHaveBeenCalledWith({ url: "chrome-extension://id/library.html?id=doc-xyz" });
});

test("Save sends the start message for the tab with the chosen mode", async () => {
  render(<PopupPage />);
  await userEvent.click(await screen.findByRole("button", { name: "Thread" }));
  await userEvent.click(await enabledSave());
  expect(sendMessage).toHaveBeenCalledWith({ type: "offshelf:start", tabId: 7, mode: "thread" });
});

test("Save does nothing when the tab has no id", async () => {
  tabs = [{ ...tab, id: undefined }];
  render(<PopupPage />);
  await userEvent.click(await enabledSave());
  expect(sendMessage).not.toHaveBeenCalled();
});

test("a worker error on Save is toasted", async () => {
  sendMessage.mockResolvedValueOnce({ ok: false, error: "Cannot reach the tab" });
  render(<><PopupPage /><Toaster /></>);
  await userEvent.click(await enabledSave());
  expect(await screen.findByText("Cannot reach the tab")).toBeInTheDocument();
  await enabledSave();
});

test("area mode closes the popup after starting", async () => {
  const close = vi.spyOn(window, "close").mockImplementation(() => {});
  render(<PopupPage />);
  await userEvent.click(await screen.findByRole("button", { name: "Area" }));
  await userEvent.click(await enabledSave());
  await waitFor(() => expect(close).toHaveBeenCalled());
  close.mockRestore();
});

test("other modes leave the popup open after starting", async () => {
  const close = vi.spyOn(window, "close").mockImplementation(() => {});
  render(<PopupPage />);
  await userEvent.click(await enabledSave());
  await waitFor(() => expect(sendMessage).toHaveBeenCalled());
  expect(close).not.toHaveBeenCalled();
  close.mockRestore();
});

test("Cancel sends the cancel message for the active job and a failure is toasted", async () => {
  await putJob(job("run", { status: "capturing", message: "Collecting posts" }));
  sendMessage.mockResolvedValueOnce({ ok: false, error: "Already finished" });
  render(<><PopupPage /><Toaster /></>);
  await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));
  expect(sendMessage).toHaveBeenCalledWith({ type: "offshelf:cancel-job", jobId: "run" });
  expect(await screen.findByText("Already finished")).toBeInTheDocument();
  expect((await listJobs()).map(item => item.id)).toEqual(["run"]);
});

test("shows a loading note until the tab and library have loaded", async () => {
  let release!: (found: chrome.tabs.Tab[]) => void;
  vi.mocked(chrome.tabs.query).mockImplementationOnce((() => new Promise(resolve => { release = resolve; })) as never);
  render(<PopupPage />);
  expect(screen.getByRole("status")).toHaveTextContent("Loading");
  expect(screen.queryByText("Choose a web page")).toBeNull();
  release([tab]);
  expect(await screen.findByText("The case for slow software")).toBeInTheDocument();
  expect(screen.queryByText("Loading", { exact: false })).toBeNull();
});

test("a failing first load shows the error with Try again, which recovers", async () => {
  vi.mocked(chrome.tabs.query).mockRejectedValueOnce(new Error("Tabs unavailable"));
  render(<><PopupPage /><Toaster /></>);
  expect(await screen.findByText("Offshelf could not read your library: Tabs unavailable")).toBeInTheDocument();
  expect(screen.queryByRole("status")).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText("The case for slow software")).toBeInTheDocument();
  expect(screen.queryByText(/could not read your library/)).toBeNull();
});

test("a refresh failure after load keeps the popup content and only toasts", async () => {
  const listeners: ((changes: object, area: string) => void)[] = [];
  const query = vi.fn(async () => tabs);
  vi.stubGlobal("chrome", {
    tabs: { query, create },
    storage: { onChanged: { addListener: (listener: never) => { listeners.push(listener); }, removeListener() {} } },
    runtime: { sendMessage, getURL: (path: string) => `chrome-extension://id/${path}` },
  });
  render(<><PopupPage /><Toaster /></>);
  await enabledSave();
  query.mockRejectedValueOnce(new Error("Refresh failed"));
  act(() => listeners.forEach(listener => listener({}, "local")));
  expect(await screen.findByText("Refresh failed")).toBeInTheDocument();
  expect(screen.getByText("The case for slow software")).toBeInTheDocument();
  expect(screen.queryByText(/could not read your library/)).toBeNull();
});
