import { readFileSync, writeFileSync, readdirSync } from "node:fs";
const dir = new URL("../snapshots/", import.meta.url);
const snap = Object.fromEntries(readdirSync(dir).filter(f => f.endsWith(".html")).map(f => [f.replace(/\.html$/, ""), readFileSync(new URL(f, dir), "utf8")]));
writeFileSync(new URL("../snapshots.js", import.meta.url), `window.SNAP = ${JSON.stringify(snap)};\n`);
console.log("packed", Object.keys(snap).join(", "));
