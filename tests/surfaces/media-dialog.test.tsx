import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Asset, SavedDocument } from "../../src/core/model";
import { MediaDialog } from "../../src/surfaces/reader/media-dialog";
import { Toaster } from "../../src/surfaces/shared/toast";
import { sampleDocument } from "../helpers/fixtures";
import { toastCount } from "../helpers/toast-count";

const TWIMG = "https://pbs.twimg.com/*";
const CDN = "https://cdn.example.org/*";

function asset(id: string, status: Asset["status"], sourceUrl: string, over: Partial<Asset> = {}): Asset {
  return { id, sourceUrl, alt: "", status, bytes: 0, attempts: 0, updatedAt: "", ...over };
}

function docWith(ids: string[], over: Partial<SavedDocument> = {}): SavedDocument {
  return sampleDocument({
    id: "doc-m",
    sections: [{ id: "s", sourceUrl: "https://example.com/post", excluded: false, blocks: ids.map(id => ({ type: "image" as const, assetId: id, alt: id })) }],
    ...over,
  });
}

const assets = () => new Map<string, Asset>([
  ["a1", asset("a1", "failed", "https://pbs.twimg.com/media/a.jpg", { error: "Host refused", alt: "A cat" })],
  ["a2", asset("a2", "permission", "https://pbs.twimg.com/media/b.jpg")],
  ["a3", asset("a3", "pending", "https://www.cdn.example.org/c.png")],
  ["a4", asset("a4", "saved", "https://pbs.twimg.com/media/d.jpg")],
]);

let request: ReturnType<typeof vi.fn>;
let sendMessage: ReturnType<typeof vi.fn>;

beforeEach(() => {
  request = vi.fn(async () => true);
  sendMessage = vi.fn(async () => ({ ok: true }));
  vi.stubGlobal("chrome", { permissions: { request }, runtime: { sendMessage } });
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function setup(doc = docWith(["a1", "a2", "a3", "a4"]), map = assets()) {
  const onOpenChange = vi.fn();
  const onChanged = vi.fn(async () => {});
  render(<><MediaDialog doc={doc} assets={map} open onOpenChange={onOpenChange} onChanged={onChanged} /><Toaster /></>);
  return { onOpenChange, onChanged };
}

const checkbox = (origin: string) => screen.getByRole("checkbox", { name: origin });
const allow = () => screen.getByRole("button", { name: "Allow selected hosts & retry" });

test("summarizes stored images and lists each missing one with its error or a default", () => {
  setup();
  expect(screen.getByText("1 of 4 images are stored on this device.")).toBeInTheDocument();
  expect(screen.getByText("A cat")).toBeInTheDocument();
  expect(screen.getByText("Host refused")).toBeInTheDocument();
  expect(screen.getByText("pbs.twimg.com")).toBeInTheDocument();
  expect(screen.getByText("cdn.example.org")).toBeInTheDocument();
  expect(screen.getAllByText("Not downloaded yet.")).toHaveLength(2);
});

test("hosts are grouped by origin, de-duplicated, and all start selected", () => {
  setup();
  expect(screen.getAllByRole("checkbox")).toHaveLength(2);
  expect(checkbox(TWIMG)).toBeChecked();
  expect(checkbox("https://www.cdn.example.org/*")).toBeChecked();
});

test("the summary counts only images in included posts", () => {
  const doc = docWith(["a1"]);
  doc.sections.push({ id: "x", sourceUrl: "https://example.com/post", excluded: true, blocks: [{ type: "image", assetId: "a2", alt: "" }] });
  setup(doc);
  expect(screen.getByText("0 of 1 images are stored on this device.")).toBeInTheDocument();
  expect(screen.getAllByRole("checkbox")).toHaveLength(1);
});

test("when everything is saved it says so and offers no actions", () => {
  setup(docWith(["a4"]));
  expect(screen.getByText("Every captured image is available offline.")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /retry/i })).toBeNull();
});

