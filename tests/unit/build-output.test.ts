import fs from "node:fs";
import path from "node:path";

const out = path.resolve(import.meta.dirname, "../../.output/chrome-mv3");

describe.runIf(fs.existsSync(out))("build output", () => {
  test("emits capture.js, the three pages and bundled assets at the root", () => {
    for (const f of ["capture.js", "popup.html", "library.html", "print.html", "sample-cover.png"]) {
      expect(fs.existsSync(path.join(out, f)), f).toBe(true);
    }
  });
  test("keeps the strict CSP and has no inline scripts", () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(out, "manifest.json"), "utf8"));
    expect(manifest.content_security_policy.extension_pages).toContain("script-src 'self';");
    for (const f of ["popup.html", "library.html", "print.html"]) {
      const html = fs.readFileSync(path.join(out, f), "utf8");
      expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/);
    }
  });
  test("keeps the toolbar title", () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(out, "manifest.json"), "utf8"));
    expect(manifest.action.default_title).toBe("Save to Offshelf");
    expect(manifest.action.default_popup).toBe("popup.html");
  });
});
