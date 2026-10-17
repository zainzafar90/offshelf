import { downloadImage } from "../../src/background/image-fetch";
import { downloadJob } from "../../src/background/download-job";
import { LIMITS } from "../../src/core/model";
import type { Asset, CaptureJob } from "../../src/core/model";
import { stableId } from "../../src/core/identity";
import { getAsset, putAsset, putDocument } from "../../src/storage/library-store";
import { getJob, putJob, mutateJob } from "../../src/storage/job-store";
import { installChrome, uninstallChrome } from "../helpers/chrome";
import type { ChromeHarness } from "../helpers/chrome";
import { PNG_BYTES, makeAsset, makeDoc, makeJob, pngResponse } from "../helpers/jobs";
import { resetDatabase } from "../helpers/reset-db";

let harness: ChromeHarness;
const notify = vi.fn(async () => {});
const openReader = vi.fn(async (_job: CaptureJob) => {});
const url = (n: number) => `https://img.example.com/${n}.png`;
const MB = 1024 * 1024;

/* Seeds a downloading job whose document references the given assets. */
async function seed(assets: Asset[], job: Partial<CaptureJob> = {}) {
  await putDocument(makeDoc({ assetIds: assets.map(asset => asset.id) }));
  for (const asset of assets) await putAsset(asset);
  await putJob(makeJob({ status: "downloading", ...job }));
}
const sleep = vi.fn(async (_ms: number) => {});
const run = () => downloadJob("job-1", notify, openReader, sleep);
const stubFetch = (impl: (input: string) => Promise<Response>) => vi.stubGlobal("fetch", vi.fn(impl));

beforeEach(async () => {
  await resetDatabase();
  harness = installChrome();
  notify.mockClear();
  sleep.mockClear();
  openReader.mockClear();
  stubFetch(async () => pngResponse());
});
afterEach(uninstallChrome);

describe("downloadJob saving", () => {
  test("saves a PNG as a saved image asset and finishes the job", async () => {
    await seed([makeAsset(url(1))]);
    await run();
    const asset = (await getAsset(stableId(url(1)))) as Asset;
    expect(asset).toMatchObject({ status: "saved", bytes: PNG_BYTES.length, mime: "image/png", attempts: 1, error: undefined });
    /* fake-indexeddb clones jsdom Blobs to plain objects, so only presence is checkable */
    expect(asset.blob).toBeDefined();
    expect(await getJob("job-1")).toMatchObject({ status: "done", savedImages: 1, images: 1, message: "Saved to your library" });
    expect(harness.chrome.action.setBadgeText).toHaveBeenCalledWith({ tabId: 7, text: "✓" });
    expect(openReader).toHaveBeenCalledWith(expect.objectContaining({ id: "job-1", status: "done" }));
  });
  test("fetches without credentials or referrer", async () => {
    await seed([makeAsset(url(1))]);
    await run();
    expect(fetch).toHaveBeenCalledWith(url(1), expect.objectContaining({ credentials: "omit", redirect: "follow", referrerPolicy: "no-referrer" }));
  });
  test("sets the saved mime from the file signature, not the server header", async () => {
    stubFetch(async () => pngResponse(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0]), { headers: { "content-type": "text/html" } }));
    await seed([makeAsset(url(1))]);
    await run();
    expect((await getAsset(stableId(url(1))))?.mime).toBe("image/jpeg");
  });
  test("skips assets that are already saved", async () => {
    await seed([makeAsset(url(1), { status: "saved", bytes: 10, mime: "image/png" }), makeAsset(url(2))]);
    await run();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(url(2), expect.anything());
    expect(await getJob("job-1")).toMatchObject({ savedImages: 2, images: 2, message: "Saved to your library" });
  });
  test("a document without images finishes immediately", async () => {
    await seed([]);
    await run();
    expect(fetch).not.toHaveBeenCalled();
    expect(await getJob("job-1")).toMatchObject({ status: "done", savedImages: 0, images: 0, message: "Saved to your library" });
  });
  test("notifies once per asset plus once at the end", async () => {
    await seed([makeAsset(url(1)), makeAsset(url(2)), makeAsset(url(3)), makeAsset(url(4))]);
    await run();
    expect(notify).toHaveBeenCalledTimes(5);
  });
  test("downloads at most three images at a time", async () => {
    let active = 0, peak = 0;
    stubFetch(async () => {
      peak = Math.max(peak, ++active);
      await new Promise(resolve => setTimeout(resolve, 15));
      active--;
      return pngResponse();
    });
    /* spread over hosts: one host is capped at two by the per-host limit */
    await seed(Array.from({ length: 7 }, (_, i) => makeAsset(`https://h${i % 3}.example.com/${i}.png`)));
    await run();
    expect(fetch).toHaveBeenCalledTimes(7);
    expect(peak).toBe(3);
  });
  test("ignores a second call for a job that is already downloading", async () => {
    await seed([makeAsset(url(1)), makeAsset(url(2))]);
    await Promise.all([run(), run()]);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(openReader).toHaveBeenCalledTimes(1);
  });
});

