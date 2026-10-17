import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_SETTINGS } from "../../src/core/model";
import { exportBackup, importBackup } from "../../src/storage/backup";
import { LibraryTab } from "../../src/surfaces/settings/library-tab";
import { PermissionsTab } from "../../src/surfaces/settings/permissions-tab";
import { SettingsDialog } from "../../src/surfaces/settings/settings-dialog";
import { Toaster } from "../../src/surfaces/shared/toast";
import { toastCount } from "../helpers/toast-count";

vi.mock("../../src/storage/backup", () => ({
  exportBackup: vi.fn(async () => {}),
  importBackup: vi.fn(async () => ({ added: 0, skipped: 0 })),
}));

let getAll: ReturnType<typeof vi.fn>;
let remove: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  getAll = vi.fn(async () => ({ origins: ["https://pbs.twimg.com/*", "https://cdn.example.org/*"] }));
  remove = vi.fn(async () => true);
  vi.stubGlobal("chrome", { permissions: { getAll, remove } });
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("permissions tab", () => {
  test("lists each granted origin with a Revoke button", async () => {
    render(<PermissionsTab />);
    expect(await screen.findByText("https://pbs.twimg.com/*")).toBeInTheDocument();
    expect(screen.getByText("https://cdn.example.org/*")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Revoke" })).toHaveLength(2);
  });

  test("shows a loading note until the granted origins have loaded", async () => {
    let release!: (value: chrome.permissions.Permissions) => void;
    getAll.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    render(<PermissionsTab />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading website access");
    release({ origins: ["https://a.example/*"] });
    expect(await screen.findByText("https://a.example/*")).toBeInTheDocument();
  });

  test("with no grants it explains that access is asked for on demand", async () => {
    getAll.mockResolvedValueOnce({ origins: [] });
    render(<PermissionsTab />);
    expect(await screen.findByText(/No persistent website access granted/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Revoke" })).toBeNull();
  });

  test("a result without an origins list is treated as no grants", async () => {
    getAll.mockResolvedValueOnce({});
    render(<PermissionsTab />);
    expect(await screen.findByText(/No persistent website access granted/)).toBeInTheDocument();
  });

  test("Revoke removes that origin only, drops its row and toasts", async () => {
    render(<><PermissionsTab /><Toaster /></>);
    await screen.findByText("https://pbs.twimg.com/*");
    const before = toastCount("Access revoked. Saved offline images are unchanged.");
    await userEvent.click(screen.getAllByRole("button", { name: "Revoke" })[0]!);

    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith({ origins: ["https://pbs.twimg.com/*"] });
    await waitFor(() => expect(screen.queryByText("https://pbs.twimg.com/*")).toBeNull());
    expect(screen.getByText("https://cdn.example.org/*")).toBeInTheDocument();
    expect(toastCount("Access revoked. Saved offline images are unchanged.")).toBe(before + 1);
  });

  test("a failing getAll toasts the error and says access could not be loaded", async () => {
    getAll.mockRejectedValueOnce(new Error("Permissions unavailable"));
    render(<><PermissionsTab /><Toaster /></>);
    expect(await screen.findByText("Could not load website access.")).toBeInTheDocument();
    expect(screen.getAllByRole("alert").map(alert => alert.textContent)).toContain("Permissions unavailable");
    expect(screen.queryByText(/Loading website access/)).toBeNull();
    expect(screen.queryByText(/No persistent website access granted/)).toBeNull();
  });

  test("a failing revoke toasts the error and keeps the origin listed", async () => {
    remove.mockRejectedValueOnce(new Error("Cannot revoke"));
    render(<><PermissionsTab /><Toaster /></>);
    await screen.findByText("https://pbs.twimg.com/*");
    const revoked = toastCount("Access revoked. Saved offline images are unchanged.");
    await userEvent.click(screen.getAllByRole("button", { name: "Revoke" })[0]!);
    expect(await screen.findByText("Cannot revoke")).toBeInTheDocument();
    expect(screen.getByText("https://pbs.twimg.com/*")).toBeInTheDocument();
    expect(toastCount("Access revoked. Saved offline images are unchanged.")).toBe(revoked);
  });

  test("revoking the last origin switches to the empty message", async () => {
    getAll.mockResolvedValueOnce({ origins: ["https://only.example/*"] });
    render(<PermissionsTab />);
    await userEvent.click(await screen.findByRole("button", { name: "Revoke" }));
    expect(await screen.findByText(/No persistent website access granted/)).toBeInTheDocument();
  });
});

describe("library tab", () => {
  const file = () => new File(["{}"], "backup.json", { type: "application/json" });
  const fileInput = (container: HTMLElement) => container.querySelector<HTMLInputElement>('input[type="file"]')!;

  test("Export backup runs the export and toasts", async () => {
    render(<><LibraryTab onChanged={async () => {}} /><Toaster /></>);
    const before = toastCount("Library backup downloaded.");
    await userEvent.click(screen.getByRole("button", { name: /Export backup/ }));
    expect(exportBackup).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(toastCount("Library backup downloaded.")).toBe(before + 1));
    expect(screen.getByRole("button", { name: /Export backup/ })).toBeEnabled();
  });

  test("Export backup is disabled while the export is running", async () => {
    let finish!: () => void;
    vi.mocked(exportBackup).mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    render(<LibraryTab onChanged={async () => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /Export backup/ }));
    expect(screen.getByRole("button", { name: /Export backup/ })).toBeDisabled();
    finish();
    await waitFor(() => expect(screen.getByRole("button", { name: /Export backup/ })).toBeEnabled());
  });

  test("a failed export toasts the error and re-enables the button", async () => {
    vi.mocked(exportBackup).mockRejectedValueOnce(new Error("Backup is too large to export"));
    render(<><LibraryTab onChanged={async () => {}} /><Toaster /></>);
    await userEvent.click(screen.getByRole("button", { name: /Export backup/ }));
    expect(await screen.findByText("Backup is too large to export")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Export backup/ })).toBeEnabled();
  });

  test("choosing a file imports it, toasts the counts and refreshes", async () => {
    vi.mocked(importBackup).mockResolvedValueOnce({ added: 3, skipped: 1 });
    const onChanged = vi.fn(async () => {});
    const { container } = render(<><LibraryTab onChanged={onChanged} /><Toaster /></>);
    const picked = file();
    await userEvent.upload(fileInput(container), picked);
    expect(importBackup).toHaveBeenCalledWith(picked);
    expect(await screen.findByText("Imported 3 items. 1 existing items left unchanged.")).toBeInTheDocument();
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  test("a failed import toasts the error and does not refresh", async () => {
    vi.mocked(importBackup).mockRejectedValueOnce(new Error("This is not an Offshelf backup"));
    const onChanged = vi.fn(async () => {});
    const { container } = render(<><LibraryTab onChanged={onChanged} /><Toaster /></>);
    await userEvent.upload(fileInput(container), file());
    expect(await screen.findByText("This is not an Offshelf backup")).toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();
  });

  test("Import backup opens the file chooser for JSON files", async () => {
    const { container } = render(<LibraryTab onChanged={async () => {}} />);
    const input = fileInput(container);
    const click = vi.spyOn(input, "click").mockImplementation(() => {});
    await userEvent.click(screen.getByRole("button", { name: /Import backup/ }));
    expect(click).toHaveBeenCalledTimes(1);
    expect(input.accept).toBe(".json,.offshelf.json,application/json");
  });
});

describe("settings dialog", () => {
  const dialog = (initialTab: "reading" | "saving" | "library" | "permissions") => (
    <SettingsDialog open onOpenChange={() => {}} initialTab={initialTab} settings={DEFAULT_SETTINGS} onSave={async () => {}} onChanged={async () => {}} />
  );

  test("opens on the requested tab", async () => {
    render(dialog("saving"));
    expect(await screen.findByRole("dialog", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Saving", selected: true })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Open reader after saving" })).toBeInTheDocument();
  });

  test("clicking a tab switches its content", async () => {
    render(dialog("reading"));
    await userEvent.click(await screen.findByRole("tab", { name: "Library" }));
    expect(screen.getByRole("button", { name: /Export backup/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Permissions" }));
    expect(await screen.findByText("https://pbs.twimg.com/*")).toBeInTheDocument();
  });

  test("a changed initialTab lands on the new tab", async () => {
    const { rerender } = render(dialog("reading"));
    await screen.findByRole("combobox", { name: "Typeface" });
    rerender(dialog("library"));
    expect(await screen.findByRole("button", { name: /Export backup/ })).toBeInTheDocument();
  });
});
