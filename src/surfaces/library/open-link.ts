import type { MouseEvent } from "react";

// Mirrors native link semantics: a modified click (new tab/window) should
// fall through to the browser instead of being intercepted.
export function isPlainClick(event: MouseEvent): boolean {
  return !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

export function openLinkClick(event: MouseEvent, onOpen: () => void): void {
  if (!isPlainClick(event)) return;

  event.preventDefault();
  onOpen();
}

// The whole card is clickable for mouse users, but a click that lands on a
// nested link or button (Open ↗, Star, the reading link) must not also fire
// the card's own open — those controls handle themselves.
export function cardClick(event: MouseEvent<HTMLElement>, onOpen: () => void): void {
  if ((event.target as HTMLElement).closest("a, button")) return;

  onOpen();
}
