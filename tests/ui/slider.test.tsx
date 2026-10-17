import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Slider } from "../../src/ui/slider";

test("pressing an arrow key changes the value and commits it", async () => {
  const onValueChange = vi.fn();
  const onValueCommit = vi.fn();
  render(<Slider ariaLabel="Text size" min={15} max={26} value={20} onValueChange={onValueChange} onValueCommit={onValueCommit} />);
  const thumb = screen.getByRole("slider");
  thumb.focus();
  await userEvent.keyboard("{ArrowRight}");
  expect(onValueChange).toHaveBeenCalledWith(21);
  expect(onValueCommit).toHaveBeenCalledWith(21);
});

test("works without an onValueCommit handler", async () => {
  const onValueChange = vi.fn();
  render(<Slider ariaLabel="Text size" min={15} max={26} value={20} onValueChange={onValueChange} />);
  const thumb = screen.getByRole("slider");
  thumb.focus();
  await userEvent.keyboard("{ArrowRight}");
  expect(onValueChange).toHaveBeenCalledWith(21);
});
