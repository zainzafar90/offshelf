import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Asset } from "../../src/core/model";
import * as actions from "../../src/exports/actions";
import { ExportMenu } from "../../src/surfaces/reader/export-menu";
import { Toaster } from "../../src/surfaces/shared/toast";
import { sampleDocument } from "../helpers/fixtures";

vi.mock("../../src/exports/actions", async importOriginal => ({
  ...(await importOriginal<typeof import("../../src/exports/actions")>()),
  exportHtml: vi.fn(async () => {}),
  exportMarkdownZip: vi.fn(async () => {}),
  exportPdf: vi.fn(),
  copyMarkdown: vi.fn(async () => {}),
}));

const doc = sampleDocument({ id: "exp-1" });
const assets = new Map<string, Asset>();

async function choose(name: RegExp) {
  render(<><ExportMenu doc={doc} assets={assets} /><Toaster /></>);
  await userEvent.click(screen.getByRole("button", { name: /Export/ }));
  await userEvent.click(await screen.findByRole("menuitem", { name }));
}

beforeEach(() => vi.clearAllMocks());

test("the menu lists the four export options with descriptions", async () => {
  render(<ExportMenu doc={doc} assets={assets} />);
  await userEvent.click(screen.getByRole("button", { name: /Export/ }));
  const items = await screen.findAllByRole("menuitem");
  expect(items.map(item => item.textContent)).toEqual([
    "HTMLOne file, with offline images",
    "Markdown ZIParticle.md + an assets folder",
    "PDFChrome Print → Save as PDF",
    "Copy MarkdownImage links stay online",
  ]);
});

test("HTML exports the document and toasts", async () => {
  await choose(/^HTML/);
  expect(actions.exportHtml).toHaveBeenCalledWith(doc, assets);
  expect(await screen.findByText("Offline HTML downloaded.")).toBeInTheDocument();
  expect(actions.exportMarkdownZip).not.toHaveBeenCalled();
});

test("Markdown ZIP exports the archive and toasts", async () => {
  await choose(/^Markdown ZIP/);
  expect(actions.exportMarkdownZip).toHaveBeenCalledWith(doc, assets);
  expect(await screen.findByText("Markdown archive downloaded.")).toBeInTheDocument();
});

test("PDF opens the print layout for the document and shows no toast", async () => {
  render(<><ExportMenu doc={doc} assets={assets} /><Toaster /></>);
  const toastsBefore = screen.queryAllByRole("status", { hidden: true }).length;
  await userEvent.click(screen.getByRole("button", { name: /Export/ }));
  await userEvent.click(await screen.findByRole("menuitem", { name: /^PDF/ }));
  expect(actions.exportPdf).toHaveBeenCalledWith(doc);
  expect(screen.queryAllByRole("status", { hidden: true })).toHaveLength(toastsBefore);
});

test("Copy Markdown copies and warns that image links need internet", async () => {
  await choose(/^Copy Markdown/);
  expect(actions.copyMarkdown).toHaveBeenCalledWith(doc, assets);
  expect(await screen.findByText("Markdown copied. Image links require internet access.")).toBeInTheDocument();
});

test("a failing export toasts the error instead of the success message", async () => {
  vi.mocked(actions.exportHtml).mockRejectedValueOnce(new Error("Disk is full"));
  await choose(/^HTML/);
  expect(await screen.findByText("Disk is full")).toBeInTheDocument();
  expect(screen.getAllByRole("alert").map(alert => alert.textContent)).toContain("Disk is full");
});

test("items are disabled while an export runs, so a second click cannot start a duplicate", async () => {
  let finish!: () => void;
  vi.mocked(actions.exportHtml).mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));
  await choose(/^HTML/);
  await userEvent.click(screen.getByRole("button", { name: /Export/ }));
  const items = await screen.findAllByRole("menuitem");
  expect(items.every(item => item.getAttribute("aria-disabled") === "true")).toBe(true);
  await userEvent.click(items[0]!);
  await userEvent.click(items[1]!);
  expect(actions.exportHtml).toHaveBeenCalledTimes(1);
  expect(actions.exportMarkdownZip).not.toHaveBeenCalled();

  finish();
  await screen.findByText("Offline HTML downloaded.");
  await userEvent.keyboard("{Escape}");
  await userEvent.click(screen.getByRole("button", { name: /Export/ }));
  const after = await screen.findAllByRole("menuitem");
  expect(after.some(item => item.getAttribute("aria-disabled") === "true")).toBe(false);
});

test("a failed export re-enables the items", async () => {
  vi.mocked(actions.exportHtml).mockRejectedValueOnce(new Error("Export blew up"));
  await choose(/^HTML/);
  await screen.findByText("Export blew up");
  await userEvent.click(screen.getByRole("button", { name: /Export/ }));
  const items = await screen.findAllByRole("menuitem");
  expect(items.some(item => item.getAttribute("aria-disabled") === "true")).toBe(false);
});

test("only the last option, Copy Markdown, sits below a separator", async () => {
  render(<ExportMenu doc={doc} assets={assets} />);
  await userEvent.click(screen.getByRole("button", { name: /Export/ }));
  const items = await screen.findAllByRole("menuitem");
  expect(items.map(item => item.className.includes("border-t"))).toEqual([false, false, false, true]);
});
