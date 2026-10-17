import { AlertTriangle } from "lucide-react";
import type { SavedDocument } from "../../core/model";
import { saveProblem } from "../../features/library/save-problem";

export function SaveProblemNote({ doc }: { doc: SavedDocument }) {
  const problem = saveProblem(doc);

  if (!problem) return null;

  return (
    <div title={problem} className="mt-2 flex items-center gap-1.5 text-[11.5px] font-medium text-foreground">
      <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
      Save didn't finish
    </div>
  );
}
