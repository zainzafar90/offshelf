import { installCapture } from "../../src/capture/run";

function stubChrome(version: string) {
  const addListener = vi.fn();
  vi.stubGlobal("chrome", { runtime: { id: "ext", getManifest: () => ({ version }), onMessage: { addListener } } });
  return addListener;
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete window.__offshelfCapture;
});

describe("installCapture", () => {
  test("installs one listener when called twice with the same version", () => {
    const addListener = stubChrome("1.0.0");
    installCapture();
    installCapture();
    expect(addListener).toHaveBeenCalledTimes(1);
  });
  test("replaces orphaned state from an older version", () => {
    const addListener = stubChrome("1.0.0");
    window.__offshelfCapture = { version: "0.1.0", controllers: new Map() };
    installCapture();
    expect(addListener).toHaveBeenCalledTimes(1);
    expect(window.__offshelfCapture?.version).toBe("1.0.0");
  });
});
