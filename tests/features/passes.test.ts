import { clampPasses } from "../../src/features/settings/passes";

test.each([
  ["500", 80], ["81", 80], ["80", 80], ["1", 1], ["0", 24], ["-5", 1], ["12.7", 12], ["abc", 24], ["", 24], [" 7 ", 7],
])("clampPasses(%j) is %i", (raw, expected) => {
  expect(clampPasses(raw)).toBe(expected);
});
