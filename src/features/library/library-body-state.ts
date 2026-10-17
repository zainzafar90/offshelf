export type LibraryBodyState = "loading" | "error" | "empty" | "populated";

type BodyStateInput = { loading: boolean; error?: string; visibleCount: number };

export function libraryBodyState({ loading, error, visibleCount }: BodyStateInput): LibraryBodyState {
  if (loading) return "loading";

  if (error) return "error";

  if (visibleCount === 0) return "empty";

  return "populated";
}
