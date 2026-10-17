import { test, expect } from "./fixtures";

test("library loads samples, opens the reader, exports Markdown and prints", async ({ context, extensionId }) => {
  const errors: string[] = [];
  const page = await context.newPage();
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(`chrome-extension://${extensionId}/library.html`);
  await page.getByRole("button", { name: "Try the reader" }).click();
  const card = page.getByRole("article").first();
  await expect(card).toBeVisible();
  await card.click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Export" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: /Markdown ZIP/ }).click();
  expect((await download).suggestedFilename()).toMatch(/\.zip$/);
  const id = new URL(page.url()).searchParams.get("id");
  const print = await context.newPage();
  await print.goto(`chrome-extension://${extensionId}/print.html?id=${id}`);
  await expect(print.locator("html")).toHaveAttribute("data-ready", "true");
  expect(errors).toEqual([]);
});

test("settings change the reader typeface", async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/library.html`);
  await page.getByRole("button", { name: "Try the reader" }).click();
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("combobox", { name: "Typeface" }).click();
  await page.getByRole("option", { name: "Sans" }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("article").first().click();
  await expect(page.locator("[data-reader-prose]")).toHaveClass(/font-sans/);
});

test("popup opens without errors", async ({ context, extensionId }) => {
  const errors: string[] = [];
  const page = await context.newPage();
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(page.getByRole("button", { name: /Save this page/ })).toBeVisible();
  expect(errors).toEqual([]);
});
