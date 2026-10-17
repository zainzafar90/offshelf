import { saveProblem } from "../../src/features/library/save-problem";
import { sampleDocument } from "../helpers/fixtures";

test("reports an unfinished save from its warning", () => {
  for (const code of ["interrupted", "cancelled", "source-closed"]) {
    const doc = sampleDocument({ warnings: [{ code: "short", message: "Only a little text" }, { code, message: `stopped: ${code}` }] });
    expect(saveProblem(doc)).toBe(`stopped: ${code}`);
  }
});

test("ignores ordinary capture notes", () => {
  expect(saveProblem(sampleDocument({ warnings: [{ code: "paywall", message: "A paywall marker was detected." }] }))).toBeUndefined();
  expect(saveProblem(sampleDocument())).toBeUndefined();
});
