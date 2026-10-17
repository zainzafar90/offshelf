import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_SETTINGS } from "../../src/core/model";
import { SavingTab } from "../../src/surfaces/settings/saving-tab";
import { Dialog, DialogContent } from "../../src/ui/dialog";
import { Input, SearchInput } from "../../src/ui/input";
import { Select } from "../../src/ui/select";
import { Slider } from "../../src/ui/slider";
import { Switch } from "../../src/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "../../src/ui/tabs";

const RING = "focus-visible:outline-foreground";

function expectFocusRing(element: HTMLElement) {
  expect(element.className).toContain("focus-visible:outline-2");
  expect(element.className).toContain(RING);
}

describe("keyboard focus is visible", () => {
  test("select trigger", () => {
    render(<Select ariaLabel="Sort" value="a" onValueChange={() => {}} options={[["a", "A"], ["b", "B"]]} />);
    expectFocusRing(screen.getByRole("combobox", { name: "Sort" }));
  });

  test("switch", () => {
    render(<Switch ariaLabel="Toggle" checked={false} onCheckedChange={() => {}} />);
    expectFocusRing(screen.getByRole("switch", { name: "Toggle" }));
  });

  test("tabs trigger", () => {
    render(<Tabs defaultValue="one"><TabsList><TabsTrigger value="one">One</TabsTrigger></TabsList></Tabs>);
    expectFocusRing(screen.getByRole("tab", { name: "One" }));
  });

  test("dialog close button", () => {
    render(<Dialog open><DialogContent title="Hello"><p>body</p></DialogContent></Dialog>);
    expectFocusRing(screen.getByRole("button", { name: "Close" }));
  });

  test("slider thumb", () => {
    render(<Slider ariaLabel="Size" min={1} max={5} value={2} onValueChange={() => {}} />);
    expectFocusRing(screen.getByRole("slider"));
  });

  test("text input", () => {
    render(<Input aria-label="Name" />);
    expectFocusRing(screen.getByRole("textbox", { name: "Name" }));
  });

  test("search field shows the ring on its wrapper while the input has focus", () => {
    render(<SearchInput value="" onChange={() => {}} />);
    const wrapper = screen.getByRole("searchbox").parentElement!;
    expect(wrapper.className).toContain("focus-within:outline-2");
    expect(wrapper.className).toContain("focus-within:outline-foreground");
  });

  test("scroll passes number input", () => {
    render(<SavingTab settings={DEFAULT_SETTINGS} onSave={async () => {}} />);
    expectFocusRing(screen.getByRole("spinbutton", { name: "Maximum scroll passes" }));
  });

  test("tabbing onto the switch focuses it", async () => {
    render(<Switch ariaLabel="Toggle" checked={false} onCheckedChange={() => {}} />);
    await userEvent.tab();
    expect(screen.getByRole("switch", { name: "Toggle" })).toHaveFocus();
  });
});

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(tsx?|css)$/.test(entry.name) ? [path] : [];
  });
}

describe("colors come from tokens", () => {
  const HARDCODED = /rgba?\(|hsla?\(|\bbg-(black|white)\b|\btext-(black|white)\b|#[0-9a-fA-F]{3,8}\b/;
  const files = [...sourceFiles(join(process.cwd(), "src/ui")), ...sourceFiles(join(process.cwd(), "src/surfaces"))];

  test.each(files.map(file => file.replace(process.cwd(), "")))("%s has no hardcoded colors", file => {
    const source = readFileSync(join(process.cwd(), file), "utf8");
    expect(source.match(HARDCODED)).toBeNull();
  });

  const tokens = readFileSync(join(process.cwd(), "src/styles/tokens.css"), "utf8");
  const light = tokens.slice(0, tokens.indexOf(':root[data-theme="dark"]'));
  const dark = tokens.slice(tokens.indexOf(':root[data-theme="dark"]'));

  test.each(["--overlay", "--switch-thumb", "--elevation-dialog", "--elevation-menu", "--elevation-thumb"])("%s is defined for light and dark", name => {
    expect(light).toContain(`${name}:`);
    expect(dark).toContain(`${name}:`);
  });
});
