import { parseTags } from "../../src/features/library/tags";

test("splits on commas and trims", () => {
  expect(parseTags(" Design , Engineering,Read again ")).toEqual(["Design", "Engineering", "Read again"]);
});
test("drops empty entries and duplicates", () => {
  expect(parseTags("a,,a, ,b")).toEqual(["a", "b"]);
  expect(parseTags("")).toEqual([]);
});
test("caps each tag at 80 characters", () => {
  expect(parseTags("x".repeat(100))[0]).toHaveLength(80);
});
test("keeps at most 30 tags", () => {
  const many = Array.from({ length: 40 }, (_, i) => `t${i}`).join(",");
  expect(parseTags(many)).toHaveLength(30);
});
