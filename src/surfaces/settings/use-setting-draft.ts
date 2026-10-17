import { useState } from "react";

/* Draft shows only while the stored value it was based on is unchanged. */
export function useSettingDraft<T>(stored: T): [T, (value: T) => void] {
  const [draft, setDraft] = useState<{ base: T; value: T } | null>(null);
  const shown = draft && Object.is(draft.base, stored) ? draft.value : stored;

  return [shown, value => setDraft({ base: stored, value })];
}
