import { useState } from "react";

const FOCUS_KEY = "offshelf-focus";

export function useFocusMode(): [boolean, () => void] {
  const [focusMode, setFocusMode] = useState(() => localStorage.getItem(FOCUS_KEY) === "true");

  const toggle = () => {
    const next = !focusMode;

    setFocusMode(next);
    localStorage.setItem(FOCUS_KEY, String(next));
  };

  return [focusMode, toggle];
}
