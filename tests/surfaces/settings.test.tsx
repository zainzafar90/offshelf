import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsDialog } from "../../src/surfaces/settings/settings-dialog";
import { DEFAULT_SETTINGS } from "../../src/core/model";

beforeEach(() => {
  globalThis.chrome = { permissions: { getAll: async () => ({ origins: ["https://pbs.twimg.com/*"] }), remove: vi.fn(async () => true) } } as unknown as typeof chrome;
});

test("reading tab saves appearance and thread layout", async () => {
  const saved: object[] = [];
  render(<SettingsDialog open onOpenChange={() => {}} initialTab="reading" settings={DEFAULT_SETTINGS} onSave={async p => { saved.push(p); }} onChanged={async () => {}} />);
  await userEvent.click(screen.getByRole("button", { name: "Dark" }));
  expect(saved).toContainEqual({ theme: "dark" });
});

test("saving tab clamps max passes", async () => {
  const saved: object[] = [];
  render(<SettingsDialog open onOpenChange={() => {}} initialTab="saving" settings={DEFAULT_SETTINGS} onSave={async p => { saved.push(p); }} onChanged={async () => {}} />);
  const input = screen.getByRole("spinbutton", { name: "Maximum scroll passes" });
  await userEvent.clear(input); await userEvent.type(input, "500"); input.blur();
  expect(saved).toContainEqual({ maxPasses: 80 });
});

test("permissions tab lists and revokes hosts", async () => {
  render(<SettingsDialog open onOpenChange={() => {}} initialTab="permissions" settings={DEFAULT_SETTINGS} onSave={async () => {}} onChanged={async () => {}} />);
  await userEvent.click(await screen.findByRole("button", { name: "Revoke" }));
  expect(chrome.permissions.remove).toHaveBeenCalledWith({ origins: ["https://pbs.twimg.com/*"] });
});
