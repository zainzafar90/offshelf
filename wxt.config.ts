import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

export const offshelfManifest = {
  name: "Offshelf — save it, read it",
  description: "Save articles and X threads with images. Read offline. Export HTML, Markdown and print-ready PDF.",
  version: "1.0.0",
  minimum_chrome_version: "124",
  permissions: ["activeTab", "scripting", "storage", "contextMenus", "alarms", "unlimitedStorage"],
  optional_host_permissions: ["https://*/*", "http://*/*"],
  icons: { "16": "/icons/16.png", "32": "/icons/32.png", "48": "/icons/48.png", "128": "/icons/128.png" },
  action: {
    default_title: "Save to Offshelf",
    default_icon: { "16": "/icons/16.png", "32": "/icons/32.png" },
  },
  commands: {
    "save-page": { suggested_key: { default: "Alt+Shift+S", mac: "Alt+Shift+S" }, description: "Save the current article or thread" },
    "open-library": { suggested_key: { default: "Alt+Shift+L", mac: "Alt+Shift+L" }, description: "Open your Offshelf library" },
  },
  content_security_policy: {
    extension_pages:
      "default-src 'self'; script-src 'self'; object-src 'none'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self' https: http:; frame-src 'self'; base-uri 'none'; form-action 'none'",
  },
};

export default defineConfig({
  srcDir: ".",
  modules: ["@wxt-dev/module-react"],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: offshelfManifest,
  hooks: {
    "build:manifestGenerated": (_wxt, manifest) => {
      // WXT otherwise copies the popup <title> into action.default_title (the toolbar tooltip).
      manifest.action = { ...manifest.action, default_title: offshelfManifest.action.default_title };
    },
  },
});
