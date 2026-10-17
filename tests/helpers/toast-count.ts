import { screen } from "@testing-library/react";

/* toasts are module-global and outlive tests; compare counts */
export function toastCount(message: string): number {
  const toasts = [...screen.queryAllByRole("status", { hidden: true }), ...screen.queryAllByRole("alert", { hidden: true })];
  return toasts.filter(node => node.textContent === message).length;
}