test("Allow selected hosts requests exactly the selected origins, then retries", async () => {
  const { onOpenChange, onChanged } = setup();
  await userEvent.click(checkbox("https://www.cdn.example.org/*"));
  expect(checkbox("https://www.cdn.example.org/*")).not.toBeChecked();
  await userEvent.click(allow());

  expect(request).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledWith({ origins: [TWIMG] });
  await waitFor(() => expect(sendMessage).toHaveBeenCalledWith({ type: "offshelf:retry-images", documentId: "doc-m" }));
  await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

test("requests every origin when none was unchecked", async () => {
  setup();
  await userEvent.click(allow());
  expect(request).toHaveBeenCalledWith({ origins: [TWIMG, "https://www.cdn.example.org/*"] });
});

test("a denied permission toasts and does not retry", async () => {
  request.mockResolvedValueOnce(false);
  const { onChanged } = setup();
  await userEvent.click(allow());
  expect(await screen.findByText("Permission was not granted. The saved text is unchanged.")).toBeInTheDocument();
  expect(sendMessage).not.toHaveBeenCalled();
  expect(onChanged).not.toHaveBeenCalled();
  await waitFor(() => expect(allow()).toBeEnabled());
});

test("a rejected permission request toasts its error", async () => {
  request.mockRejectedValueOnce(new Error("Permission prompt dismissed"));
  setup();
  await userEvent.click(allow());
  expect(await screen.findByText("Permission prompt dismissed")).toBeInTheDocument();
  expect(sendMessage).not.toHaveBeenCalled();
});

test("with every host unchecked it toasts instead of asking for permission", async () => {
  setup();
  await userEvent.click(checkbox(TWIMG));
  await userEvent.click(checkbox("https://www.cdn.example.org/*"));
  const before = toastCount("Select at least one image host.");
  await userEvent.click(allow());
  expect(request).not.toHaveBeenCalled();
  expect(toastCount("Select at least one image host.")).toBe(before + 1);
});

test("Retry without new access sends the retry message and never asks for permission", async () => {
  const { onOpenChange, onChanged } = setup();
  await userEvent.click(screen.getByRole("button", { name: "Retry without new access" }));
  expect(request).not.toHaveBeenCalled();
  expect(sendMessage).toHaveBeenCalledWith({ type: "offshelf:retry-images", documentId: "doc-m" });
  await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  expect(onOpenChange).toHaveBeenCalledWith(false);
  expect(screen.getAllByText("Retrying missing images.").length).toBeGreaterThan(0);
});

test("a worker failure on retry toasts and keeps the dialog open", async () => {
  sendMessage.mockResolvedValueOnce({ ok: false, error: "Worker is busy" });
  const { onOpenChange, onChanged } = setup();
  await userEvent.click(screen.getByRole("button", { name: "Retry without new access" }));
  expect(await screen.findByText("Worker is busy")).toBeInTheDocument();
  expect(onOpenChange).not.toHaveBeenCalled();
  expect(onChanged).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.getByRole("button", { name: "Retry without new access" })).toBeEnabled());
});

test("images whose URL has no usable origin offer only the plain retry", () => {
  const map = new Map([["u", asset("u", "failed", "data:image/png;base64,AAAA", { alt: "Inline" })]]);
  setup(docWith(["u"]), map);
  expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  expect(screen.queryByRole("button", { name: "Allow selected hosts & retry" })).toBeNull();
  expect(screen.getByRole("button", { name: "Retry without new access" })).toBeInTheDocument();
});

test("an asset with no stored record is not listed as missing", () => {
  setup(docWith(["ghost", "a1"]));
  expect(screen.getByText("1 of 2 images are stored on this device.")).toBeInTheDocument();
  expect(screen.getAllByRole("checkbox")).toHaveLength(1);
});

test("host selection resets to all hosts each time the dialog opens", async () => {
  const doc = docWith(["a1", "a2", "a3", "a4"]);
  const map = assets();
  const view = (open: boolean) => <MediaDialog doc={doc} assets={map} open={open} onOpenChange={vi.fn()} onChanged={async () => {}} />;
  const { rerender } = render(view(true));
  await userEvent.click(checkbox(TWIMG));
  expect(checkbox(TWIMG)).not.toBeChecked();

  rerender(view(false));
  rerender(view(true));
  expect(checkbox(TWIMG)).toBeChecked();
  expect(checkbox("https://www.cdn.example.org/*")).toBeChecked();
});

test("both buttons stay disabled while the permission prompt is open, then recover when denied", async () => {
  let answer!: (granted: boolean) => void;
  request.mockReturnValueOnce(new Promise<boolean>(resolve => { answer = resolve; }));
  setup();
  await userEvent.click(allow());
  expect(request).toHaveBeenCalledTimes(1);
  expect(allow()).toBeDisabled();
  expect(screen.getByRole("button", { name: "Retry without new access" })).toBeDisabled();

  answer(false);
  await waitFor(() => expect(allow()).toBeEnabled());
  expect(screen.getByRole("button", { name: "Retry without new access" })).toBeEnabled();
  expect(sendMessage).not.toHaveBeenCalled();
});

test("a second click during the prompt does not ask for permission again", async () => {
  let answer!: (granted: boolean) => void;
  request.mockReturnValueOnce(new Promise<boolean>(resolve => { answer = resolve; }));
  setup();
  const button = allow();
  await userEvent.click(button);
  await userEvent.click(button);
  expect(request).toHaveBeenCalledTimes(1);
  answer(false);
  await waitFor(() => expect(allow()).toBeEnabled());
});
