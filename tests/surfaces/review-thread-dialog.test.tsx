import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Section } from "../../src/core/model";
import { ReviewThreadDialog } from "../../src/surfaces/reader/review-thread-dialog";
import { Toaster } from "../../src/surfaces/shared/toast";
import { sampleDocument } from "../helpers/fixtures";
import { toastCount } from "../helpers/toast-count";

const post = (id: string, text: string, over: Partial<Section> = {}): Section => ({
  id, sourceUrl: `https://x.com/ada/status/${id}`, relation: "candidate", excluded: false,
  blocks: [{ type: "paragraph", content: [{ text }] }], ...over,
});

const thread = () => sampleDocument({
  kind: "thread", author: "Ada",
  sections: [
    post("1", "alpha beta gamma", { relation: "selected", author: "Ada Lovelace" }),
    post("2", "delta epsilon"),
    post("3", "zeta eta theta iota", { excluded: true }),
  ],
});

function setup(doc = thread()) {
  const onSave = vi.fn<React.ComponentProps<typeof ReviewThreadDialog>["onSave"]>(async () => true);
  const onOpenChange = vi.fn();
  render(<><ReviewThreadDialog doc={doc} open onOpenChange={onOpenChange} onSave={onSave} /><Toaster /></>);
  return { onSave, onOpenChange, boxes: () => screen.getAllByRole("checkbox") as HTMLInputElement[] };
}

test("lists every post with its role and author; excluded posts start unchecked", () => {
  const { boxes } = setup();
  expect(boxes().map(box => box.checked)).toEqual([true, true, false]);
  expect(screen.getByText("STARTING POST · Ada Lovelace")).toBeInTheDocument();
  expect(screen.getAllByText("CANDIDATE · Ada")).toHaveLength(2);
  expect(screen.getByText("alpha beta gamma")).toBeInTheDocument();
  expect(screen.getByText("zeta eta theta iota")).toBeInTheDocument();
});

test("long post text is cut to 240 characters in the list", () => {
  const long = "w".repeat(300);
  setup(sampleDocument({ kind: "thread", sections: [post("1", long, { relation: "selected" })] }));
  expect(screen.getByText("w".repeat(240))).toBeInTheDocument();
});

test("unchecking a post saves a patch with it excluded and the stats re-measured", async () => {
  const { boxes, onSave, onOpenChange } = setup();
  await userEvent.click(boxes()[1]!);
  await userEvent.click(screen.getByRole("button", { name: "Save selection" }));

  expect(onSave).toHaveBeenCalledTimes(1);
  const patch = onSave.mock.calls[0]![0];
  expect(Object.keys(patch).sort()).toEqual(["excerpt", "readingMinutes", "sections", "wordCount"]);
  expect(patch.sections.map((section: Section) => section.excluded)).toEqual([false, true, true]);
  expect(patch.wordCount).toBe(3);
  expect(patch.readingMinutes).toBe(1);
  expect(patch.excerpt).toBe("alpha beta gamma");
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

test("checking a previously excluded post includes it in the patch", async () => {
  const { boxes, onSave } = setup();
  await userEvent.click(boxes()[2]!);
  await userEvent.click(screen.getByRole("button", { name: "Save selection" }));
  const patch = onSave.mock.calls[0]![0];
  expect(patch.sections.map((section: Section) => section.excluded)).toEqual([false, false, false]);
  expect(patch.wordCount).toBe(9);
  expect(patch.excerpt).toBe("alpha beta gamma delta epsilon zeta eta theta iota");
});

test("the patch keeps the other section fields untouched", async () => {
  const { onSave } = setup();
  await userEvent.click(screen.getByRole("button", { name: "Save selection" }));
  const [first] = onSave.mock.calls[0]![0].sections as Section[];
  expect(first).toMatchObject({ id: "1", relation: "selected", author: "Ada Lovelace", excluded: false });
});

test("saving waits for the save: no close or toast until it resolves, and the button is disabled", async () => {
  const { onSave, onOpenChange } = setup();
  const before = toastCount("Thread selection updated.");
  let finish!: (saved: boolean) => void;
  onSave.mockReturnValueOnce(new Promise<boolean>(resolve => { finish = resolve; }));
  await userEvent.click(screen.getByRole("button", { name: "Save selection" }));
  expect(screen.getByRole("button", { name: "Save selection" })).toBeDisabled();
  expect(onOpenChange).not.toHaveBeenCalled();
  expect(toastCount("Thread selection updated.")).toBe(before);

  finish(true);
  await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  expect(toastCount("Thread selection updated.")).toBe(before + 1);
});

test("a failed save keeps the dialog open without a success toast and allows a retry", async () => {
  const { onSave, onOpenChange } = setup();
  const before = toastCount("Thread selection updated.");
  onSave.mockResolvedValueOnce(false);
  await userEvent.click(screen.getByRole("button", { name: "Save selection" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Save selection" })).toBeEnabled());
  expect(onOpenChange).not.toHaveBeenCalled();
  expect(toastCount("Thread selection updated.")).toBe(before);

  await userEvent.click(screen.getByRole("button", { name: "Save selection" }));
  await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  expect(onSave).toHaveBeenCalledTimes(2);
});

test("a rejected save shows its error toast and keeps the dialog open", async () => {
  const { onSave, onOpenChange } = setup();
  onSave.mockRejectedValueOnce(new Error("Selection refused"));
  await userEvent.click(screen.getByRole("button", { name: "Save selection" }));
  expect(await screen.findByText("Selection refused")).toBeInTheDocument();
  expect(onOpenChange).not.toHaveBeenCalled();
});

test("excluding every post is refused with an error toast and nothing is saved", async () => {
  const { boxes, onSave, onOpenChange } = setup();
  const before = toastCount("Keep at least one post in the reader.");
  await userEvent.click(boxes()[0]!);
  await userEvent.click(boxes()[1]!);
  expect(boxes().every(box => !box.checked)).toBe(true);
  await userEvent.click(screen.getByRole("button", { name: "Save selection" }));
  expect(onSave).not.toHaveBeenCalled();
  expect(onOpenChange).not.toHaveBeenCalled();
  expect(toastCount("Keep at least one post in the reader.")).toBe(before + 1);
  expect(screen.getAllByRole("alert", { hidden: true }).some(alert => alert.textContent === "Keep at least one post in the reader.")).toBe(true);
});

test("edit, cancel and reopen restores the document's original selection", async () => {
  const doc = thread();
  const view = (open: boolean) => <ReviewThreadDialog doc={doc} open={open} onOpenChange={vi.fn()} onSave={vi.fn(async () => true)} />;
  const { rerender } = render(view(true));
  await userEvent.click(screen.getAllByRole("checkbox")[1]!);
  await userEvent.click(screen.getAllByRole("checkbox")[2]!);
  expect((screen.getAllByRole("checkbox") as HTMLInputElement[]).map(box => box.checked)).toEqual([true, false, true]);

  rerender(view(false));
  rerender(view(true));
  expect((screen.getAllByRole("checkbox") as HTMLInputElement[]).map(box => box.checked)).toEqual([true, true, false]);
});
