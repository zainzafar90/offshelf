import { useState } from "react";
import type { LibraryQuery } from "../../features/library/library-query";
import { DEFAULT_QUERY } from "../../features/library/library-query";

export function useLibraryQuery(): [LibraryQuery, (patch: Partial<LibraryQuery>) => void] {
  const [query, setQuery] = useState<LibraryQuery>(DEFAULT_QUERY);
  const patch = (next: Partial<LibraryQuery>) => setQuery(previous => ({ ...previous, ...next }));

  return [query, patch];
}
