import { AlertTriangle } from "lucide-react";
import { safeUrl } from "../../core/url";

type Props = { message: string; sourceUrl: string };

export function SaveProblemAlert({ message, sourceUrl }: Props) {
  const href = safeUrl(sourceUrl);

  return (
    <div role="alert" className="mb-4 flex gap-3 rounded-[10px] border border-border-strong bg-card px-4 py-3 text-[13px]">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-foreground" aria-hidden />
      <div className="min-w-0">
        <p className="m-0 font-semibold text-foreground">This save didn't finish</p>
        <p className="m-0 mt-0.5 text-secondary">{message}</p>
        <p className="m-0 mt-1.5 text-secondary">
          Only part of it was saved.{" "}
          {href && <a href={href} target="_blank" rel="noopener noreferrer" className="text-link hover:underline">Open the original</a>}
          {href && " and save it again."}
        </p>
      </div>
    </div>
  );
}
