import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TagDialog } from "../../src/surfaces/reader/tag-dialog";
import { Toaster } from "../../src/surfaces/shared/toast";
import { sampleDocument } from "../helpers/fixtures";
import { toastCount } from "../helpers/toast-count";

function setup(tags: string[] = []) {
  const onSave = vi.fn(async (_tags: string[]) => true);
  const onOpenChange = vi.fn();
  render(<><TagDialog doc={sampleDocument({ tags })} open onOpenChange={onOpenChange} onSave={onSave} /><Toaster /></>);
  return { onSave, onOpenChange, input: screen.getByRole("textbox", { name: "Document tags" }) };
}

const save = () => userEvent.click(screen.getByRole("button", { name: "Save tags" }));

test("shows the current tags comma-separated", () => {
  const { input } = setup(["Design", "Slow"]);
  expect(input).toHaveValue("Design, Slow");
  expect(screen.getByRole("dialog", { name: "Edit tags" })).toBeInTheDocument();
  expect(screen.getByText("Separate tags with commas.")).toBeInTheDocument();
});

test("typing 'a, b ,  a' saves the trimmed, de-duplicated tags and closes", async () => {
  const { input, onSave, onOpenChange } = setup();
  await userEvent.type(input, "a, b ,  a");
  await save();
  expect(onSave).toHaveBeenCalledTimes(1);
  expect(onSave).toHaveBeenCalledWith(["a", "b"]);
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

test("empty segments are dropped and case is kept", async () => {
  const { input, onSave } = setup();
  await userEvent.type(input, ",, Design ,, design,");
  await save();
  expect(onSave).toHaveBeenCalledWith(["Design", "design"]);
});

test("clearing the field saves an empty list", async () => {
  const { input, onSave } = setup(["Old"]);
  await userEvent.clear(input);
  await save();
  expect(onSave).toHaveBeenCalledWith([]);
});

test("tags are cut to 80 characters and the list to 30", async () => {
  const { input, onSave } = setup();
  await userEvent.click(input);
  await userEvent.paste(`${"x".repeat(100)}, ${Array.from({ length: 40 }, (_, i) => `t${i}`).join(", ")}`);
  await save();
  const saved = onSave.mock.calls[0]![0] as string[];
  expect(saved).toHaveLength(30);
  expect(saved[0]).toBe("x".repeat(80));
  expect(saved[29]).toBe("t28");
});

test("saving unchanged tags still calls onSave with them", async () => {
  const { onSave } = setup(["Keep", "Me"]);
  await save();
  expect(onSave).toHaveBeenCalledWith(["Keep", "Me"]);
});

test("Enter in the field does not save", async () => {
  const { input, onSave } = setup();
  await userEvent.type(input, "a{Enter}");
  expect(onSave).not.toHaveBeenCalled();
});

test("Close asks to close without saving", async () => {
  const { onSave, onOpenChange } = setup(["Old"]);
  await userEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(onOpenChange).toHaveBeenCalledWith(false);
  expect(onSave).not.toHaveBeenCalled();
});

test("the dialog stays open and the button is disabled until the save resolves", async () => {
  const { onSave, onOpenChange } = setup(["Old"]);
  let finish!: (saved: boolean) => void;
  onSave.mockReturnValueOnce(new Promise<boolean>(resolve => { finish = resolve; }));
  const before = toastCount("Tags updated.");
  await save();
  expect(screen.getByRole("button", { name: "Save tags" })).toBeDisabled();
  expect(onOpenChange).not.toHaveBeenCalled();
  expect(toastCount("Tags updated.")).toBe(before);

  finish(true);
  await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  expect(toastCount("Tags updated.")).toBe(before + 1);
  expect(screen.getByRole("button", { name: "Save tags" })).toBeEnabled();
});

test("a failed save keeps the dialog open, re-enables the button and allows a retry", async () => {
  const { onSave, onOpenChange } = setup(["Old"]);
  onSave.mockResolvedValueOnce(false);
  const before = toastCount("Tags updated.");
  await save();
  await waitFor(() => expect(screen.getByRole("button", { name: "Save tags" })).toBeEnabled());
  expect(onOpenChange).not.toHaveBeenCalled();
  expect(toastCount("Tags updated.")).toBe(before);

  await save();
  await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  expect(onSave).toHaveBeenCalledTimes(2);
});

test("a rejected save shows its error toast and keeps the dialog open", async () => {
  const { onSave, onOpenChange } = setup(["Old"]);
  onSave.mockRejectedValueOnce(new Error("Tags refused"));
  await save();
  expect(await screen.findByText("Tags refused")).toBeInTheDocument();
  expect(screen.getAllByRole("alert", { hidden: true }).map(alert => alert.textContent)).toContain("Tags refused");
  expect(onOpenChange).not.toHaveBeenCalled();
});

test("edit, cancel and reopen shows the document's original tags again", async () => {
  const doc = sampleDocument({ tags: ["Design", "Slow"] });
  const view = (open: boolean) => <TagDialog doc={doc} open={open} onOpenChange={vi.fn()} onSave={vi.fn(async () => true)} />;
  const { rerender } = render(view(true));
  await userEvent.clear(screen.getByRole("textbox", { name: "Document tags" }));
  await userEvent.type(screen.getByRole("textbox", { name: "Document tags" }), "scribble");

  rerender(view(false));
  expect(screen.queryByRole("textbox", { name: "Document tags" })).toBeNull();
  rerender(view(true));
  expect(screen.getByRole("textbox", { name: "Document tags" })).toHaveValue("Design, Slow");
});
