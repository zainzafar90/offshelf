import { offshelfManifest } from "../../wxt.config";

test("manifest keeps its values at version 1.0.0", () => {
  expect(offshelfManifest).toMatchObject({
    name: "Offshelf — save it, read it",
    version: "1.0.0",
    minimum_chrome_version: "124",
    permissions: ["activeTab", "scripting", "storage", "contextMenus", "alarms", "unlimitedStorage"],
    optional_host_permissions: ["https://*/*", "http://*/*"],
    action: { default_title: "Save to Offshelf" },
    commands: {
      "save-page": { suggested_key: { default: "Alt+Shift+S", mac: "Alt+Shift+S" } },
      "open-library": { suggested_key: { default: "Alt+Shift+L", mac: "Alt+Shift+L" } },
    },
  });
  expect(offshelfManifest.content_security_policy.extension_pages).toContain("script-src 'self';");
});
