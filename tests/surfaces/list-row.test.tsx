import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ListRow } from "../../src/surfaces/library/list-row";
import { sampleDocument } from "../helpers/fixtures";

const noop = () => {};

test("the title link has the reading href, opens on a plain click and on Enter", async () => {
  const onOpen = vi.fn();
  const doc = sampleDocument({ id: "row-1", title: "A list row title" });
  render(<ListRow doc={doc} assets={new Map()} onOpen={onOpen} onStar={noop} />);
  const link = screen.getByRole("link", { name: "A list row title" });
  expect(link).toHaveAttribute("href", "?id=row-1");

  await userEvent.click(link);
  expect(onOpen).toHaveBeenCalledWith("row-1");

  onOpen.mockClear();
  link.focus();
  await userEvent.keyboard("{Enter}");
  expect(onOpen).toHaveBeenCalledWith("row-1");
});
