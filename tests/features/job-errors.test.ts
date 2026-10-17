import { latestUnsavedFailure, visibleJobRows } from "../../src/features/library/job-errors";
import { makeDoc, makeJob } from "../helpers/jobs";

const old = "2026-09-01T10:00:00.000Z";
const recent = "2026-09-02T10:00:00.000Z";

test("keeps only the newest failed or interrupted job without a saved document", () => {
  const jobs = [
    makeJob({ id: "old", status: "failed", documentId: "x", createdAt: old }),
    makeJob({ id: "new", status: "interrupted", documentId: "y", createdAt: recent }),
    makeJob({ id: "cancelled", status: "cancelled", documentId: "z", createdAt: recent }),
  ];
  expect(latestUnsavedFailure(jobs, []).map(job => job.id)).toEqual(["new"]);
});

test("a failure whose document exists is not shown", () => {
  const jobs = [makeJob({ id: "f", status: "failed", documentId: "d1" })];
  expect(latestUnsavedFailure(jobs, [makeDoc({ id: "d1" })])).toEqual([]);
});

test("rows list running jobs before the latest failure", () => {
  const jobs = [
    makeJob({ id: "fail", status: "failed", documentId: "x", createdAt: recent }),
    makeJob({ id: "cap", status: "capturing", documentId: "y" }),
    makeJob({ id: "dl", status: "downloading", documentId: "z" }),
    makeJob({ id: "done", status: "done", documentId: "w" }),
  ];
  expect(visibleJobRows(jobs, []).map(job => job.id)).toEqual(["cap", "dl", "fail"]);
});
