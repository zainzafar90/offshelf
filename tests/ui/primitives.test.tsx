import { render, screen, act } from "@testing-library/react";
import { Button } from "../../src/ui/button";
import { SearchInput } from "../../src/ui/input";
import userEvent from "@testing-library/user-event";
import { Avatar } from "../../src/surfaces/shared/avatar";
import { Logo } from "../../src/surfaces/shared/logo";
import { Segmented } from "../../src/ui/segmented";
import { Switch } from "../../src/ui/switch";
import { Toaster, toast } from "../../src/surfaces/shared/toast";

test("Avatar shows two initials in gray", () => {
  render(<Avatar name="Ada Park" />);
  expect(screen.getByText("AP").className).toContain("bg-muted-hover");
});
test("Logo draws the ringed planet with token colors", () => {
  const { container } = render(<Logo size={20} />);
  expect(container.querySelector("ellipse")?.getAttribute("stroke")).toBe("var(--logo-ring)");
  expect(container.querySelector("circle")?.getAttribute("fill")).toBe("var(--logo-planet)");
});
test("Segmented reports the picked value", async () => {
  const picked: string[] = [];
  render(<Segmented ariaLabel="Mode" value="auto" options={[["auto", "Auto"], ["area", "Area"]]} onChange={v => picked.push(v)} />);
  await userEvent.click(screen.getByRole("button", { name: "Area" }));
  expect(picked).toEqual(["area"]);
  expect(screen.getByRole("button", { name: "Auto" })).toHaveAttribute("aria-pressed", "true");
});
test("Segmented content fit sizes buttons to content instead of stretching", () => {
  render(<Segmented ariaLabel="Appearance" fit="content" value="system" options={[["light", "Light"], ["system", "System"]]} onChange={() => {}} />);
  const button = screen.getByRole("button", { name: "System" });
  expect(button.className).not.toContain("flex-1");
  expect(button.className).toContain("h-[30px]");
});
test("Switch toggles", async () => {
  const seen: boolean[] = [];
  render(<Switch ariaLabel="Open reader" checked={false} onCheckedChange={v => seen.push(v)} />);
  await userEvent.click(screen.getByRole("switch", { name: "Open reader" }));
  expect(seen).toEqual([true]);
});
test("toast shows and uses alert role for errors", () => {
  render(<Toaster />);
  act(() => toast("Could not save", "error"));
  expect(screen.getByRole("alert")).toHaveTextContent("Could not save");
});

test("inputs are 36px tall", () => {
  render(<SearchInput value="" onChange={() => {}} placeholder="Search" />);
  expect(screen.getByRole("searchbox").closest("label, div")?.className).toContain("h-9");
});

test("an icon button shows its label as a tooltip", async () => {
  render(<Button size="icon" aria-label="Edit tags"><span>icon</span></Button>);
  await userEvent.tab();
  expect(await screen.findByRole("tooltip")).toHaveTextContent("Edit tags");
});
