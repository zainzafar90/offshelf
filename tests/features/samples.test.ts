import { addSamples } from "../../src/features/samples/samples";
import { listAssets, listDocuments } from "../../src/storage/library-store";
import * as store from "../../src/storage/library-store";
import { validateDocument } from "../../src/core/validate";
import { installChrome, uninstallChrome } from "../helpers/chrome";
import { pngResponse } from "../helpers/jobs";
import { resetDatabase } from "../helpers/reset-db";

beforeEach(async () => {
  await resetDatabase();
  installChrome();
  vi.stubGlobal("fetch", vi.fn(async () => pngResponse()));
});
afterEach(() => {
  vi.restoreAllMocks();
  uninstallChrome();
});

describe("addSamples", () => {
  test("stores the bundled documents and the cover image", async () => {
    await addSamples();
    const docs = await listDocuments();
    expect(docs).toHaveLength(6);
    expect(await listAssets()).toHaveLength(1);
  });
  test("every stored sample is already valid", async () => {
    await addSamples();
    for (const doc of await listDocuments())
      expect(validateDocument(doc)).toEqual(doc);
  });
  test("is idempotent", async () => {
    await addSamples();
    await addSamples();
    expect(await listDocuments()).toHaveLength(6);
  });
  test("passes each document through validateDocument before writing", async () => {
    const put = vi.spyOn(store, "putDocument");
    await addSamples();
    expect(put).toHaveBeenCalledTimes(6);
    for (const [doc] of put.mock.calls)
      expect(validateDocument(doc)).toEqual(doc);
  });
  test("a failed cover fetch throws and stores no image or document", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>not found</html>", { status: 404 })));
    await expect(addSamples()).rejects.toThrow("The sample cover image could not be loaded (HTTP 404).");
    expect(await listAssets()).toEqual([]);
    expect(await listDocuments()).toEqual([]);
  });
});
