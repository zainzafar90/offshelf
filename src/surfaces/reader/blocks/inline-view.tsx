import type { ReactNode } from "react";
import type { Inline } from "../../../core/model";
import { safeUrl } from "../../../core/url";

// Nesting order: code, then bold, italic, strike, then the link wraps
// everything. Changing the order changes markup semantics.
function InlinePart({ part }: { part: Inline }) {
  let node: ReactNode = part.text;

  if (part.code) node = <code>{node}</code>;

  if (part.bold) node = <strong>{node}</strong>;

  if (part.italic) node = <em>{node}</em>;

  if (part.strike) node = <s>{node}</s>;

  const href = safeUrl(part.href);

  if (href) node = <a href={href} target="_blank" rel="noopener noreferrer" className="underline decoration-border-strong underline-offset-[3px] hover:decoration-current">{node}</a>;

  return <>{node}</>;
}

export function InlineView({ content }: { content: Inline[] }) {
  return (
    <>
      {content.map((part, index) => (
        <InlinePart key={index} part={part} />
      ))}
    </>
  );
}
