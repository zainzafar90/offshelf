import { isStaleLink, readOpenId, readerUrl, wantsReadingSettings, withoutSettingsParam } from "../../src/features/library/reader-route";
import { sampleDocument } from "../helpers/fixtures";

test("readOpenId reads the id param", () => {
  expect(readOpenId("?id=abc")).toBe("abc");
  expect(readOpenId("?x=1")).toBeNull();
  expect(readOpenId("")).toBeNull();
});

test("readerUrl encodes the id and round-trips", () => {
  expect(readerUrl("a b/c")).toBe("?id=a%20b%2Fc");
  expect(readOpenId(readerUrl("a b/c"))).toBe("a b/c");
});

test("only settings=reading is a settings deep link", () => {
  expect(wantsReadingSettings("?settings=reading")).toBe(true);
  expect(wantsReadingSettings("?settings=saving")).toBe(false);
  expect(wantsReadingSettings("")).toBe(false);
});

test("withoutSettingsParam drops the param and keeps others", () => {
  expect(withoutSettingsParam("?settings=reading", "/library.html")).toBe("/library.html");
  expect(withoutSettingsParam("?settings=reading&id=1", "/library.html")).toBe("?id=1");
});

describe("isStaleLink", () => {
  const documents = [sampleDocument({ id: "known" })];
  const base = { loading: false, openId: "gone", deletingId: null, documents };

  test("an unknown id after loading is stale", () => {
    expect(isStaleLink(base)).toBe(true);
  });
  test("not stale while loading, without an id, for a known id, or for the id being deleted", () => {
    expect(isStaleLink({ ...base, loading: true })).toBe(false);
    expect(isStaleLink({ ...base, openId: null })).toBe(false);
    expect(isStaleLink({ ...base, openId: "known" })).toBe(false);
    expect(isStaleLink({ ...base, deletingId: "gone" })).toBe(false);
  });
});
