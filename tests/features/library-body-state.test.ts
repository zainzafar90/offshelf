import { libraryBodyState } from "../../src/features/library/library-body-state";

test("loading wins over everything", () => {
  expect(libraryBodyState({ loading: true, error: "boom", visibleCount: 0 })).toBe("loading");
});
test("an error wins over an empty list", () => {
  expect(libraryBodyState({ loading: false, error: "boom", visibleCount: 0 })).toBe("error");
});
test("no visible documents is empty", () => {
  expect(libraryBodyState({ loading: false, visibleCount: 0 })).toBe("empty");
});
test("visible documents are populated", () => {
  expect(libraryBodyState({ loading: false, visibleCount: 2 })).toBe("populated");
});
