import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CaptureJob } from "../../src/core/model";
import { PopupView } from "../../src/surfaces/popup/popup-states";

const tab = { id: 7, title: "The case for slow software", url: "https://craft.blog/slow" } as chrome.tabs.Tab;
const noop = () => {};

const baseJob: CaptureJob = {
  id: "j", tabId: 7, sourceUrl: tab.url!, documentId: "d", title: "T", status: "capturing", message: "Collecting posts",
  createdAt: "", updatedAt: "", posts: 1, images: 0, savedImages: 0, options: { mode: "auto", autoScroll: true, maxPasses: 24 },
};

type Props = Partial<React.ComponentProps<typeof PopupView>>;
function view(props: Props = {}) {
  return (
    <PopupView tab={tab} savedCount={3} mode="auto" onMode={noop} onSave={noop} onCancel={noop} onRead={noop}
      onOpenLibrary={noop} onSettings={noop} starting={false} {...props} />
  );
}

const saveButton = () => screen.getByRole("button", { name: /Save this page/ });

test("idle on a web page shows the page card and an enabled Save button", () => {
  render(view());
  expect(screen.getByText("The case for slow software")).toBeInTheDocument();
  expect(screen.getByText("craft.blog · article detected")).toBeInTheDocument();
  expect(saveButton()).toBeEnabled();
  expect(screen.getByText("⌥⇧S")).toBeInTheDocument();
});

test("an X page is detected as a thread", () => {
  render(view({ tab: { ...tab, url: "https://x.com/ada/status/1" } }));
  expect(screen.getByText("x.com · thread detected")).toBeInTheDocument();
});

test("the www prefix is dropped from the detected host", () => {
  render(view({ tab: { ...tab, url: "https://www.craft.blog/slow" } }));
  expect(screen.getByText("craft.blog · article detected")).toBeInTheDocument();
});

