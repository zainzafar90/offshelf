import { downloadJob } from "../../src/background/download-job";
import type { Asset, CaptureJob } from "../../src/core/model";
import { stableId } from "../../src/core/identity";
import { getAsset, putAsset, putDocument } from "../../src/storage/library-store";
import { getJob, putJob, mutateJob } from "../../src/storage/job-store";
import { installChrome, uninstallChrome } from "../helpers/chrome";
import type { ChromeHarness } from "../helpers/chrome";
import { makeAsset, makeDoc, makeJob, pngResponse } from "../helpers/jobs";
import { resetDatabase } from "../helpers/reset-db";

let harness: ChromeHarness;
const notify = vi.fn(async () => {});
const openReader = vi.fn(async (_job: CaptureJob) => {});
const sleep = vi.fn(async (_ms: number) => {});
const url = (n: number, host = "img.example.com") => `https://${host}/${n}.png`;
const run = () => downloadJob("job-1", notify, openReader, sleep);
const stubFetch = (impl: (input: string) => Promise<Response>) => vi.stubGlobal("fetch", vi.fn(impl));
/* Serves each queued outcome once, then repeats the last. */
function sequence(...outcomes: Array<() => Response | Promise<Response>>) {
  let call = 0;
  stubFetch(async () => outcomes[Math.min(call++, outcomes.length - 1)]!());
}
const status = (code: number, headers: Record<string, string> = {}) => () => new Response("x", { status: code, headers });
const ok = () => pngResponse();

async function seed(assets: Asset[]) {
  await putDocument(makeDoc({ assetIds: assets.map(asset => asset.id) }));
  for (const asset of assets) await putAsset(asset);
  await putJob(makeJob({ status: "downloading" }));
}
const stored = (n: number, host?: string) => getAsset(stableId(url(n, host)));

beforeEach(async () => {
  await resetDatabase();
  harness = installChrome();
  notify.mockClear();
  sleep.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  uninstallChrome();
});

describe("image retry policy", () => {
  test("503 then 200 is saved on the second attempt after a 500 ms backoff", async () => {
    sequence(status(503), ok);
    await seed([makeAsset(url(1))]);
    await run();
    expect(await stored(1)).toMatchObject({ status: "saved", attempts: 2, error: undefined });
    expect(sleep.mock.calls).toEqual([[500]]);
  });
  test("404 fails after one attempt with no retry", async () => {
    sequence(status(404));
    await seed([makeAsset(url(1))]);
    await run();
    expect(await stored(1)).toMatchObject({ status: "failed", attempts: 1, error: "The image server returned HTTP 404." });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
  test("three 503s fail after three attempts with 500 then 1500 ms backoff", async () => {
    sequence(status(503));
    await seed([makeAsset(url(1))]);
    await run();
    expect(await stored(1)).toMatchObject({ status: "failed", attempts: 3, error: "The image server returned HTTP 503." });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[500], [1500]]);
  });
  test("429 honours Retry-After seconds", async () => {
    sequence(status(429, { "retry-after": "2" }), ok);
    await seed([makeAsset(url(1))]);
    await run();
    expect(sleep.mock.calls).toEqual([[2000]]);
    expect((await stored(1))?.status).toBe("saved");
  });
  test("429 Retry-After is capped at 5 s", async () => {
    sequence(status(429, { "retry-after": "600" }), ok);
    await seed([makeAsset(url(1))]);
    await run();
    expect(sleep.mock.calls).toEqual([[5000]]);
  });
  test("an aborted request is retried", async () => {
    sequence(() => { throw new DOMException("aborted", "AbortError"); }, ok);
    await seed([makeAsset(url(1))]);
    await run();
    expect(await stored(1)).toMatchObject({ status: "saved", attempts: 2 });
  });
  test("a timeout that never recovers keeps the timeout message", async () => {
    sequence(() => { throw new DOMException("aborted", "AbortError"); });
    await seed([makeAsset(url(1))]);
    await run();
    expect(await stored(1)).toMatchObject({ status: "failed", attempts: 3, error: "Image download timed out. You can retry it." });
  });
  test("a network error on a permitted host is transient, never permission", async () => {
    sequence(() => { throw new TypeError("Failed to fetch"); }, ok);
    await seed([makeAsset(url(1))]);
    await run();
    expect(await stored(1)).toMatchObject({ status: "saved", attempts: 2 });
  });
  test("a network error without permission is permission and not retried", async () => {
    stubFetch(async () => { throw new TypeError("Failed to fetch"); });
    harness.chrome.permissions.contains.mockResolvedValue(false);
    await seed([makeAsset(url(1))]);
    await run();
    expect(await stored(1)).toMatchObject({ status: "permission", attempts: 1, error: "Allow access to this image host to save the image offline." });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
  test("a permission check that throws is logged and treated as no permission", async () => {
    stubFetch(async () => { throw new TypeError("Failed to fetch"); });
    harness.chrome.permissions.contains.mockRejectedValue(new Error("boom"));
    await seed([makeAsset(url(1))]);
    await run();
    expect(await stored(1)).toMatchObject({ status: "permission", attempts: 1 });
    expect(console.error).toHaveBeenCalledWith("[offshelf] permission check failed", { assetId: stableId(url(1)), error: "boom" });
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logged).not.toContain("img.example.com");
  });
  test("oversize and unsupported formats are not retried", async () => {
    stubFetch(async () => new Response("<html></html>"));
    await seed([makeAsset(url(1))]);
    await run();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect((await stored(1))?.status).toBe("failed");
  });
  test("a cancelled job stops retrying", async () => {
    stubFetch(async () => {
      await mutateJob("job-1", job => ({ ...job, status: "cancelled" }));
      return new Response("x", { status: 503 });
    });
    await seed([makeAsset(url(1))]);
    await run();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
    expect((await getJob("job-1"))?.status).toBe("cancelled");
    expect((await stored(1))?.status).toBe("pending");
  });
  test("a job cancelled during backoff makes no further attempt", async () => {
    sequence(status(503));
    sleep.mockImplementationOnce(async () => { await mutateJob("job-1", job => ({ ...job, status: "cancelled" })); });
    await seed([makeAsset(url(1))]);
    await run();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect((await getJob("job-1"))?.status).toBe("cancelled");
  });
});

describe("per-host concurrency", () => {
  function trackConcurrency() {
    const peaks = new Map<string, number>();
    const active = new Map<string, number>();
    let overall = 0, live = 0;
    stubFetch(async input => {
      const host = new URL(input).hostname;
      active.set(host, (active.get(host) ?? 0) + 1);
      peaks.set(host, Math.max(peaks.get(host) ?? 0, active.get(host)!));
      overall = Math.max(overall, ++live);
      await new Promise(resolve => setTimeout(resolve, 10));
      live--;
      active.set(host, active.get(host)! - 1);
      return pngResponse();
    });
    return { peaks, overall: () => overall };
  }
  test("never exceeds two in-flight fetches for one host", async () => {
    const seen = trackConcurrency();
    await seed(Array.from({ length: 8 }, (_, i) => makeAsset(url(i))));
    await run();
    expect(fetch).toHaveBeenCalledTimes(8);
    expect(seen.peaks.get("img.example.com")).toBe(2);
  });
  test("still runs three downloads overall across different hosts", async () => {
    const seen = trackConcurrency();
    await seed(Array.from({ length: 9 }, (_, i) => makeAsset(url(i, `h${i % 3}.example.com`))));
    await run();
    expect(seen.overall()).toBe(3);
    expect(Math.max(...seen.peaks.values())).toBeLessThanOrEqual(2);
  });
});
