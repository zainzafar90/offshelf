import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PopupView } from "../../src/surfaces/popup/popup-states";
import type { CaptureJob } from "../../src/core/model";

const tab = { id: 7, title: "The case for slow software", url: "https://craft.blog/slow" } as chrome.tabs.Tab;
const job = (status: CaptureJob["status"]): CaptureJob => ({ id: "j", tabId: 7, sourceUrl: tab.url!, documentId: "d", title: tab.title!, status, message: "Collecting posts", createdAt: "", updatedAt: "", posts: 4, images: 3, savedImages: 2, options: { mode: "auto", autoScroll: true, maxPasses: 24 } });
const noop = () => {};

test("ready state saves with the chosen mode", async () => {
  const onSave = vi.fn();
  const onMode = vi.fn();
  render(<PopupView tab={tab} savedCount={24} mode="auto" onMode={onMode} onSave={onSave} onCancel={noop} onRead={noop} onOpenLibrary={noop} onSettings={noop} starting={false} />);
  expect(screen.getByText("article detected", { exact: false })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Area" }));
  expect(onMode).toHaveBeenCalledWith("area");
  await userEvent.click(screen.getByRole("button", { name: /Save this page/ }));
  expect(onSave).toHaveBeenCalled();
});

test("saving state shows progress and cancel", async () => {
  const onCancel = vi.fn();
  render(<PopupView tab={tab} job={job("capturing")} savedCount={24} mode="auto" onMode={noop} onSave={noop} onCancel={onCancel} onRead={noop} onOpenLibrary={noop} onSettings={noop} starting={false} />);
  expect(screen.getByText("Collecting posts")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(onCancel).toHaveBeenCalled();
});

test("saved state offers Read it now and notes missing images", () => {
  render(<PopupView tab={tab} job={job("done")} savedCount={25} mode="auto" onMode={noop} onSave={noop} onCancel={noop} onRead={noop} onOpenLibrary={noop} onSettings={noop} starting={false} />);
  expect(screen.getByRole("button", { name: /Read it now/ })).toBeInTheDocument();
  expect(screen.getByText(/1 image needs permission/)).toBeInTheDocument();
});

test("non-web tabs cannot be saved", () => {
  render(<PopupView tab={{ ...tab, url: "chrome://extensions" }} savedCount={0} mode="auto" onMode={noop} onSave={noop} onCancel={noop} onRead={noop} onOpenLibrary={noop} onSettings={noop} starting={false} />);
  expect(screen.getByRole("button", { name: /Save this page/ })).toBeDisabled();
});

test("the popup fills the window instead of floating as a rounded card", () => {
  const { container } = render(<PopupView tab={tab} savedCount={0} mode="auto" onMode={noop} onSave={noop} onCancel={noop} onRead={noop} onOpenLibrary={noop} onSettings={noop} starting={false} />);
  const root = container.firstElementChild as HTMLElement;
  expect(root.className).not.toMatch(/rounded|shadow/);
});

test("saved note counts posts only for threads and pluralizes", () => {
  const saved = (posts: number, images: number): CaptureJob => ({ ...job("done"), posts, images, savedImages: images });
  const { rerender } = render(<PopupView tab={tab} job={saved(1, 3)} savedCount={25} mode="auto" onMode={noop} onSave={noop} onCancel={noop} onRead={noop} onOpenLibrary={noop} onSettings={noop} starting={false} />);
  expect(screen.getByText("3 images stored offline")).toBeInTheDocument();
  rerender(<PopupView tab={tab} job={saved(4, 1)} savedCount={25} mode="auto" onMode={noop} onSave={noop} onCancel={noop} onRead={noop} onOpenLibrary={noop} onSettings={noop} starting={false} />);
  expect(screen.getByText("4 posts · 1 image stored offline")).toBeInTheDocument();
});
