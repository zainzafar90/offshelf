import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { DEFAULT_SETTINGS } from "../../src/core/model";
import { errorMessage } from "../../src/core/errors";
import type { Settings } from "../../src/core/model";
import { getSettings } from "../../src/storage/library-store";
import { PopupPage } from "../../src/surfaces/popup/popup-page";
import { Toaster } from "../../src/surfaces/shared/toast";
import { useTheme } from "../../src/surfaces/shared/use-theme";
import "../../src/styles/globals.css";

function Popup() {
  const [theme, setTheme] = useState<Settings["theme"]>(DEFAULT_SETTINGS.theme);

  useEffect(() => {
    getSettings().then(
      settings => setTheme(settings.theme),
      error => console.error("Popup settings failed; using defaults:", errorMessage(error)),
    );
  }, []);
  useTheme(theme);

  return (
    <>
      <PopupPage />
      <Toaster />
    </>
  );
}

const root = document.getElementById("app")!;

createRoot(root).render(<Popup />);
