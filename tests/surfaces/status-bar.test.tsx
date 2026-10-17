import { render, screen } from "@testing-library/react";
import type { Asset } from "../../src/core/model";
import { StatusBar } from "../../src/surfaces/library/status-bar";
import { sampleDocument } from "../helpers/fixtures";

const NOW = new Date("2026-09-10T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

function lastSaved(capturedAt: string) {
  render(<StatusBar documents={[sampleDocument({ capturedAt })]} assets={new Map()} />);
}

test.each([
  ["just now", 10 * SECOND],
  ["just now", 29 * SECOND],
  ["1 minute ago", 30 * SECOND],
  ["1 minute ago", 80 * SECOND],
  ["2 minutes ago", 90 * SECOND],
  ["2 minutes ago", 2 * MINUTE],
  ["44 minutes ago", 44 * MINUTE],
  ["59 minutes ago", 59 * MINUTE],
  ["1 hour ago", 60 * MINUTE],
  ["2 hours ago", 90 * MINUTE],
  ["5 hours ago", 5 * HOUR],
  ["1 day ago", 24 * HOUR],
  ["2 days ago", 2 * DAY],
  ["30 days ago", 30 * DAY],
])("last saved %s when captured %i ms ago", (label, elapsed) => {
  lastSaved(ago(elapsed));
  expect(screen.getByText(`Last saved ${label}`)).toBeInTheDocument();
});

test("the newest capture date wins", () => {
  const docs = [sampleDocument({ id: "a", capturedAt: ago(3 * DAY) }), sampleDocument({ id: "b", capturedAt: ago(2 * HOUR) })];
  render(<StatusBar documents={docs} assets={new Map()} />);
  expect(screen.getByText("Last saved 2 hours ago")).toBeInTheDocument();
});

test("an empty library shows no last-saved label", () => {
  render(<StatusBar documents={[]} assets={new Map()} />);
  expect(screen.queryByText(/Last saved/)).toBeNull();
  expect(screen.getByText("Saved on this device · works offline")).toBeInTheDocument();
  expect(screen.getByText("0 images stored")).toBeInTheDocument();
});

test("counts stored images and mentions the ones that could not be saved", () => {
  const asset = (id: string, status: Asset["status"]): [string, Asset] => [id, { id, sourceUrl: "https://e.com/a.png", alt: "", status, bytes: 1, attempts: 0, updatedAt: "" }];
  const assets = new Map([asset("a", "saved"), asset("b", "saved"), asset("c", "failed"), asset("d", "pending"), asset("e", "permission")]);
  render(<StatusBar documents={[]} assets={assets} />);
  expect(screen.getByText("2 images stored · 1 couldn't be saved")).toBeInTheDocument();
});
