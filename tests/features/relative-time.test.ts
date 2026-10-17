import { relativeTime } from "../../src/features/library/relative-time";

const NOW = Date.parse("2026-09-10T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const MIN = 60_000;

test.each([
  [0, "just now"],
  [29_000, "just now"],
  [MIN, "1 minute ago"],
  [5 * MIN, "5 minutes ago"],
  [59 * MIN, "59 minutes ago"],
  [60 * MIN, "1 hour ago"],
  [3 * 60 * MIN, "3 hours ago"],
  [24 * 60 * MIN, "1 day ago"],
  [4 * 24 * 60 * MIN, "4 days ago"],
])("%i ms ago reads %j", (offset, expected) => {
  expect(relativeTime(ago(offset), NOW)).toBe(expected);
});

test("defaults to the current time", () => {
  expect(relativeTime(new Date().toISOString())).toBe("just now");
});