describe("downloadJob failures", () => {
  test("non-image bytes fail the asset and leave the job done with a needs-attention message", async () => {
    stubFetch(async () => new Response("<html>not an image</html>"));
    await seed([makeAsset(url(1))]);
    await run();
    const asset = (await getAsset(stableId(url(1)))) as Asset;
    expect(asset).toMatchObject({ status: "failed", bytes: 0, error: "Unsupported image format. SVG and HTML responses are not saved as executable files." });
    expect(asset.blob).toBeUndefined();
    expect(await getJob("job-1")).toMatchObject({ status: "done", savedImages: 0, images: 1, message: "Text saved · 1 image needs attention" });
    expect(harness.chrome.action.setBadgeText).toHaveBeenCalledWith({ tabId: 7, text: "!" });
    expect(openReader).toHaveBeenCalled();
  });
  test("pluralises the attention message for several failed images", async () => {
    stubFetch(async () => new Response("nope", { status: 500 }));
    await seed([makeAsset(url(1)), makeAsset(url(2))]);
    await run();
    expect((await getJob("job-1"))?.message).toBe("Text saved · 2 images need attention");
  });
  test("an HTTP error status fails the asset", async () => {
    stubFetch(async () => new Response("gone", { status: 404 }));
    await seed([makeAsset(url(1))]);
    await run();
    expect(await getAsset(stableId(url(1)))).toMatchObject({ status: "failed", error: "The image server returned HTTP 404." });
  });
  test("an empty response body fails the asset", async () => {
    stubFetch(async () => new Response(null, { status: 200 }));
    await seed([makeAsset(url(1))]);
    await run();
    expect((await getAsset(stableId(url(1))))?.error).toBe("The image response was empty.");
  });
  test("a network error without host permission is marked permission", async () => {
    stubFetch(async () => { throw new TypeError("Failed to fetch"); });
    harness.chrome.permissions.contains.mockResolvedValue(false);
    await seed([makeAsset(url(1))]);
    await run();
    expect(harness.chrome.permissions.contains).toHaveBeenCalledWith({ origins: ["https://img.example.com/*"] });
    expect(await getAsset(stableId(url(1)))).toMatchObject({ status: "permission", bytes: 0, error: "Allow access to this image host to save the image offline." });
    expect(await getJob("job-1")).toMatchObject({ status: "done", message: "Text saved · 1 image needs attention" });
  });
  test("a network error with host permission is retried, then a plain failure", async () => {
    stubFetch(async () => { throw new TypeError("Failed to fetch"); });
    await seed([makeAsset(url(1))]);
    await run();
    expect(fetch).toHaveBeenCalledTimes(1 + LIMITS.imageRetries);
    expect(await getAsset(stableId(url(1)))).toMatchObject({ status: "failed", attempts: 3, error: "Failed to fetch" });
  });
  test("a failure that is not network-shaped is never marked permission", async () => {
    stubFetch(async () => new Response("x", { status: 403 }));
    harness.chrome.permissions.contains.mockResolvedValue(false);
    await seed([makeAsset(url(1))]);
    await run();
    expect((await getAsset(stableId(url(1))))?.status).toBe("failed");
  });
  test("data: images do not need host permission", async () => {
    const dataUrl = "data:image/png;base64,AAAA";
    stubFetch(async () => { throw new TypeError("Failed to fetch"); });
    harness.chrome.permissions.contains.mockResolvedValue(false);
    await seed([makeAsset(dataUrl)]);
    await run();
    expect(harness.chrome.permissions.contains).not.toHaveBeenCalled();
    expect((await getAsset(stableId(dataUrl)))?.status).toBe("failed");
  });
  test("a request that outlives the fetch timeout is aborted and can be retried", async () => {
    const realSetTimeout = globalThis.setTimeout;
    let fireTimeout: (() => void) | undefined;
    vi.spyOn(globalThis, "setTimeout").mockImplementation(((fn: () => void, ms?: number, ...rest: unknown[]) => {
      if (ms !== LIMITS.fetchTimeoutMs) return realSetTimeout(fn, ms, ...rest);
      fireTimeout = fn;
      return realSetTimeout(() => {}, 0);
    }) as typeof setTimeout);
    vi.stubGlobal("fetch", vi.fn((_input: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      queueMicrotask(() => fireTimeout?.());
    })));
    const result = await downloadImage(makeAsset(url(1)));
    vi.restoreAllMocks();
    expect(result).toMatchObject({ status: "failed", bytes: 0, error: "Image download timed out. You can retry it." });
  });
  test("increments attempts and clears the previous error", async () => {
    await seed([makeAsset(url(1), { status: "failed", attempts: 2, error: "old" })]);
    await run();
    expect(await getAsset(stableId(url(1)))).toMatchObject({ status: "saved", attempts: 3, error: undefined });
  });
});

