import { render, screen } from "@testing-library/react";
import { EmptyState } from "../../src/surfaces/library/empty-state";
import { TitleBar } from "../../src/surfaces/library/title-bar";
import { DEFAULT_QUERY } from "../../src/features/library/library-query";

const noop = () => {};

test("title bar's Save page button is the dark primary variant", () => {
  render(<TitleBar query={DEFAULT_QUERY} onImport={noop} onSavePage={noop} />);
  expect(screen.getByRole("button", { name: /Save page/ }).className).toContain("bg-primary");
});

test("empty state's Save your first page button is the dark primary variant", () => {
  render(<EmptyState filtered={false} search="" onSavePage={noop} onTryReader={noop} />);
  expect(screen.getByRole("button", { name: "Save your first page" }).className).toContain("bg-primary");
});
