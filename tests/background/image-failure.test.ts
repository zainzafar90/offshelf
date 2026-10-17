import { classifyImageFailure, parseRetryAfterMs, retryDelayMs } from "../../src/background/image-failure";
import { LIMITS } from "../../src/core/model";

describe("classifyImageFailure", () => {
  test("network failure without host permission needs permission", () => {
    expect(classifyImageFailure({ type: "network" }, false)).toBe("permission");
  });
  test("network failure with host permission is transient", () => {
    expect(classifyImageFailure({ type: "network" }, true)).toBe("transient");
  });
  test("timeouts are transient with or without permission", () => {
    expect(classifyImageFailure({ type: "timeout" }, true)).toBe("transient");
    expect(classifyImageFailure({ type: "timeout" }, false)).toBe("transient");
  });
  test.each([408, 425, 429, 500, 502, 503, 504, 599])("HTTP %i is transient", status => {
    expect(classifyImageFailure({ type: "http", status }, true)).toBe("transient");
  });
  test.each([400, 401, 403, 404, 410, 451])("HTTP %i is permanent", status => {
    expect(classifyImageFailure({ type: "http", status }, true)).toBe("permanent");
  });
  test("HTTP failures are never permission failures", () => {
    expect(classifyImageFailure({ type: "http", status: 403 }, false)).toBe("permanent");
  });
  test("invalid content (oversize, empty, format) is permanent", () => {
    expect(classifyImageFailure({ type: "invalid" }, true)).toBe("permanent");
    expect(classifyImageFailure({ type: "invalid" }, false)).toBe("permanent");
  });
});

describe("retry timing", () => {
  test("backs off 500 ms then 1500 ms", () => {
    expect([retryDelayMs(0), retryDelayMs(1)]).toEqual([500, 1500]);
  });
  test("Retry-After seconds are honoured and capped at 5 s", () => {
    expect(parseRetryAfterMs("2")).toBe(2000);
    expect(parseRetryAfterMs("120")).toBe(LIMITS.retryAfterCapMs);
    expect(retryDelayMs(0, 2000)).toBe(2000);
    expect(retryDelayMs(0, 60_000)).toBe(5000);
  });
  test("ignores a missing or non-numeric Retry-After", () => {
    expect(parseRetryAfterMs(null)).toBeUndefined();
    expect(parseRetryAfterMs("Wed, 21 Oct 2026 07:28:00 GMT")).toBeUndefined();
  });
});
