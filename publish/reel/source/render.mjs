import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire(new URL("../../../package.json", import.meta.url));
const { chromium } = require("@playwright/test");
const [mode = "stills", ...rest] = process.argv.slice(2);
const dir = new URL(".", import.meta.url).pathname;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on("pageerror", e => errors.push(e.message));
page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
await page.goto(`file://${dir}index.html?render`);
await page.evaluate(() => window.ready);
if (mode === "stills") {
  mkdirSync(`${dir}stills`, { recursive: true });
  for (const t of rest.map(Number)) {
    await page.evaluate(t => window.render(t), t);
    await page.screenshot({ path: `${dir}stills/t${t.toFixed(2)}.jpg`, type: "jpeg", quality: 82 });
  }
} else {
  mkdirSync(`${dir}frames`, { recursive: true });
  const fps = 60, from = Number(rest[0] ?? 0), to = Number(rest[1] ?? 30 * fps);
  for (let f = from; f < to; f++) {
    await page.evaluate(t => window.render(t), f / fps);
    await page.screenshot({ path: `${dir}frames/f${String(f).padStart(4, "0")}.jpg`, type: "jpeg", quality: 94 });
    if (f % 300 === 0) console.log("frame", f);
  }
}
console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "no page errors");
await browser.close();