describe("downloadJob size caps", () => {
  test("rejects an image whose content-length exceeds 20 MB", async () => {
    stubFetch(async () => pngResponse(PNG_BYTES, { headers: { "content-length": String(LIMITS.maxAssetBytes + 1) } }));
    await seed([makeAsset(url(1))]);
    await run();
    expect(await getAsset(stableId(url(1)))).toMatchObject({ status: "failed", error: "This image exceeds the 20 MB limit." });
  });
  test("rejects a streamed image that grows past 20 MB without a length header", async () => {
    const big = new Uint8Array(LIMITS.maxAssetBytes + 1);
    big.set(PNG_BYTES);
    stubFetch(async () => pngResponse(big));
    await seed([makeAsset(url(1))]);
    await run();
    expect(await getAsset(stableId(url(1)))).toMatchObject({ status: "failed", bytes: 0, error: "This image exceeds the 20 MB limit." });
  });
  test("accepts an image of exactly 20 MB", async () => {
    const exact = new Uint8Array(LIMITS.maxAssetBytes);
    exact.set(PNG_BYTES);
    stubFetch(async () => pngResponse(exact));
    await seed([makeAsset(url(1))]);
    await run();
    expect(await getAsset(stableId(url(1)))).toMatchObject({ status: "saved", bytes: LIMITS.maxAssetBytes });
  });
  test("fails pending images without fetching once the 180 MB capture budget is used", async () => {
    await seed([makeAsset(url(1), { status: "saved", bytes: LIMITS.maxCaptureBytes, mime: "image/png" }), makeAsset(url(2))]);
    await run();
    expect(fetch).not.toHaveBeenCalled();
    expect(await getAsset(stableId(url(2)))).toMatchObject({ status: "failed", error: "The 180 MB per-capture image budget was reached." });
    expect(await getJob("job-1")).toMatchObject({ status: "done", savedImages: 1, images: 2 });
  });
  test("drops a download that would push the capture over the 180 MB budget", async () => {
    await seed([makeAsset(url(1), { status: "saved", bytes: LIMITS.maxCaptureBytes - 5, mime: "image/png" }), makeAsset(url(2))]);
    await run();
    const asset = (await getAsset(stableId(url(2)))) as Asset;
    expect(asset).toMatchObject({ status: "failed", bytes: 0, error: "The 180 MB per-capture image budget was reached." });
    expect(asset.blob).toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  test("the cap constants are 20 MB per image and 180 MB per capture", () => {
    expect([LIMITS.maxAssetBytes / MB, LIMITS.maxCaptureBytes / MB]).toEqual([20, 180]);
  });
});

describe("downloadJob job state", () => {
  test("does nothing for a missing job or one that is not downloading", async () => {
    await run();
    await putJob(makeJob({ status: "capturing" }));
    await run();
    expect(fetch).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
    expect((await getJob("job-1"))?.status).toBe("capturing");
  });
  test("interrupts the job when the document was removed", async () => {
    await putJob(makeJob({ status: "downloading" }));
    await run();
    expect(await getJob("job-1")).toMatchObject({ status: "interrupted", error: "The saved document was removed.", message: "Text is saved. Retry the remaining images." });
    expect(notify).toHaveBeenCalled();
    expect(openReader).not.toHaveBeenCalled();
  });
  test("a cancelled job keeps its status and saves nothing further", async () => {
    stubFetch(async () => {
      await mutateJob("job-1", job => ({ ...job, status: "cancelled" }));
      return pngResponse();
    });
    await seed([makeAsset(url(1)), makeAsset(url(2))]);
    await run();
    expect((await getJob("job-1"))?.status).toBe("cancelled");
    expect((await getAsset(stableId(url(1))))?.status).toBe("pending");
    expect(openReader).not.toHaveBeenCalled();
    expect(harness.chrome.action.setBadgeText).not.toHaveBeenCalled();
  });
  test("reports progress on the job while images save", async () => {
    const messages: string[] = [];
    const watch = vi.fn(async () => { messages.push((await getJob("job-1"))?.message ?? ""); });
    await seed([makeAsset(url(1))]);
    await downloadJob("job-1", watch, openReader);
    expect(messages[0]).toBe("Saving images · 1 of 1 available offline");
  });
  test("a badge failure does not break completion", async () => {
    harness.chrome.action.setBadgeText.mockRejectedValue(new Error("no tab"));
    await seed([makeAsset(url(1))]);
    await run();
    expect((await getJob("job-1"))?.status).toBe("done");
  });
});
