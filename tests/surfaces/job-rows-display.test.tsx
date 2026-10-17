import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CaptureJob } from "../../src/core/model";
import { JobRows } from "../../src/surfaces/library/job-rows";
import { sampleDocument } from "../helpers/fixtures";

const job = (id: string, over: Partial<CaptureJob> = {}): CaptureJob => ({
  id, tabId: 1, sourceUrl: "https://example.com", documentId: `doc-${id}`, title: `Title ${id}`, status: "capturing",
  message: `Message ${id}`, createdAt: "2026-09-01T10:00:00.000Z", updatedAt: "", posts: 0, images: 0, savedImages: 0,
  options: { mode: "auto", autoScroll: true, maxPasses: 24 }, ...over,
});

let sendMessage: ReturnType<typeof vi.fn>;
beforeEach(() => {
  sendMessage = vi.fn(async () => ({ ok: true }));
  vi.stubGlobal("chrome", { runtime: { sendMessage } });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const view = (jobs: CaptureJob[], documents = [sampleDocument({ id: "none" })], onRefresh = vi.fn()) =>
  render(<JobRows jobs={jobs} documents={documents} onRefresh={onRefresh} />);

test("renders nothing when there are no active jobs or unsaved failures", () => {
  const { container } = view([job("done", { status: "done" }), job("cancelled", { status: "cancelled" })]);
  expect(container).toBeEmptyDOMElement();
});

test("an active job shows its title, message and a Cancel button", () => {
  view([job("a", { status: "downloading", message: "Saving images 2/5" })]);
  expect(screen.getByText("Title a")).toBeInTheDocument();
  expect(screen.getByText("Saving images 2/5")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
});

test("a failed job with no saved document shows its error instead of its message, with no Cancel", () => {
  view([job("f", { status: "failed", error: "The page blocked access", message: "Capture failed" })]);
  expect(screen.getByText("The page blocked access")).toBeInTheDocument();
  expect(screen.queryByText("Capture failed")).toBeNull();
  expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
});

test("a failed job without an error falls back to its message", () => {
  view([job("f", { status: "failed", message: "Capture failed" })]);
  expect(screen.getByText("Capture failed")).toBeInTheDocument();
});

test("an interrupted job is listed as an error row", () => {
  view([job("i", { status: "interrupted", message: "Browser restarted" })]);
  expect(screen.getByText("Browser restarted")).toBeInTheDocument();
});

test("a failed job whose document was saved anyway is hidden", () => {
  view([job("f", { status: "failed", documentId: "kept" })], [sampleDocument({ id: "kept" })]);
  expect(screen.queryByText("Title f")).toBeNull();
});

test("only the newest unsaved failure is shown", () => {
  view([
    job("old", { status: "failed", createdAt: "2026-09-01T09:00:00.000Z" }),
    job("new", { status: "interrupted", createdAt: "2026-09-01T11:00:00.000Z" }),
    job("mid", { status: "failed", createdAt: "2026-09-01T10:00:00.000Z" }),
  ]);
  expect(screen.getByText("Title new")).toBeInTheDocument();
  expect(screen.queryByText("Title old")).toBeNull();
  expect(screen.queryByText("Title mid")).toBeNull();
});

test("active jobs come before the failure row", () => {
  view([job("bad", { status: "failed" }), job("run", { status: "capturing" })]);
  const titles = screen.getAllByText(/^Title /).map(node => node.textContent);
  expect(titles).toEqual(["Title run", "Title bad"]);
});

test("Cancel asks the worker to cancel that job and then refreshes", async () => {
  const onRefresh = vi.fn();
  view([job("run", { status: "capturing" })], undefined, onRefresh);
  await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(sendMessage).toHaveBeenCalledWith({ type: "offshelf:cancel-job", jobId: "run" });
  expect(onRefresh).toHaveBeenCalledTimes(1);
});