test("idle shows the selected capture mode as pressed", () => {
  render(view({ mode: "thread" }));
  const modes = screen.getByRole("group", { name: "Capture mode" });
  expect(modes).toHaveTextContent("AutoArticleThreadSelectionArea");
  expect(screen.getByRole("button", { name: "Thread" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Auto" })).toHaveAttribute("aria-pressed", "false");
});

test.each(["chrome://extensions", "about:blank", "file:///tmp/a.html", ""])("unsupported page %j disables Save", (url) => {
  render(view({ tab: { ...tab, url } }));
  expect(saveButton()).toBeDisabled();
});

test("a missing tab shows the choose-a-page prompt and a disabled Save", () => {
  render(view({ tab: undefined }));
  expect(screen.getByText("Choose a web page")).toBeInTheDocument();
  expect(screen.getByText("Open an article or X thread")).toBeInTheDocument();
  expect(saveButton()).toBeDisabled();
});

test("an untitled tab falls back to the choose-a-page title", () => {
  render(view({ tab: { ...tab, title: "" } }));
  expect(screen.getByText("Choose a web page")).toBeInTheDocument();
});

test("starting shows the starting label and disables Save", () => {
  render(view({ starting: true }));
  expect(screen.getByRole("button", { name: /Starting capture…/ })).toBeDisabled();
  expect(screen.queryByRole("button", { name: /Save this page/ })).toBeNull();
});

test.each(["capturing", "downloading"] as const)("%s job shows its message, keep-open hint and no Save button", (status) => {
  render(view({ job: { ...baseJob, status, message: "Working on it" } }));
  expect(screen.getByText("Working on it")).toBeInTheDocument();
  expect(screen.getByText("Keep this tab open until saving finishes. You can close the popup.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
  expect(screen.queryByRole("button", { name: /Save this page|Save again/ })).toBeNull();
  expect(screen.queryByRole("group", { name: "Capture mode" })).toBeNull();
});

test("saved shows the confirmation and the stored-offline note", () => {
  render(view({ job: { ...baseJob, status: "done", posts: 1, images: 2, savedImages: 2 } }));
  expect(screen.getByText("Saved to your library")).toBeInTheDocument();
  expect(screen.getByText("2 images stored offline")).toBeInTheDocument();
  expect(screen.queryByText(/permission from its host/)).toBeNull();
  expect(screen.queryByRole("button", { name: /Save this page/ })).toBeNull();
});

test("saved with several missing images pluralizes the permission note", () => {
  render(view({ job: { ...baseJob, status: "done", images: 5, savedImages: 2 } }));
  expect(screen.getByText(/3 images need permission from its host/)).toBeInTheDocument();
});

test("saved with a zero-image count reads '0 images'", () => {
  render(view({ job: { ...baseJob, status: "done", posts: 1, images: 0, savedImages: 0 } }));
  expect(screen.getByText("0 images stored offline")).toBeInTheDocument();
});

test("failed shows the job error and an enabled Save again on a web page", () => {
  render(view({ job: { ...baseJob, status: "failed", error: "The page blocked access", message: "ignored" } }));
  expect(screen.getByText("The page blocked access")).toBeInTheDocument();
  expect(screen.queryByText("ignored")).toBeNull();
  expect(screen.getByRole("button", { name: "Save again" })).toBeEnabled();
});

test.each(["failed", "interrupted", "cancelled"] as const)("%s without an error falls back to the job message", (status) => {
  render(view({ job: { ...baseJob, status, error: undefined, message: "Capture stopped" } }));
  expect(screen.getByText("Capture stopped")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Save again" })).toBeEnabled();
});

test("Save again is disabled while starting or on an unsupported page", () => {
  const job = { ...baseJob, status: "failed" as const, error: "Nope" };
  const { rerender } = render(view({ job, starting: true }));
  expect(screen.getByRole("button", { name: "Save again" })).toBeDisabled();
  rerender(view({ job, tab: { ...tab, url: "chrome://settings" } }));
  expect(screen.getByRole("button", { name: "Save again" })).toBeDisabled();
});

test("Save again calls onSave", async () => {
  const onSave = vi.fn();
  render(view({ onSave, job: { ...baseJob, status: "failed", error: "Nope" } }));
  await userEvent.click(screen.getByRole("button", { name: "Save again" }));
  expect(onSave).toHaveBeenCalledTimes(1);
});

test("the footer reports how many pages are saved", () => {
  render(view({ savedCount: 42 }));
  expect(screen.getByText(/42 saved on this device/)).toBeInTheDocument();
});

test("header Library and Settings buttons and the footer link call their handlers", async () => {
  const onOpenLibrary = vi.fn();
  const onSettings = vi.fn();
  render(view({ onOpenLibrary, onSettings }));
  await userEvent.click(screen.getByRole("button", { name: "Library" }));
  await userEvent.click(screen.getByRole("button", { name: "Settings" }));
  await userEvent.click(screen.getByRole("button", { name: /Open library/ }));
  expect(onOpenLibrary).toHaveBeenCalledTimes(2);
  expect(onSettings).toHaveBeenCalledTimes(1);
});

test("Read it now calls onRead", async () => {
  const onRead = vi.fn();
  render(view({ onRead, job: { ...baseJob, status: "done" } }));
  await userEvent.click(screen.getByRole("button", { name: /Read it now/ }));
  expect(onRead).toHaveBeenCalledTimes(1);
});

test("loading shows a loading note instead of the choose-a-page prompt and hides the saved count", () => {
  render(view({ tab: undefined, loading: true, savedCount: 0 }));
  expect(screen.getByRole("status")).toHaveTextContent("Loading");
  expect(screen.queryByText("Choose a web page")).toBeNull();
  expect(screen.queryByRole("button", { name: /Save this page/ })).toBeNull();
  expect(screen.queryByText(/saved on this device/)).toBeNull();
});

test("an error shows the message with Try again, and no stale prompt", async () => {
  const onRetry = vi.fn();
  render(view({ tab: undefined, error: "Disk went away", onRetry }));
  expect(screen.getByRole("alert")).toHaveTextContent("Offshelf could not read your library: Disk went away");
  expect(screen.queryByText("Choose a web page")).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(onRetry).toHaveBeenCalledTimes(1);
});

test("the header and footer links still work while loading or failed", async () => {
  const onOpenLibrary = vi.fn();
  render(view({ loading: true, onOpenLibrary }));
  await userEvent.click(screen.getByRole("button", { name: /Open library/ }));
  expect(onOpenLibrary).toHaveBeenCalledTimes(1);
});
