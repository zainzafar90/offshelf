import { parseWorkerRequest } from "../../src/core/worker-contract";

describe("parseWorkerRequest accepts every message type", () => {
  test.each([
    [{ type: "offshelf:start", tabId: 7 }, { type: "offshelf:start", tabId: 7, mode: undefined }],
    [{ type: "offshelf:start", tabId: 7, mode: "area" }, { type: "offshelf:start", tabId: 7, mode: "area" }],
    [{ type: "offshelf:start", tabId: 7, mode: null }, { type: "offshelf:start", tabId: 7, mode: undefined }],
    [{ type: "offshelf:open-library", extra: 1 }, { type: "offshelf:open-library" }],
    [{ type: "offshelf:changed" }, { type: "offshelf:changed" }],
    [{ type: "offshelf:cancel-job", jobId: "j1" }, { type: "offshelf:cancel-job", jobId: "j1" }],
    [{ type: "offshelf:delete", documentId: "d1" }, { type: "offshelf:delete", documentId: "d1" }],
    [{ type: "offshelf:retry-images", documentId: "d1" }, { type: "offshelf:retry-images", documentId: "d1" }],
    [{ type: "offshelf:checkpoint", jobId: "j1", snapshot: { a: 1 }, message: "Saved" }, { type: "offshelf:checkpoint", jobId: "j1", snapshot: { a: 1 }, message: "Saved" }],
    [{ type: "offshelf:checkpoint", jobId: "j1", snapshot: 1, message: 5 }, { type: "offshelf:checkpoint", jobId: "j1", snapshot: 1, message: undefined }],
    [{ type: "offshelf:finish", jobId: "j1" }, { type: "offshelf:finish", jobId: "j1" }],
    [{ type: "offshelf:capture-error", jobId: "j1", error: "boom", cancelled: true }, { type: "offshelf:capture-error", jobId: "j1", error: "boom", cancelled: true }],
    [{ type: "offshelf:capture-error", jobId: "j1", error: 4, cancelled: "yes" }, { type: "offshelf:capture-error", jobId: "j1", error: undefined, cancelled: false }],
  ])("%j", (input, expected) => {
    expect(parseWorkerRequest(input)).toEqual(expected);
  });
});

describe("parseWorkerRequest rejects bad input", () => {
  test.each([undefined, null, "offshelf:start", 4, [], {}, { type: 3 }, { type: "offshelf:nope" }, { type: "offshelf:run" }])("unknown action %j", input => {
    expect(() => parseWorkerRequest(input)).toThrow("Unknown Offshelf action.");
  });
  test.each([
    ["a string tab id", { tabId: "7" }],
    ["a missing tab id", {}],
    ["a fractional tab id", { tabId: 1.5 }],
    ["an unknown mode", { tabId: 7, mode: "everything" }],
    ["a non-string mode", { tabId: 7, mode: 3 }],
  ])("start with %s", (_label, extra) => {
    expect(() => parseWorkerRequest({ type: "offshelf:start", ...extra })).toThrow("Invalid capture request.");
  });
  test.each([
    ["offshelf:cancel-job", "jobId"],
    ["offshelf:delete", "documentId"],
    ["offshelf:retry-images", "documentId"],
  ])("%s needs a string %s", (type, field) => {
    expect(() => parseWorkerRequest({ type })).toThrow("Missing identifier.");
    expect(() => parseWorkerRequest({ type, [field]: 12 })).toThrow("Missing identifier.");
    expect(() => parseWorkerRequest({ type, [field]: null })).toThrow("Missing identifier.");
  });
  test.each(["offshelf:checkpoint", "offshelf:finish", "offshelf:capture-error"])("%s needs a string job id", type => {
    expect(() => parseWorkerRequest({ type })).toThrow("Missing capture identifier.");
    expect(() => parseWorkerRequest({ type, jobId: 9 })).toThrow("Missing capture identifier.");
  });
});
