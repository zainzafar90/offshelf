import { canSavePage, popupPhase } from "../../src/features/popup/popup-phase";
import { jobForActivePage } from "../../src/features/popup/popup-job";
import { missingImageNote, savedNote } from "../../src/features/popup/popup-notes";
import { makeJob } from "../helpers/jobs";

describe("popupPhase", () => {
  const idle = { starting: false };

  test("loading beats error and job", () => {
    expect(popupPhase({ ...idle, loading: true, error: "x", job: makeJob() })).toBe("loading");
  });
  test("error beats job", () => {
    expect(popupPhase({ ...idle, error: "x", job: makeJob({ status: "done" }) })).toBe("error");
  });
  test.each([
    ["done", "saved"], ["failed", "failed"], ["interrupted", "failed"], ["cancelled", "failed"],
    ["capturing", "active"], ["downloading", "active"],
  ] as const)("a %s job is %s", (status, phase) => {
    expect(popupPhase({ starting: true, job: makeJob({ status }) })).toBe(phase);
  });
  test("without a job it is starting or idle", () => {
    expect(popupPhase({ starting: true })).toBe("starting");
    expect(popupPhase(idle)).toBe("idle");
  });
});

test("only http(s) pages that are not starting can be saved", () => {
  expect(canSavePage("https://a.example/x", false)).toBe(true);
  expect(canSavePage("http://a.example/x", false)).toBe(true);
  expect(canSavePage("https://a.example/x", true)).toBe(false);
  expect(canSavePage("chrome://extensions", false)).toBe(false);
  expect(canSavePage(undefined, false)).toBe(false);
});

describe("jobForActivePage", () => {
  const POST_A = "https://x.com/ada/status/1";
  const POST_B = "https://x.com/ada/status/2";
  const jobs = [
    makeJob({ id: "a", tabId: 1, sourceUrl: POST_A, status: "done", createdAt: "2026-09-01T10:00:00.000Z" }),
    makeJob({ id: "b", tabId: 1, sourceUrl: POST_B, status: "done", createdAt: "2026-09-03T10:00:00.000Z" }),
    makeJob({ id: "c", tabId: 2, sourceUrl: POST_A, status: "done", createdAt: "2026-09-05T10:00:00.000Z" }),
  ];
  test("picks the tab's job saved from the current page", () => {
    expect(jobForActivePage(jobs, { id: 1, url: POST_B })?.id).toBe("b");
    expect(jobForActivePage(jobs, { id: 1, url: POST_A })?.id).toBe("a");
  });
  test("matches the canonical URL, ignoring tracking params and twitter.com", () => {
    expect(jobForActivePage(jobs, { id: 1, url: "https://twitter.com/ada/status/1?s=20&t=x" })?.id).toBe("a");
  });
  test("a finished save does not mark another page in the same tab as saved", () => {
    expect(jobForActivePage(jobs, { id: 1, url: "https://x.com/emil/status/9" })).toBeUndefined();
  });
  test("a running job stays visible after the tab navigates", () => {
    const running = [...jobs, makeJob({ id: "d", tabId: 1, sourceUrl: POST_A, status: "capturing", createdAt: "2026-09-04T10:00:00.000Z" })];
    expect(jobForActivePage(running, { id: 1, url: "https://x.com/emil/status/9" })?.id).toBe("d");
  });
  test("is undefined for other, missing or unparseable tabs", () => {
    expect(jobForActivePage(jobs, { id: 9, url: POST_A })).toBeUndefined();
    expect(jobForActivePage(jobs, undefined)).toBeUndefined();
    expect(jobForActivePage(jobs, { id: 1, url: "not a url" })).toBeUndefined();
  });
});

describe("popup notes", () => {
  test("savedNote counts posts only past one and pluralizes images", () => {
    expect(savedNote(makeJob({ posts: 1, savedImages: 1 }))).toBe("1 image stored offline");
    expect(savedNote(makeJob({ posts: 3, savedImages: 0 }))).toBe("3 posts · 0 images stored offline");
  });
  test("missingImageNote only appears when images are missing", () => {
    expect(missingImageNote(makeJob({ images: 2, savedImages: 2 }))).toBeUndefined();
    expect(missingImageNote(makeJob({ images: 2, savedImages: 1 }))).toBe("1 image needs permission from its host. Fix it from the reader.");
    expect(missingImageNote(makeJob({ images: 4, savedImages: 1 }))).toBe("3 images need permission from its host. Fix it from the reader.");
  });
});
