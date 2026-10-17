import type { MouseEvent } from "react";
import { cardClick, isPlainClick, openLinkClick } from "../../src/surfaces/library/open-link";

function clickEvent(overrides: Partial<{ metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }> = {}): MouseEvent {
  return { metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, preventDefault: vi.fn(), ...overrides } as unknown as MouseEvent;
}

test("isPlainClick is false when any modifier key is held", () => {
  expect(isPlainClick(clickEvent())).toBe(true);
  expect(isPlainClick(clickEvent({ ctrlKey: true }))).toBe(false);
  expect(isPlainClick(clickEvent({ metaKey: true }))).toBe(false);
  expect(isPlainClick(clickEvent({ shiftKey: true }))).toBe(false);
  expect(isPlainClick(clickEvent({ altKey: true }))).toBe(false);
});

test("openLinkClick prevents default and opens on a plain click", () => {
  const onOpen = vi.fn();
  const event = clickEvent();
  openLinkClick(event, onOpen);
  expect(event.preventDefault).toHaveBeenCalled();
  expect(onOpen).toHaveBeenCalled();
});

test("openLinkClick leaves a modified click alone so the browser can open a new tab", () => {
  const onOpen = vi.fn();
  const event = clickEvent({ ctrlKey: true });
  openLinkClick(event, onOpen);
  expect(event.preventDefault).not.toHaveBeenCalled();
  expect(onOpen).not.toHaveBeenCalled();
});

test("cardClick skips a click that lands on a nested link or button", () => {
  const onOpen = vi.fn();
  const link = document.createElement("a");
  document.body.append(link);
  cardClick({ target: link } as unknown as MouseEvent<HTMLElement>, onOpen);
  expect(onOpen).not.toHaveBeenCalled();
});

test("cardClick opens when the click lands elsewhere on the card", () => {
  const onOpen = vi.fn();
  const div = document.createElement("div");
  document.body.append(div);
  cardClick({ target: div } as unknown as MouseEvent<HTMLElement>, onOpen);
  expect(onOpen).toHaveBeenCalled();
});
