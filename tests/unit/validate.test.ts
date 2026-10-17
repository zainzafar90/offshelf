import { DEFAULT_SETTINGS } from "../../src/core/model";
import { validateDocument, validateSettings } from "../../src/core/validate";
import { sampleDocument } from "../helpers/fixtures";

describe("validateDocument", () => {
  test("accepts a valid document and measures it", () => {
    const doc = validateDocument(sampleDocument());
    expect(doc.wordCount).toBeGreaterThan(0);
  });
  test("drops javascript: hrefs", () => {
    const doc = validateDocument(sampleDocument());
    const block = doc.sections[0].blocks[2];
    expect(block.type === "paragraph" && block.content[0].href).toBeFalsy();
  });
  test("rejects unknown schema versions", () => {
    expect(() => validateDocument({ ...sampleDocument(), schemaVersion: 2 })).toThrow("not supported");
  });
  test("rejects undeclared image references", () => {
    const doc = sampleDocument();
    doc.sections[0].blocks.push({ type: "image", assetId: "missing", alt: "" });
    expect(() => validateDocument(doc)).toThrow("undeclared image");
  });
  test("rejects unsupported block types", () => {
    const doc = sampleDocument();
    (doc.sections[0].blocks as unknown[]).push({ type: "video" });
    expect(() => validateDocument(doc)).toThrow("Unsupported content block");
  });
});

describe("section avatars", () => {
  test("keeps a declared avatar", () => {
    const doc = sampleDocument();
    doc.assetIds.push("avatar-1");
    doc.sections[0].avatarAssetId = "avatar-1";
    expect(validateDocument(doc).sections[0].avatarAssetId).toBe("avatar-1");
  });
  test("rejects an undeclared avatar", () => {
    const doc = sampleDocument();
    doc.sections[0].avatarAssetId = "missing";
    expect(() => validateDocument(doc)).toThrow("undeclared image");
  });
});

describe("quote citations", () => {
  test("keeps a quoted author and a declared picture", () => {
    const doc = sampleDocument();
    doc.assetIds.push("q-avatar");
    doc.sections[0].blocks.push({ type: "quote", cite: { author: "Other", handle: "other", avatarAssetId: "q-avatar" }, blocks: [] });
    const quote = validateDocument(doc).sections[0].blocks.at(-1);
    expect(quote?.type === "quote" && quote.cite).toEqual({ author: "Other", handle: "other", avatarAssetId: "q-avatar" });
  });
  test("rejects an undeclared quoted-author picture", () => {
    const doc = sampleDocument();
    doc.sections[0].blocks.push({ type: "quote", cite: { author: "Other", avatarAssetId: "missing" }, blocks: [] });
    expect(() => validateDocument(doc)).toThrow("undeclared image");
  });
});

describe("validateSettings", () => {
  test.each([undefined, null, "x", 5, [], [1]])("returns the defaults for %j", value => {
    expect(validateSettings(value)).toEqual(DEFAULT_SETTINGS);
  });
  test("keeps valid values and ignores unknown keys", () => {
    const valid = { theme: "dark", readerFont: "sans", fontSize: 18, readerWidth: "wide", threadStyle: "cards", autoScroll: false, maxPasses: 40, openReader: false };
    expect(validateSettings({ ...valid, extra: 1 })).toEqual(valid);
  });
  test("replaces wrongly typed or unknown-enum fields with defaults", () => {
    expect(validateSettings({ theme: "neon", readerFont: 3, readerWidth: null, threadStyle: {}, autoScroll: "yes", openReader: 0, maxPasses: "abc", fontSize: "20" })).toEqual(DEFAULT_SETTINGS);
  });
  test.each([NaN, Infinity, -Infinity])("rejects the non-finite number %s", value => {
    expect(validateSettings({ maxPasses: value, fontSize: value })).toEqual(DEFAULT_SETTINGS);
  });
  test("clamps numbers into their ranges and rounds them", () => {
    expect(validateSettings({ maxPasses: 500, fontSize: 3 })).toMatchObject({ maxPasses: 80, fontSize: 15 });
    expect(validateSettings({ maxPasses: -4, fontSize: 99 })).toMatchObject({ maxPasses: 1, fontSize: 26 });
    expect(validateSettings({ maxPasses: 12.6, fontSize: 17.4 })).toMatchObject({ maxPasses: 13, fontSize: 17 });
  });
});
