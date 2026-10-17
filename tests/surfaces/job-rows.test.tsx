import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CaptureJob } from "../../src/core/model";
import { JobRows } from "../../src/surfaces/library/job-rows";
import { Toaster } from "../../src/surfaces/shared/toast";

const job: CaptureJob = {
  id: "j1", tabId: 7, sourceUrl: "https://example.com", documentId: "d", title: "A page", status: "capturing",
  message: "Collecting posts", createdAt: "", updatedAt: "", posts: 0, images: 0, savedImages: 0,
  options: { mode: "auto", autoScroll: true, maxPasses: 24 },
};

test("a failed cancel toasts the worker's error and still refreshes", async () => {
  globalThis.chrome = { runtime: { sendMessage: vi.fn(async () => ({ ok: false, error: "x" })) } } as unknown as typeof chrome;
  const onRefresh = vi.fn();
  render(<><JobRows jobs={[job]} documents={[]} onRefresh={onRefresh} /><Toaster /></>);
  await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("x");
  expect(onRefresh).toHaveBeenCalled();
});
