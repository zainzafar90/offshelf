import { cleanup, screen, waitFor } from "@testing-library/react";
import { DEFAULT_SETTINGS } from "../../src/core/model";

const getSettings = vi.hoisted(() => vi.fn());

vi.mock("../../src/storage/library-store", () => ({ getSettings }));
vi.mock("../../src/surfaces/popup/popup-page", () => ({ PopupPage: () => <p>popup page</p> }));

beforeEach(() => {
  vi.resetModules();
  document.body.innerHTML = '<div id="app"></div>';
  delete document.documentElement.dataset.theme;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test("a settings read failure is logged and the popup still renders with the default theme", async () => {
  getSettings.mockRejectedValue(new Error("Settings unreadable"));
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  await import("../../entrypoints/popup/main");
  expect(await screen.findByText("popup page")).toBeInTheDocument();
  await waitFor(() => expect(log).toHaveBeenCalledWith(expect.stringContaining("using defaults"), "Settings unreadable"));
  expect(document.documentElement.dataset.theme).toBe("light");
});

test("a stored theme is applied", async () => {
  getSettings.mockResolvedValue({ ...DEFAULT_SETTINGS, theme: "dark" });
  await import("../../entrypoints/popup/main");
  await waitFor(() => expect(document.documentElement.dataset.theme).toBe("dark"));
});
