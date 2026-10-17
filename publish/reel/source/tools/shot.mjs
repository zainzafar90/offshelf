import { createRequire } from "node:module";
const require = createRequire(new URL("../../../../package.json", import.meta.url));
const { chromium } = require("@playwright/test");
const [file, out, w = "600", h = "310"] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: +w, height: +h } });
await p.goto(`file://${new URL("..", import.meta.url).pathname}${file}`); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(400);
await p.screenshot({ path: out }); await b.close();
