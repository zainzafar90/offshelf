import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_SETTINGS } from "../../src/core/model";
import { ReadingTab } from "../../src/surfaces/settings/reading-tab";

vi.mock("../../src/ui/slider", () => ({
  Slider: ({ value, onValueChange, onValueCommit }: { value: number; onValueChange: (v: number) => void; onValueCommit?: (v: number) => void }) => (
    <div>
      <span data-testid="slider-value">{value}</span>
      <button onClick={() => onValueChange(value + 1)}>drag</button>
      <button onClick={() => onValueCommit?.(value)}>release</button>
    </div>
  ),
}));

test("dragging updates the displayed label without saving; releasing saves once", async () => {
  const onSave = vi.fn(async () => {});
  render(<ReadingTab settings={DEFAULT_SETTINGS} onSave={onSave} />);

  await userEvent.click(screen.getByText("drag"));
  expect(screen.getByText(`${DEFAULT_SETTINGS.fontSize + 1}px`)).toBeInTheDocument();
  expect(onSave).not.toHaveBeenCalled();

  await userEvent.click(screen.getByText("release"));
  expect(onSave).toHaveBeenCalledTimes(1);
  expect(onSave).toHaveBeenCalledWith({ fontSize: DEFAULT_SETTINGS.fontSize + 1 });
});
