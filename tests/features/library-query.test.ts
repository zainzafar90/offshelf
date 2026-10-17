import { DEFAULT_QUERY, inView, matchesSearch, queryDocuments } from "../../src/features/library/library-query";
import { sampleDocument } from "../helpers/fixtures";

const docs = [
  sampleDocument({ id: "a", title: "Beta", kind: "article", capturedAt: "2026-09-02T00:00:00.000Z", tags: ["Design"] }),
  sampleDocument({ id: "t", title: "Alpha", kind: "thread", capturedAt: "2026-09-03T00:00:00.000Z", starred: true, read: true }),
  sampleDocument({ id: "x", title: "Gamma", kind: "article", capturedAt: "2026-09-01T00:00:00.000Z", archived: true }),
];

test("views match today's rules", () => {
  expect(docs.filter(d => inView(d, "all")).map(d => d.id)).toEqual(["a", "t"]);
  expect(docs.filter(d => inView(d, "unread")).map(d => d.id)).toEqual(["a"]);
  expect(docs.filter(d => inView(d, "starred")).map(d => d.id)).toEqual(["t"]);
  expect(docs.filter(d => inView(d, "archive")).map(d => d.id)).toEqual(["x"]);
});

test("kind filter: post means thread, article means everything else", () => {
  expect(queryDocuments(docs, { ...DEFAULT_QUERY, kind: "post" }).map(d => d.id)).toEqual(["t"]);
  expect(queryDocuments(docs, { ...DEFAULT_QUERY, kind: "article" }).map(d => d.id)).toEqual(["a"]);
});

test("sorts newest, oldest and by title", () => {
  expect(queryDocuments(docs, DEFAULT_QUERY).map(d => d.id)).toEqual(["t", "a"]);
  expect(queryDocuments(docs, { ...DEFAULT_QUERY, sort: "oldest" }).map(d => d.id)).toEqual(["a", "t"]);
  expect(queryDocuments(docs, { ...DEFAULT_QUERY, sort: "title" }).map(d => d.id)).toEqual(["t", "a"]);
});

test("tag and image filters", () => {
  expect(queryDocuments(docs, { ...DEFAULT_QUERY, tag: "Design" }).map(d => d.id)).toEqual(["a"]);
  expect(queryDocuments(docs, { ...DEFAULT_QUERY, imageOnly: true })).toEqual([]);
});

test("search looks at url, title, author, site, tags and post text, case-insensitively", () => {
  expect(matchesSearch(docs[0], "WORLD")).toBe(true);
  expect(matchesSearch(docs[0], "design")).toBe(true);
  expect(matchesSearch(docs[0], "example.com/post")).toBe(true);
  expect(matchesSearch(docs[0], "nothing-like-this")).toBe(false);
  expect(matchesSearch(docs[0], "   ")).toBe(true);
});

test("an avatar alone does not count as an image", () => {
  const withAvatar = sampleDocument({ id: "v", kind: "thread", assetIds: ["avatar"] });
  withAvatar.sections[0].avatarAssetId = "avatar";
  expect(queryDocuments([withAvatar], { ...DEFAULT_QUERY, imageOnly: true })).toEqual([]);
});
