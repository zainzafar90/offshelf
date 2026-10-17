import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Settings } from "../../src/core/model";
import { DEFAULT_SETTINGS } from "../../src/core/model";
import { ReadingTab } from "../../src/surfaces/settings/reading-tab";
import { SavingTab } from "../../src/surfaces/settings/saving-tab";

const settings = (over: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, ...over });

async function pick(label: string, option: string) {
  await userEvent.click(screen.getByRole("combobox", { name: label }));
  await userEvent.click(await screen.findByRole("option", { name: option }));
}

describe("reading tab", () => {
  const renderTab = (over: Partial<Settings> = {}) => {
    const onSave = vi.fn(async () => {});
    const view = render(<ReadingTab settings={settings(over)} onSave={onSave} />);
    return { onSave, ...view };
  };

  test("reflects the incoming settings", () => {
    renderTab({ theme: "dark", readerFont: "sans", fontSize: 22, readerWidth: "wide", threadStyle: "cards" });
    expect(screen.getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Light" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("combobox", { name: "Typeface" })).toHaveTextContent("Sans");
    expect(screen.getByRole("combobox", { name: "Reading width" })).toHaveTextContent("Wide");
    expect(screen.getByRole("combobox", { name: "Thread layout" })).toHaveTextContent("Post cards");
    expect(screen.getByText("22px")).toBeInTheDocument();
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuenow", "22");
  });

  test("shows the defaults for default settings", () => {
    renderTab();
    expect(screen.getByRole("button", { name: "Light" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("combobox", { name: "Typeface" })).toHaveTextContent("Serif");
    expect(screen.getByRole("combobox", { name: "Reading width" })).toHaveTextContent("Comfortable");
    expect(screen.getByRole("combobox", { name: "Thread layout" })).toHaveTextContent("Continuous");
    expect(screen.getByText(`${DEFAULT_SETTINGS.fontSize}px`)).toBeInTheDocument();
  });

  test.each([["Light", "light"], ["Dark", "dark"], ["System", "system"]] as const)("Appearance %s saves only the theme", async (label, theme) => {
    const { onSave } = renderTab({ theme: theme === "light" ? "dark" : "light" });
    await userEvent.click(screen.getByRole("button", { name: label }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({ theme });
  });

  test("Typeface saves only readerFont", async () => {
    const { onSave } = renderTab();
    await pick("Typeface", "Sans");
    expect(onSave).toHaveBeenCalledWith({ readerFont: "sans" });
  });

  test("Reading width saves only readerWidth", async () => {
    const { onSave } = renderTab();
    await pick("Reading width", "Wide");
    expect(onSave).toHaveBeenCalledWith({ readerWidth: "wide" });
  });

  test("Thread layout saves only threadStyle", async () => {
    const { onSave } = renderTab();
    await pick("Thread layout", "Post cards");
    expect(onSave).toHaveBeenCalledWith({ threadStyle: "cards" });
  });

  test("the text size slider follows the keyboard and saves the new size", async () => {
    const { onSave } = renderTab({ fontSize: 20 });
    screen.getByRole("slider").focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByText("21px")).toBeInTheDocument();
    expect(onSave).toHaveBeenLastCalledWith({ fontSize: 21 });
  });

  test("a new fontSize prop replaces the displayed size", () => {
    const { rerender } = renderTab({ fontSize: 20 });
    rerender(<ReadingTab settings={settings({ fontSize: 24 })} onSave={vi.fn(async () => {})} />);
    expect(screen.getByText("24px")).toBeInTheDocument();
    expect(screen.queryByText("20px")).toBeNull();
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuenow", "24");
  });

  test("new theme and select props are reflected without remounting", () => {
    const { rerender } = renderTab({ theme: "light", readerFont: "serif" });
    rerender(<ReadingTab settings={settings({ theme: "system", readerFont: "sans" })} onSave={vi.fn(async () => {})} />);
    expect(screen.getByRole("button", { name: "System" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("combobox", { name: "Typeface" })).toHaveTextContent("Sans");
  });
});

describe("saving tab", () => {
  const renderTab = (over: Partial<Settings> = {}) => {
    const onSave = vi.fn(async () => {});
    const view = render(<SavingTab settings={settings(over)} onSave={onSave} />);
    return { onSave, ...view };
  };
  const input = () => screen.getByRole("spinbutton", { name: "Maximum scroll passes" });

  async function commit(raw: string) {
    await userEvent.clear(input());
    if (raw) await userEvent.type(input(), raw);
    await userEvent.tab();
  }

  test("reflects the incoming settings", () => {
    renderTab({ openReader: false, autoScroll: true, maxPasses: 40 });
    expect(screen.getByRole("switch", { name: "Open reader after saving" })).not.toBeChecked();
    expect(screen.getByRole("switch", { name: "Load thread continuations" })).toBeChecked();
    expect(input()).toHaveValue(40);
  });

  test("toggling Open reader after saving saves only openReader", async () => {
    const { onSave } = renderTab({ openReader: true });
    await userEvent.click(screen.getByRole("switch", { name: "Open reader after saving" }));
    expect(onSave).toHaveBeenCalledWith({ openReader: false });
  });

  test("toggling Load thread continuations saves only autoScroll", async () => {
    const { onSave } = renderTab({ autoScroll: true });
    await userEvent.click(screen.getByRole("switch", { name: "Load thread continuations" }));
    expect(onSave).toHaveBeenCalledWith({ autoScroll: false });
  });

  test("typing does not save until the field loses focus", async () => {
    const { onSave } = renderTab();
    await userEvent.clear(input());
    await userEvent.type(input(), "30");
    expect(onSave).not.toHaveBeenCalled();
    await userEvent.tab();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({ maxPasses: 30 });
  });

  test.each([
    ["500", 80],
    ["81", 80],
    ["80", 80],
    ["1", 1],
    ["0", 24],
    ["-5", 1],
    ["12.7", 12],
    ["abc", 24],
    ["", 24],
  ])("committing %j saves %i and shows it", async (raw, expected) => {
    const { onSave } = renderTab({ maxPasses: 10 });
    await commit(raw);
    expect(onSave).toHaveBeenCalledWith({ maxPasses: expected });
    expect(input()).toHaveValue(expected);
  });

  test("blurring an untouched field still saves its current value", async () => {
    /* current behavior */
    const { onSave } = renderTab({ maxPasses: 24 });
    input().focus();
    await userEvent.tab();
    expect(onSave).toHaveBeenCalledWith({ maxPasses: 24 });
  });

  test("a new maxPasses prop replaces the field's value", () => {
    const { rerender } = renderTab({ maxPasses: 24 });
    rerender(<SavingTab settings={settings({ maxPasses: 50 })} onSave={vi.fn(async () => {})} />);
    expect(input()).toHaveValue(50);
  });
});
