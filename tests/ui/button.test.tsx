import { render, screen } from "@testing-library/react";
import { Button } from "../../src/ui/button";

test("Button renders variants with token classes", () => {
  render(<Button variant="default">Save page</Button>);
  const button = screen.getByRole("button", { name: "Save page" });
  expect(button.className).toContain("bg-primary");
  expect(button.className).toContain("text-primary-foreground");
});

test("outline and ghost variants never use primary fill", () => {
  render(<><Button variant="outline">Import</Button><Button variant="ghost" size="icon" aria-label="Star" /></>);
  expect(screen.getByRole("button", { name: "Import" }).className).not.toContain("bg-primary");
  expect(screen.getByRole("button", { name: "Star" }).className).toContain("size-8");
});
